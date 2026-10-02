const express = require('express');
const AdminDashboardService = require('../services/adminDashboardService');
const { requireUser, requireRole } = require('./middleware/auth');
const InspectionCommunication = require('../models/InspectionCommunication');
const RepairRequestCommunication = require('../models/RepairRequestCommunication');
const CommunicationInboxService = require('../services/communicationInboxService');

const router = express.Router();

const DASHBOARD_CACHE_TTL_MS = 15 * 1000;
const dashboardSummaryCache = new Map();
const customerMessagesCache = new Map();

function getCachedValue(cacheStore, key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > DASHBOARD_CACHE_TTL_MS) {
    cacheStore.delete(key);
    return null;
  }

  return entry.payload;
}

function setCachedValue(cacheStore, key, payload) {
  cacheStore.set(key, {
    payload,
    createdAt: Date.now(),
  });
}

// Middleware to check if user is admin
const requireAdmin = [requireUser, requireRole(['admin'])];

/**
 * KPI-Zaehler des Dashboards. Jeder Zaehler nutzt DIESELBE Service-Funktion/Regel wie die Liste,
 * die der zugehoerige Dashboard-Link mit Filter oeffnet - Zahl und Listen-Gesamtzahl stimmen
 * dadurch ueberein (vorher: aus den 10 zuletzt zugewiesenen Auftraegen bzw. 5 Buchungen gezaehlt).
 *   priorityOrders        -> /admin/orders?prio=high-urgent        (GET /api/admin/orders?priority=high-urgent)
 *   pendingBookings       -> /admin/bookings?status=pending        (GET /api/bookings?status=pending)
 *   pendingRepairRequests -> /admin/repair-requests?status=pending (GET /api/repair-requests?status=pending)
 *   awaitingCustomer      -> /admin/orders?rueckmeldung=offen      (GET /api/repair-workflows/admin/awaiting-customer-feedback)
 * Ein Zaehler, der nicht ermittelt werden kann, ist null (die Oberflaeche zeigt "–", nie 0).
 */
async function getDashboardKpis() {
  // Spaet geladen: die Dienste ziehen viele Modelle nach.
  const OrderService = require('../services/orderService'); // eslint-disable-line global-require
  const BookingService = require('../services/bookingService'); // eslint-disable-line global-require
  const RepairRequestService = require('../services/repairRequestService'); // eslint-disable-line global-require
  const RepairWorkflowService = require('../services/repairWorkflowService'); // eslint-disable-line global-require
  const settle = async (name, fn) => {
    try {
      const value = Number(await fn());
      return Number.isFinite(value) ? value : null;
    } catch (error) {
      console.error(`AdminDashboard: KPI ${name} could not be computed:`, error.message);
      return null;
    }
  };
  const FinancialService = require('../services/financialService'); // eslint-disable-line global-require
  const Complaint = require('../models/Complaint'); // eslint-disable-line global-require
  const { EPartOrder } = require('../models/EPartOrder'); // eslint-disable-line global-require
  const ListFilterGroups = require('../utils/listFilterGroups'); // eslint-disable-line global-require
  // Reklamationen: dieselben Klauseln wie GET /api/complaints (status/priority).
  const complaintCount = (status, priority) => {
    const query = {};
    const statusClause = ListFilterGroups.complaintStatusClause(status);
    if (statusClause !== undefined) query.status = statusClause;
    const priorityClause = ListFilterGroups.complaintPriorityClause(priority);
    if (priorityClause !== undefined) query.priority = priorityClause;
    return Complaint.countDocuments(query);
  };
  // EPart: derselbe Statusfilter wie GET /api/epart-orders (EPartOrderService.getEPartOrders).
  const epartCount = (status) => EPartOrder.countDocuments(ListFilterGroups.applyEPartStatusFilter({}, status));
  const [
    priorityOrders, pendingBookings, pendingRepairRequests, awaitingCustomer,
    complaintsOpen, complaintsApproval, complaintsUrgent,
    epartActive, epartPending, epartDelayed,
    receivables, paymentsInReview,
  ] = await Promise.all([
    settle('priorityOrders', async () => (await OrderService.getOrderStats()).highOrUrgent),
    settle('pendingBookings', () => BookingService.getBookingsCount({ status: 'pending' })),
    settle('pendingRepairRequests', async () => (await RepairRequestService.getRepairRequests({ status: 'pending' }, { limit: 1 })).pagination.total),
    settle('awaitingCustomer', async () => (await RepairWorkflowService.getAwaitingCustomerFeedback()).length),
    settle('complaintsOpen', () => complaintCount('offen')),
    settle('complaintsApproval', () => complaintCount('pending_approval')),
    settle('complaintsUrgent', () => complaintCount('offen', 'high-urgent')),
    settle('epartActive', () => epartCount('aktiv')),
    settle('epartPending', () => epartCount('ausstehend')),
    settle('epartDelayed', () => epartCount('verzoegert')),
    FinancialService.getOpenReceivables().catch((error) => {
      console.error('AdminDashboard: KPI receivables could not be computed:', error.message);
      return null;
    }),
    settle('paymentsInReview', async () => {
      const Payment = require('../models/Payment'); // eslint-disable-line global-require
      return Payment.countDocuments(FinancialService.paymentsInReviewQuery());
    }),
  ]);
  return {
    priorityOrders: { count: priorityOrders, link: '/admin/orders?prio=high-urgent' },
    pendingBookings: { count: pendingBookings, link: '/admin/bookings?status=pending' },
    pendingRepairRequests: { count: pendingRepairRequests, link: '/admin/repair-requests?status=pending' },
    awaitingCustomer: { count: awaitingCustomer, link: '/admin/orders?rueckmeldung=offen' },
    // Reklamationen -> GET /api/complaints?status=…&priority=… (total)
    complaintsOpen: { count: complaintsOpen, link: '/admin/complaints?status=offen' },
    complaintsApproval: { count: complaintsApproval, link: '/admin/complaints?status=pending_approval' },
    complaintsUrgent: { count: complaintsUrgent, link: '/admin/complaints?status=offen&priority=high-urgent' },
    // EPart -> GET /api/epart-orders?status=aktiv|ausstehend|verzoegert (pagination.total)
    epartActive: { count: epartActive, link: '/admin/epart-orders?status=aktiv' },
    epartPending: { count: epartPending, link: '/admin/epart-orders?status=ausstehend' },
    epartDelayed: { count: epartDelayed, link: '/admin/epart-orders?status=verzoegert' },
    // Finanzen -> GET /api/admin/financial/invoices?receivable=offen|ueberfaellig (total) bzw.
    // /payments?review=pruefung (totalCount)
    openInvoices: { count: Array.isArray(receivables) ? receivables.length : null, link: '/admin/financial?tab=invoices&forderung=offen' },
    overdueInvoices: { count: Array.isArray(receivables) ? receivables.filter((entry) => entry.overdue).length : null, link: '/admin/financial?tab=invoices&forderung=ueberfaellig' },
    paymentsInReview: { count: paymentsInReview, link: '/admin/financial?tab=payments&zahlungen=pruefung' },
  };
}

/**
 * GET /api/admin/dashboard/bookings
 * Get recent bookings with customer details
 */
router.get('/bookings', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get recent bookings request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 10;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const bookings = await AdminDashboardService.getRecentBookings(limit);

    console.log(`AdminDashboard: Returning ${bookings.length} recent bookings`);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting recent bookings:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recent bookings'
    });
  }
});

/**
 * GET /api/admin/dashboard/repair-requests
 * Get active repair requests with status
 */
router.get('/repair-requests', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get repair requests request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 10;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const requests = await AdminDashboardService.getActiveRepairRequests(limit);

    console.log(`AdminDashboard: Returning ${requests.length} repair requests`);

    return res.status(200).json({
      success: true,
      data: requests,
      count: requests.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting repair requests:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch repair requests'
    });
  }
});

/**
 * GET /api/admin/dashboard/notifications
 * Get recent notifications with urgency highlighting
 */
router.get('/notifications', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get notifications request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.query.userId || req.user._id; // Allow fetching for specific user or current admin

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const notificationsData = await AdminDashboardService.getRecentNotifications(userId, limit);

    console.log(`AdminDashboard: Returning ${notificationsData.notifications.length} notifications`);

    return res.status(200).json({
      success: true,
      data: notificationsData.notifications,
      unreadCount: notificationsData.unreadCount,
      urgentCount: notificationsData.urgentCount,
      totalCount: notificationsData.totalCount
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications'
    });
  }
});

/**
 * GET /api/admin/dashboard/activities
 * Get recent system-wide activities
 */
router.get('/activities', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get activities request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 20;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const activities = await AdminDashboardService.getRecentActivities(limit);

    console.log(`AdminDashboard: Returning ${activities.length} activities`);

    return res.status(200).json({
      success: true,
      data: activities,
      count: activities.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting activities:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activities'
    });
  }
});

/**
 * GET /api/admin/dashboard/staff-status
 * Get staff availability and assigned tasks
 */
router.get('/staff-status', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get staff status request from:', req.user.email);

  try {
    const staffStatus = await AdminDashboardService.getStaffStatus();

    console.log(`AdminDashboard: Returning status for ${staffStatus.length} staff members`);

    return res.status(200).json({
      success: true,
      data: staffStatus,
      count: staffStatus.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting staff status:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch staff status'
    });
  }
});

/**
 * GET /api/admin/dashboard/assigned-orders
 * Get orders with time tracking metrics
 */
router.get('/assigned-orders', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get assigned orders request from:', req.user.email);

  try {
    const limit = parseInt(req.query.limit) || 20;

    if (limit < 1 || limit > 100) {
      console.log('AdminDashboard: Invalid limit parameter:', limit);
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    const orders = await AdminDashboardService.getAssignedOrders(limit);

    console.log(`AdminDashboard: Returning ${orders.length} assigned orders`);

    return res.status(200).json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting assigned orders:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assigned orders'
    });
  }
});

/**
 * GET /api/admin/dashboard/system-overview
 * Get system health and performance metrics
 */
router.get('/system-overview', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get system overview request from:', req.user.email);

  try {
    const overview = await AdminDashboardService.getSystemOverview();

    console.log('AdminDashboard: System overview retrieved successfully');

    return res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting system overview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch system overview'
    });
  }
});

/**
 * GET /api/admin/dashboard/summary
 * Get complete dashboard summary (all data in one call)
 * Useful for initial dashboard load
 */
router.get('/summary', requireAdmin, async (req, res) => {
  console.log('AdminDashboard: Get complete summary request from:', req.user.email);

  try {
    const userCacheKey = String(req.user._id || 'admin');
    const cachedPayload = getCachedValue(dashboardSummaryCache, userCacheKey);
    if (cachedPayload) {
      return res.status(200).json(cachedPayload);
    }

    // Fetch all dashboard data in parallel for better performance
    const [
      bookings,
      repairRequests,
      notifications,
      activities,
      staffStatus,
      assignedOrders,
      systemOverview,
      kpis
    ] = await Promise.all([
      AdminDashboardService.getRecentBookings(5),
      AdminDashboardService.getActiveRepairRequests(5),
      AdminDashboardService.getRecentNotifications(req.user._id, 10),
      AdminDashboardService.getRecentActivities(10),
      AdminDashboardService.getStaffStatus(),
      AdminDashboardService.getAssignedOrders(10),
      AdminDashboardService.getSystemOverview(),
      getDashboardKpis()
    ]);

    console.log('AdminDashboard: Complete summary retrieved successfully');

    const responsePayload = {
      success: true,
      data: {
        bookings: {
          data: bookings,
          count: bookings.length
        },
        repairRequests: {
          data: repairRequests,
          count: repairRequests.length
        },
        notifications: {
          data: notifications.notifications,
          unreadCount: notifications.unreadCount,
          urgentCount: notifications.urgentCount,
          totalCount: notifications.totalCount
        },
        activities: {
          data: activities,
          count: activities.length
        },
        staffStatus: {
          data: staffStatus,
          count: staffStatus.length
        },
        assignedOrders: {
          data: assignedOrders,
          count: assignedOrders.length
        },
        systemOverview,
        // Zaehler mit Link + Filter der Zielliste (siehe getDashboardKpis).
        kpis
      }
    };

    setCachedValue(dashboardSummaryCache, userCacheKey, responsePayload);
    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('AdminDashboard: Error getting dashboard summary:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard summary'
    });
  }
});

/**
 * GET /api/admin/dashboard/customer-messages
 * Kundennachrichten fuer das Dashboard - aus DERSELBEN Quelle und Regel wie das Postfach
 * (communicationInboxService): alle Gespraeche, keine Begrenzung auf die neuesten 100 Threads.
 *  - totalUnread:   Gespraeche mit ungelesenen Kundennachrichten FUER DIESEN Admin (pro Benutzer)
 *  - awaitingReply: Gespraeche, in denen das Team antworten muss (teamweit)
 *  - messages[]:    neueste Gespraeche mit ungelesener Nachricht oder offener Antwort;
 *                   navigateTo = Gespraech im Postfach (/messages?thread=<quelle>:<id>)
 *  - sourceErrors:  Quellen, die nicht geladen werden konnten (nie als 0 melden)
 * Cache: nur der kurze Zaehler-Cache des Postfachs (10 s pro Benutzer), der beim Lesen und bei
 * jedem Schreibzugriff auf Auftrags-Threads sofort geleert wird - Zaehler stimmen nach dem Lesen.
 */
router.get('/customer-messages', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const summary = await CommunicationInboxService.getSummary(req.user, { recentLimit: limit });

    const messages = summary.recent.map((item) => ({
      _id: item.key,
      key: item.key,
      source: item.sourceType === 'order' ? 'inspection' : item.sourceType,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel,
      sourceId: item.sourceId,
      title: item.title,
      orderNumber: item.reference?.orderNumber || null,
      requestNumber: item.reference?.requestNumber || null,
      complaintNumber: item.reference?.complaintNumber || null,
      senderName: item.lastMessage?.senderName || item.customer?.name || 'Kunde',
      content: item.lastMessage?.preview || '',
      createdAt: item.lastMessage?.createdAt || item.lastActivityAt,
      unreadCount: item.unreadCount,
      awaitingReply: item.awaitingReply,
      navigateTo: item.threadUrl,
      threadUrl: item.threadUrl,
    }));

    return res.status(200).json({
      success: true,
      messages,
      totalUnread: summary.unread,
      unreadMessages: summary.unreadMessages,
      awaitingReply: summary.awaitingReply,
      sourceErrors: summary.sourceErrors,
      partial: summary.partial,
    });
  } catch (error) {
    console.error('AdminDashboard: Error getting customer messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Kundennachrichten konnten nicht geladen werden.',
    });
  }
});

module.exports = router;
