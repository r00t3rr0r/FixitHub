import api from './api';

// Description: Get recent bookings for admin dashboard
// Endpoint: GET /api/admin/dashboard/bookings
// Request: { limit?: number }
// Response: { bookings: Array<{ _id: string, customer: { firstName: string, lastName: string, email: string }, service: { name: string }, bookingTime: string, status: string, paymentStatus: string, totalAmount: number }> }
export const getRecentBookings = async (limit: number = 10) => {
  try {
    const response = await api.get(`/api/admin/dashboard/bookings?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching recent bookings:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get active repair requests for admin dashboard
// Endpoint: GET /api/admin/dashboard/repair-requests
// Request: { limit?: number }
// Response: { repairRequests: Array<{ _id: string, customer: { firstName: string, lastName: string, email: string }, deviceType: string, issueDescription: string, status: string, urgency: string, estimatedCompletionDate: Date, createdAt: Date }> }
export const getActiveRepairRequests = async (limit: number = 10) => {
  try {
    const response = await api.get(`/api/admin/dashboard/repair-requests?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching active repair requests:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get recent notifications for admin dashboard
// Endpoint: GET /api/admin/dashboard/notifications
// Request: { limit?: number }
// Response: { notifications: Array<{ _id: string, title: string, message: string, type: string, isUrgent: boolean, read: boolean, createdAt: Date }> }
export const getRecentNotifications = async (limit: number = 20) => {
  try {
    const response = await api.get(`/api/admin/dashboard/notifications?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching recent notifications:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get recent activities for admin dashboard
// Endpoint: GET /api/admin/dashboard/activities
// Request: { limit?: number }
// Response: { activities: Array<{ type: string, description: string, user?: { firstName: string, lastName: string, email: string }, timestamp: Date, metadata?: any }> }
export const getRecentActivities = async (limit: number = 20) => {
  try {
    const response = await api.get(`/api/admin/dashboard/activities?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching recent activities:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get staff status for admin dashboard
// Endpoint: GET /api/admin/dashboard/staff-status
// Request: {}
// Response: { staffStatus: Array<{ _id: string, firstName: string, lastName: string, email: string, status: string, availability: string, assignedOrders: number, assignedTasks: number, activeWorkSession: { startTime: Date, taskDescription: string } | null }> }
export const getStaffStatus = async () => {
  try {
    const response = await api.get('/api/admin/dashboard/staff-status');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching staff status:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get assigned orders with time tracking for admin dashboard
// Endpoint: GET /api/admin/dashboard/assigned-orders
// Request: { limit?: number }
// Response: { assignedOrders: Array<{ _id: string, orderNumber: string, customer: { firstName: string, lastName: string }, assignedTo: { firstName: string, lastName: string }, status: string, priority: string, createdAt: Date, totalTimeSpent: number, lastActivity: Date }> }
export const getAssignedOrders = async (limit: number = 10) => {
  try {
    const response = await api.get(`/api/admin/dashboard/assigned-orders?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching assigned orders:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get system overview metrics for admin dashboard
// Endpoint: GET /api/admin/dashboard/system-overview
// Request: {}
// Response: { systemOverview: { totalUsers: number, totalOrders: number, totalBookings: number, totalRepairRequests: number, activeStaff: number, pendingOrders: number, pendingRepairRequests: number, systemHealth: string, databaseStatus: string, lastBackup: Date | null, avgOrderCompletionTime: number, avgRepairRequestCompletionTime: number } }
export const getSystemOverview = async () => {
  try {
    const response = await api.get('/api/admin/dashboard/system-overview');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching system overview:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get complete dashboard summary (all data in one call)
// Endpoint: GET /api/admin/dashboard/summary
// Request: {}
// Response: { bookings: Array, repairRequests: Array, notifications: Array, activities: Array, staffStatus: Array, assignedOrders: Array, systemOverview: Object }
export const getDashboardSummary = async () => {
  try {
    const response = await api.get('/api/admin/dashboard/summary');
    console.log('Admin Dashboard API: Raw response data:', response.data);

    // Extract data from nested response structure
    const rawData = response.data.data || response.data;

    const extractedData = {
      bookings: (rawData.bookings?.data || rawData.bookings || []),
      repairRequests: (rawData.repairRequests?.data || rawData.repairRequests || []),
      notifications: (rawData.notifications?.data || rawData.notifications || []),
      activities: (rawData.activities?.data || rawData.activities || []),
      staffStatus: (rawData.staffStatus?.data || rawData.staffStatus || []),
      assignedOrders: (rawData.assignedOrders?.data || rawData.assignedOrders || []),
      systemOverview: (rawData.systemOverview || {})
    };

    console.log('Admin Dashboard API: Extracted data:', extractedData);
    return extractedData;
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
