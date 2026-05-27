import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import "./CustomerBookings.css";
import {
  Package,
  Smartphone,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Search,
  Filter,
  ExternalLink,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  CheckCircle,
  Truck,
  QrCode,
  FileText,
  Download,
  MessageSquare,
  X,
  TrendingUp,
  Hash,
  CreditCard,
  Home,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBookings, getBookingOrders, getBooking, downloadBookingShippingLabel, downloadBookingReturnLabel } from "@/api/bookings";
import { searchDevices, SearchResult } from "@/api/devices";
import { getUnreadMessageCounts } from "@/api/inspectionCommunication";
import { useToast } from "@/hooks/useToast";
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel";
import { buildOrderDetailsState, getOrderDetailsPath } from "@/lib/orderDetailsNavigation";

interface AddressFields {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface Booking {
  _id: string;
  bookingNumber: string;
  customerId: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email: string;
    phone: string;
    avatar?: string;
    invoiceAddress?: AddressFields;
    paymentAddress?: AddressFields & { sameAsInvoice?: boolean };
  };
  guestInfo?: {
    billingAddress?: AddressFields;
    shippingAddress?: AddressFields;
  };
  billingAddress?: AddressFields;
  shippingAddress?: AddressFields;
  orderIds?: Array<{
    billingAddress?: AddressFields;
    shippingAddress?: AddressFields;
    guestInfo?: {
      billingAddress?: AddressFields;
      shippingAddress?: AddressFields;
    };
  }>;
  items: Array<{
    _id?: string;
    type: string;
    device?: string;
    orderId: string;
    orderNumber?: string;
    services?: Array<{
      name: string;
      price: number;
      estimatedTime?: number;
    }>;
    products?: Array<{
      name: string;
      quantity: number;
      price: number;
      totalPrice: number;
    }>;
    cost: number;
    status?: string;
    progress?: number;
  }>;
  totalCost: number;
  status: string;
  billingStatus: string;
  paymentStatus?: string;
  overallProgress: number;
  createdAt: string;
  updatedAt: string;
  returnLabelUrl?: string;
  returnQRCodeUrl?: string;
  returnTrackingNumber?: string;
  returnShipmentStatus?: string;
  returnShipmentStatusDescription?: string;
  returnCreatedAt?: string;
  returnReceivedAt?: string;
  trackingNumber?: string;
  carrier?: string;
  shippingStatus?: string;
  shippingStatusDescription?: string;
  shippingLabelUrl?: string;
  shippingCreatedAt?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  timeline?: Array<{
    _id?: string;
    status: string;
    description: string;
    completedAt: string;
    staffName?: string;
    staffId?: string;
  }>;
  liveShippingTracking?: {
    status?: string;
    statusCodeRaw?: string;
    description?: string;
    estimatedDelivery?: string;
    service?: string;
    shipmentId?: string;
    events?: Array<{
      timestamp?: string;
      location?: string;
      status?: string;
      statusCode?: string;
      description?: string;
    }>;
  };
}

export function CustomerBookings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const [expandedOrdersData, setExpandedOrdersData] = useState<Record<string, any[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set());
  const [calculatedProgress, setCalculatedProgress] = useState<Record<string, number>>({});
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalBookings, setTotalBookings] = useState(0);

  // Unread message counts state
  const [unreadCounts, setUnreadCounts] = useState<Record<string, { unread: number; senderType?: string }>>({});
  const [loadingUnreadCounts, setLoadingUnreadCounts] = useState(false);

  // Communication panel state
  const [showCommunicationPanel, setShowCommunicationPanel] = useState(false);
  const [selectedOrderForCommunication, setSelectedOrderForCommunication] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, currentPage, itemsPerPage]);

  useEffect(() => {
    const reopenBookingId = (location.state as { reopenBookingDialog?: string } | null)?.reopenBookingDialog;
    if (!reopenBookingId) {
      return;
    }

    const reopenBookingDialog = async () => {
      try {
        const response = await getBooking(reopenBookingId);
        setSelectedBooking(response.booking);
        setShowDetailDialog(true);
      } catch (error) {
        console.error("CustomerBookings: Error reopening booking dialog:", error);
      }
    };

    reopenBookingDialog();
  }, [location.state]);

  // Fetch unread counts when bookings change
  useEffect(() => {
    if (bookings.length > 0) {
      fetchUnreadCounts();
    }
  }, [bookings]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      console.log('CustomerBookings: Fetching bookings with status filter:', statusFilter);

      const filters: any = {
        limit: itemsPerPage,
        skip: (currentPage - 1) * itemsPerPage
      };
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const response = await getBookings(filters);
      console.log('CustomerBookings: Received bookings:', response.bookings?.length);

      const bookingsData = response.bookings || [];
      const total = response.total || bookingsData.length;

      setBookings(bookingsData);
      setTotalBookings(total);
      setFilteredBookings(bookingsData);
    } catch (error: any) {
      console.error('CustomerBookings: Error fetching bookings:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('bookings.errorFetchingBookings'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread message counts for all visible bookings
  const fetchUnreadCounts = async () => {
    try {
      setLoadingUnreadCounts(true);

      // Collect all order IDs from all bookings' items
      const allOrderIds: string[] = [];
      bookings.forEach((booking) => {
        booking.items.forEach(item => {
          if (item.orderId) {
            allOrderIds.push(item.orderId);
          }
        });
      });

      if (allOrderIds.length === 0) {
        return;
      }

      console.log(`CustomerBookings: Fetching unread counts for ${allOrderIds.length} orders`);
      const counts = await getUnreadMessageCounts(allOrderIds);
      console.log('CustomerBookings: Received unread counts:', counts);
      setUnreadCounts(counts || {});
    } catch (error) {
      console.error("CustomerBookings: Error fetching unread counts:", error);
      // Don't show error toast as this is a non-critical feature
    } finally {
      setLoadingUnreadCounts(false);
    }
  };

  // Client-side search filtering
  useEffect(() => {
    let filtered = bookings;

    if (searchTerm) {
      filtered = filtered.filter(booking =>
        booking.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking._id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  }, [bookings, searchTerm]);

  const toggleExpandBooking = async (bookingId: string) => {
    const newExpanded = new Set(expandedBookings);

    if (newExpanded.has(bookingId)) {
      // Collapse
      newExpanded.delete(bookingId);
      setExpandedBookings(newExpanded);
    } else {
      // Expand - fetch fresh orders data from API
      try {
        const newLoading = new Set(loadingOrders);
        newLoading.add(bookingId);
        setLoadingOrders(newLoading);

        console.log(`Fetching orders for booking: ${bookingId}`);
        const response = await getBookingOrders(bookingId);
        const ordersData = response.orders || [];

        console.log(`Retrieved ${ordersData.length} orders with repair progress status`);

        // Calculate actual progress from fresh order data
        let totalProgress = 0;
        ordersData.forEach((order: any) => {
          totalProgress += (order.progress || 0);
        });
        const averageProgress = ordersData.length > 0 ? Math.round(totalProgress / ordersData.length) : 0;

        console.log(`Calculated progress for booking ${bookingId}: ${averageProgress}%`);

        setExpandedOrdersData(prev => ({
          ...prev,
          [bookingId]: ordersData
        }));

        setCalculatedProgress(prev => ({
          ...prev,
          [bookingId]: averageProgress
        }));

        newExpanded.add(bookingId);
        setExpandedBookings(newExpanded);

        const newLoading2 = new Set(loadingOrders);
        newLoading2.delete(bookingId);
        setLoadingOrders(newLoading2);
      } catch (error) {
        console.error("Error loading orders:", error);
        toast({
          title: t('common.error'),
          description: "Failed to load associated orders",
          variant: "destructive"
        });
        const newLoading = new Set(loadingOrders);
        newLoading.delete(bookingId);
        setLoadingOrders(newLoading);
      }
    }
  };

  const handleViewDetails = async (booking: Booking) => {
    try {
      const response = await getBooking(booking._id);
      setSelectedBooking(response.booking);
      setShowDetailDialog(true);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: "Failed to load booking details",
        variant: "destructive"
      });
    }
  };

  const handleViewOrder = (orderId: string) => {
    navigate(getOrderDetailsPath(orderId), {
      state: buildOrderDetailsState(location, {
        label: t('common.back'),
      }),
    });
  };

  const bookingDialogTabTriggerClass = "booking-detail-tab-trigger";

  const handleOpenCommunication = (orderId: string) => {
    console.log('Opening communication panel for order:', orderId);
    setSelectedOrderForCommunication(orderId);
    setShowCommunicationPanel(true);
  };

  const getBookingProgress = (bookingId: string, fallbackProgress: number = 0) => {
    if (calculatedProgress[bookingId] !== undefined) {
      return calculatedProgress[bookingId];
    }
    return fallbackProgress;
  };

  // Helper function to get total unread count for a booking
  const getBookingUnreadCount = (booking: Booking) => {
    let totalUnread = 0;
    let hasCustomerMessages = false;
    let hasStaffMessages = false;

    // Check all items in the booking
    booking.items.forEach((item) => {
      if (item.orderId && unreadCounts[item.orderId]) {
        totalUnread += unreadCounts[item.orderId].unread;
        if (unreadCounts[item.orderId].senderType === 'customer') {
          hasCustomerMessages = true;
        } else {
          hasStaffMessages = true;
        }
      }
    });

    return {
      total: totalUnread,
      hasCustomerMessages,
      hasStaffMessages
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge badge-pending';
      case 'payment-pending':
        return 'badge badge-payment-pending';
      case 'processing':
        return 'badge badge-processing';
      case 'completed':
        return 'badge badge-completed';
      case 'cancelled':
        return 'badge badge-cancelled';
      default:
        return 'badge';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge badge-pending';
      case 'in-progress':
        return 'badge badge-processing';
      case 'quality-check':
        return 'badge badge-processing';
      case 'ready-for-pickup':
        return 'badge badge-payment-pending';
      case 'completed':
        return 'badge badge-completed';
      case 'cancelled':
        return 'badge badge-cancelled';
      default:
        return 'badge';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'badge badge-pending';
      case 'sent':
        return 'badge badge-processing';
      case 'viewed':
        return 'badge badge-processing';
      case 'overdue':
        return 'badge badge-unpaid';
      case 'partially_paid':
        return 'badge badge-partially-paid';
      case 'unpaid':
        return 'badge badge-unpaid';
      case 'partially-paid':
        return 'badge badge-partially-paid';
      case 'paid':
        return 'badge badge-paid';
      default:
        return 'badge';
    }
  };

  const getEffectivePaymentStatus = (booking: Booking) => {
    const invoiceStatuses = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue'];
    const candidate = String(booking.paymentStatus || '');
    return invoiceStatuses.includes(candidate) ? candidate : booking.billingStatus;
  };

  const getBillingStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Vorlage';
      case 'sent':
        return 'Gesendet';
      case 'viewed':
        return 'Angesehen';
      case 'partially_paid':
        return 'Teilweise Bezahlt';
      case 'overdue':
        return 'Ueberfaellig';
      case 'unpaid':
        return 'Offen';
      case 'partially-paid':
        return 'Teilbezahlt';
      case 'paid':
        return 'Bezahlt';
      default:
        return status;
    }
  };

  const getReturnShipmentStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'badge badge-pending';
      case 'label-created':
        return 'badge badge-processing';
      case 'in-transit':
        return 'badge badge-processing';
      case 'delivered':
        return 'badge badge-completed';
      case 'failed':
        return 'badge badge-cancelled';
      default:
        return 'badge';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-amber-50/20">
      <div className="mx-auto w-[calc(100%-2rem)] max-w-[1200px] pb-8 space-y-8 max-[480px]:w-[calc(100%-0.8rem)] max-[360px]:w-[calc(100%-0.5rem)]">
        {/* Header Section */}
        <div className="w-full overflow-hidden rounded-[18px] border-b border-[#2a3f7e] bg-gradient-to-br from-[#1a2a5e] to-[#0f1d45] px-6 py-12 text-white max-[480px]:rounded-[12px] max-[480px]:px-3 max-[360px]:px-[10px]">
          <div className="flex items-start gap-4 sm:items-center max-[480px]:items-start max-[480px]:gap-[10px]">
            <Package className="h-12 w-12 flex-shrink-0 text-[#f5b800] max-sm:h-[34px] max-sm:w-[34px]" />
            <div>
              <h1 className="m-0 text-[2rem] font-extrabold leading-[1.2] tracking-[-0.5px] max-[480px]:text-[1rem] max-[480px]:leading-[1.25] max-[360px]:text-[0.92rem]">{t('bookings.myBookings')}</h1>
              <p className="mt-1 text-[0.95rem] leading-[1.35] text-[rgba(255,255,255,0.85)] opacity-90 max-[480px]:text-[0.76rem] max-[360px]:text-[0.72rem]">{t('bookings.manageYourBookings')}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-lg bg-white">
          <CardContent className="py-3 px-4">
            <div className="bookings-filter-bar flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[#1a2a5e]">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center flex-shrink-0">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm uppercase tracking-wide whitespace-nowrap">{t('common.filter')}</span>
              </div>
              <div className="flex-1 min-w-0 w-full sm:min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t('bookings.searchByBookingNumber')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]"
                  />
                </div>
              </div>
              <div className="w-full sm:min-w-[180px]">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]">
                    <SelectValue placeholder={t('common.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="pending">{t('status.pending')}</SelectItem>
                    <SelectItem value="payment-pending">{t('status.paymentPending')}</SelectItem>
                    <SelectItem value="processing">{t('status.processing')}</SelectItem>
                    <SelectItem value="completed">{t('status.completed')}</SelectItem>
                    <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card className="border-none shadow-lg bg-white">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="h-20 w-20 mx-auto rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
                  <Package className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-[#1a2a5e] mb-2">{t('bookings.noBookings')}</h3>
                <p className="text-slate-500 text-base mb-6">You haven't made any bookings yet. Start by creating a new order.</p>
                <Button className="bg-gradient-to-r from-[#f5b800] to-[#e5ab00] hover:from-[#e5ab00] hover:to-[#d59a00] text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all" onClick={() => navigate('/#repair-order-configurator')}>
                  {t('navigation.newOrder')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-[#1a2a5e]">{t('bookings.bookingsList')}</CardTitle>
              <CardDescription className="text-base text-slate-500">
                {filteredBookings.length} {t('bookings.bookingsFound')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <div className="bookings-list-table-wrap">
                <Table className="bookings-list-table">
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2 border-slate-200">
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3"></TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.bookingID')}</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('common.status')}</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.billing')}</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.progress')}</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.totalCost')}</TableHead>
                      <TableHead className="text-center text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.items')}</TableHead>
                      <TableHead className="text-center text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.messages')}</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('bookings.created')}</TableHead>
                      <TableHead className="text-right text-xs font-bold uppercase tracking-normal whitespace-nowrap text-[#1a2a5e] py-3">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredBookings.map((booking) => (
                    <React.Fragment key={booking._id}>
                      <TableRow
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={(e) => {
                          // Don't trigger if clicking on buttons or interactive elements
                          const target = e.target as HTMLElement;
                          if (!target.closest('button') && !target.closest('a') && !target.closest('[role="menu"]') && !target.closest('[role="dialog"]')) {
                            handleViewDetails(booking);
                          }
                        }}
                      >
                        <TableCell className="text-center py-5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleExpandBooking(booking._id)}
                            disabled={loadingOrders.has(booking._id)}
                          >
                            {expandedBookings.has(booking._id) ? (
                              <ChevronUp className="h-5 w-5" />
                            ) : (
                              <ChevronDown className="h-5 w-5" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-bold text-base text-[#1a2a5e] py-5" data-label="Booking ID">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>{booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-5" data-label="Status">
                          <Badge className={getStatusColor(booking.status)}>
                            {t(`status.${booking.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5" data-label="Billing">
                          <Badge className={getBillingStatusColor(getEffectivePaymentStatus(booking))}>
                            {getBillingStatusLabel(getEffectivePaymentStatus(booking))}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-5" data-label="Progress">
                          <div className="progress-container">
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${getBookingProgress(booking._id, booking.overallProgress || 0)}%` }}
                              ></div>
                            </div>
                            <span className="progress-text">
                              {getBookingProgress(booking._id, booking.overallProgress || 0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-base text-[#1a2a5e] py-5" data-label="Total Cost">
                          {formatCurrency(booking.totalCost)}
                        </TableCell>
                        <TableCell className="text-center font-medium py-5" data-label="Items">
                          {booking.items.length}
                        </TableCell>
                        <TableCell className="text-center py-5" data-label="Messages">
                          {(() => {
                            const unreadInfo = getBookingUnreadCount(booking);
                            if (unreadInfo.total > 0) {
                              return (
                                <div className="flex items-center justify-center">
                                  <div className={`
                                    message-badge
                                    ${unreadInfo.hasStaffMessages
                                      ? 'message-badge-staff'
                                      : 'message-badge-customer'
                                    }
                                  `}
                                  title={`${unreadInfo.total} total unread message${unreadInfo.total > 1 ? 's' : ''} from ${unreadInfo.hasStaffMessages ? 'staff' : 'you'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Find the first order ID for this booking
                                    const firstOrderId = booking.items[0]?.orderId;
                                    if (firstOrderId) {
                                      handleOpenCommunication(firstOrderId);
                                    }
                                  }}
                                  >
                                    {unreadInfo.total > 99 ? '99+' : unreadInfo.total}
                                  </div>
                                </div>
                              );
                            }
                            return <span className="text-sm opacity-50">—</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-base text-slate-600 py-5" data-label="Created">
                          {formatDate(booking.createdAt)}
                        </TableCell>
                        <TableCell className="text-right py-5" data-label="Actions">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => handleViewDetails(booking)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t('common.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleExpandBooking(booking._id)}>
                                {expandedBookings.has(booking._id) ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-2" />
                                    {t('common.hide')} Orders
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-2" />
                                    {t('bookings.viewOrders')}
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row with Orders/Repair Jobs */}
                      {expandedBookings.has(booking._id) && (
                        <TableRow className="expanded-row">
                          <TableCell colSpan={10}>
                            <div className="p-2 space-y-2">
                              {/* Booking Status Summary */}
                              <div className="expanded-section">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="expanded-section-title">{t('bookings.bookingStatus')}</span>
                                  <Badge className={getStatusColor(booking.status)}>
                                    {t(`status.${booking.status}`)}
                                  </Badge>
                                </div>
                                <div className="info-grid">
                                  <div className="info-item">
                                    <div className="info-label">{t('bookings.billing')}</div>
                                    <Badge className={getBillingStatusColor(getEffectivePaymentStatus(booking))}>
                                      {getBillingStatusLabel(getEffectivePaymentStatus(booking))}
                                    </Badge>
                                  </div>
                                  {booking.returnShipmentStatus && (
                                    <div className="info-item">
                                      <div className="info-label">{t('bookings.returnStatus')}</div>
                                      <Badge className={getReturnShipmentStatusColor(booking.returnShipmentStatus)}>
                                        {t(`status.${booking.returnShipmentStatus}`)}
                                      </Badge>
                                    </div>
                                  )}
                                  <div className="info-item">
                                    <div className="info-label">{t('bookings.totalCost')}</div>
                                    <div className="info-value">{formatCurrency(booking.totalCost)}</div>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <div className="info-label mb-1.5">{t('bookings.progress')}</div>
                                  <div className="progress-container">
                                    <div className="progress-bar">
                                      <div
                                        className="progress-fill"
                                        style={{ width: `${getBookingProgress(booking._id, booking.overallProgress || 0)}%` }}
                                      ></div>
                                    </div>
                                    <span className="progress-text">
                                      {getBookingProgress(booking._id, booking.overallProgress || 0)}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Return Shipping Information */}
                              {(booking.returnTrackingNumber || booking.returnLabelUrl || booking.returnQRCodeUrl) && (
                                <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase flex items-center gap-1">
                                      <Truck className="h-3 w-3" />
                                      {t('bookings.returnShipping')}
                                    </span>
                                    {booking.returnShipmentStatus && (
                                      <Badge className={getReturnShipmentStatusColor(booking.returnShipmentStatus)}>
                                        {t(`status.${booking.returnShipmentStatus}`)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    {booking.returnTrackingNumber && (
                                      <div className="flex items-start gap-2">
                                        <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">{t('bookings.tracking')}:</span>
                                          <span className="font-mono font-semibold text-blue-900 dark:text-blue-200 text-xs">{booking.returnTrackingNumber}</span>
                                        </div>
                                      </div>
                                    )}
                                    {booking.returnLabelUrl && (
                                      <div className="flex items-start gap-2">
                                        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">{t('bookings.label')}:</span>
                                          <button
                                            onClick={() => downloadBookingReturnLabel(booking._id, `ruecksendeetikett-${booking.bookingNumber || booking._id}.pdf`)}
                                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-xs cursor-pointer"
                                          >
                                            {t('common.download')} <Download className="h-2.5 w-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {booking.returnQRCodeUrl && (
                                      <div className="flex items-start gap-2">
                                        <QrCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">{t('bookings.qrCode')}:</span>
                                          <a
                                            href={booking.returnQRCodeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-xs"
                                          >
                                            {t('common.view')} <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                    {booking.returnCreatedAt && (
                                      <div className="flex items-start gap-2">
                                        <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">{t('bookings.created')}:</span>
                                          <span className="font-semibold text-xs">{formatDateTime(booking.returnCreatedAt)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {loadingOrders.has(booking._id) ? (
                                <div className="text-center py-2">
                                  <p className="text-xs text-foreground/60">{t('bookings.loadingOrders')}</p>
                                </div>
                              ) : expandedOrdersData[booking._id] && expandedOrdersData[booking._id].length > 0 ? (
                                <div className="space-y-1.5">
                                  <h4 className="font-semibold text-xs mb-1.5 text-foreground/70">{t('bookings.ordersAndRepairs')}</h4>
                                  <div className="border rounded-md overflow-x-auto overflow-y-hidden orders-sub-table-wrap">
                                    <Table className="text-xs orders-sub-table">
                                      <TableHeader>
                                        <TableRow className="bg-muted/40">
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">{t('bookings.orderNumber')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">{t('bookings.type')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">{t('bookings.device')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">{t('bookings.services')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-center">{t('bookings.progressShort')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">{t('common.status')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-center">{t('bookings.messages')}</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-right">{t('bookings.costShort')}</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {expandedOrdersData[booking._id].map((item: any) => (
                                          <TableRow
                                            key={item.orderId || item._id}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors h-8"
                                            onClick={() => item.orderId && handleViewOrder(item.orderId)}
                                          >
                                            <TableCell className="font-medium py-1 text-xs" data-label="Auftrag">
                                              {item.orderNumber}
                                            </TableCell>
                                            <TableCell className="py-1" data-label="Typ">
                                              {item.isComplaintFollowup ? (
                                                <Badge className="text-xs bg-rose-100 text-rose-800 border border-rose-300">
                                                  {t('bookings.complaintFollowup')}
                                                </Badge>
                                              ) : (
                                                <Badge variant={item.type === 'repair' ? 'default' : 'secondary'} className="text-xs">
                                                  {item.type === 'repair' ? t('bookings.repair') : 'Prod.'}
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-1" data-label="Gerät">
                                              <div className="text-xs text-foreground/80">
                                                {item.type === 'repair' ? (
                                                  <span>{item.device || t('bookings.device')}</span>
                                                ) : (
                                                  <span className="truncate">{item.products?.map((p: any) => p.name).join(', ') || t('bookings.product')}</span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-1" data-label="Services">
                                              <div className="text-xs space-y-0.5">
                                                {item.type === 'repair' && item.services && item.services.length > 0 ? (
                                                  <div>
                                                    {item.services.slice(0, 2).map((service: any, sidx: number) => (
                                                      <div key={sidx} className="text-xs text-foreground/70">
                                                        {service.name}
                                                      </div>
                                                    ))}
                                                    {item.services.length > 2 && (
                                                      <div className="text-xs text-foreground/60">+{item.services.length - 2}</div>
                                                    )}
                                                  </div>
                                                ) : item.type === 'product' && item.products && item.products.length > 0 ? (
                                                  <div className="text-xs text-foreground/70">
                                                    {item.products.length} {t('bookings.items')}
                                                  </div>
                                                ) : (
                                                  <span className="text-xs text-foreground/50">—</span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-center py-1" data-label="Fortschritt">
                                              <div className="flex items-center justify-center gap-1">
                                                <div className="w-12 bg-muted rounded-full h-1">
                                                  <div
                                                    className="bg-primary h-1 rounded-full transition-all"
                                                    style={{ width: `${item.progress || 0}%` }}
                                                  ></div>
                                                </div>
                                                <span className="text-xs font-semibold whitespace-nowrap text-foreground/70">
                                                  {item.progress || 0}%
                                                </span>
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-1" data-label="Status">
                                              <Badge className={`${getOrderStatusColor(item.status || 'pending')} text-xs`}>
                                                {t(`status.${item.status || 'pending'}`)}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-center py-1" data-label="Nachrichten">
                                              {item.orderId && unreadCounts[item.orderId] ? (
                                                <div className="flex items-center justify-center">
                                                  <div className={`
                                                    relative inline-flex items-center justify-center
                                                    w-7 h-7 rounded-full
                                                    ${unreadCounts[item.orderId].senderType === 'staff'
                                                      ? 'bg-orange-500 dark:bg-orange-600'
                                                      : 'bg-blue-500 dark:bg-blue-600'
                                                    }
                                                    text-white font-semibold text-xs
                                                    shadow-lg
                                                    animate-pulse
                                                    hover:scale-110 transition-transform cursor-pointer
                                                  `}
                                                  title={`${unreadCounts[item.orderId].unread} unread message${unreadCounts[item.orderId].unread > 1 ? 's' : ''} from ${unreadCounts[item.orderId].senderType || 'user'}`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.orderId) {
                                                      handleOpenCommunication(item.orderId);
                                                    }
                                                  }}
                                                  >
                                                    {unreadCounts[item.orderId].unread > 99 ? '99+' : unreadCounts[item.orderId].unread}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span className="text-xs text-foreground/40">—</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-xs py-1" data-label="Kosten">
                                              {formatCurrency(item.cost || 0)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>

                                  <div className="orders-sub-cards-mobile">
                                    {expandedOrdersData[booking._id].map((item: any) => (
                                      <div
                                        key={`mobile-${item.orderId || item._id}`}
                                        className="orders-sub-card"
                                      >
                                        <div className="orders-sub-card-head">
                                          <div className="orders-sub-card-order">{item.orderNumber}</div>
                                          <Badge className={`${getOrderStatusColor(item.status || 'pending')} text-xs`}>
                                            {t(`status.${item.status || 'pending'}`)}
                                          </Badge>
                                        </div>

                                        <div className="orders-sub-card-grid">
                                          <div className="orders-sub-card-field">
                                            <span className="orders-sub-card-label">{t('bookings.type')}</span>
                                            <span className="orders-sub-card-value">
                                              {item.isComplaintFollowup
                                                ? t('bookings.complaintFollowup')
                                                : item.type === 'repair'
                                                  ? t('bookings.repair')
                                                  : 'Prod.'}
                                            </span>
                                          </div>

                                          <div className="orders-sub-card-field">
                                            <span className="orders-sub-card-label">{t('bookings.device')}</span>
                                            <span className="orders-sub-card-value orders-sub-card-truncate">
                                              {item.type === 'repair'
                                                ? (item.device || t('bookings.device'))
                                                : (item.products?.map((p: any) => p.name).join(', ') || t('bookings.product'))}
                                            </span>
                                          </div>

                                          <div className="orders-sub-card-field">
                                            <span className="orders-sub-card-label">{t('bookings.services')}</span>
                                            <span className="orders-sub-card-value orders-sub-card-truncate">
                                              {item.type === 'repair' && item.services && item.services.length > 0
                                                ? item.services.map((service: any) => service.name).join(', ')
                                                : item.type === 'product' && item.products && item.products.length > 0
                                                  ? `${item.products.length} ${t('bookings.items')}`
                                                  : '—'}
                                            </span>
                                          </div>

                                          <div className="orders-sub-card-field">
                                            <span className="orders-sub-card-label">{t('bookings.costShort')}</span>
                                            <span className="orders-sub-card-value">{formatCurrency(item.cost || 0)}</span>
                                          </div>
                                        </div>

                                        <div className="orders-sub-card-progress-row">
                                          <span className="orders-sub-card-label">{t('bookings.progressShort')}</span>
                                          <div className="orders-sub-card-progress">
                                            <div
                                              className="orders-sub-card-progress-fill"
                                              style={{ width: `${item.progress || 0}%` }}
                                            ></div>
                                          </div>
                                          <span className="orders-sub-card-progress-text">{item.progress || 0}%</span>
                                        </div>

                                        <div className="orders-sub-card-footer">
                                          <div className="orders-sub-card-messages">
                                            <span className="orders-sub-card-label">{t('bookings.messages')}</span>
                                            {item.orderId && unreadCounts[item.orderId] ? (
                                              <span className="orders-sub-card-message-count">
                                                {unreadCounts[item.orderId].unread > 99 ? '99+' : unreadCounts[item.orderId].unread}
                                              </span>
                                            ) : (
                                              <span className="orders-sub-card-message-count orders-sub-card-message-empty">0</span>
                                            )}
                                          </div>

                                          <div className="orders-sub-card-actions">
                                            {item.orderId && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-[11px] px-2"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenCommunication(item.orderId);
                                                }}
                                              >
                                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                Chat
                                              </Button>
                                            )}

                                            {item.orderId && (
                                              <Button
                                                size="sm"
                                                className="h-7 text-[11px] px-2"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleViewOrder(item.orderId);
                                                }}
                                              >
                                                <Eye className="h-3.5 w-3.5 mr-1" />
                                                {t('common.view')}
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-2">
                                  <p className="text-xs text-foreground/60">No associated orders found</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
              </div>

            {/* Pagination Controls */}
            {filteredBookings.length > 0 && totalBookings > itemsPerPage && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-3 border-t border-slate-100 bg-slate-50">
                <div className="text-sm text-slate-600">
                  {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalBookings)} of {totalBookings}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Per page:</label>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-20 text-sm border-slate-200 focus:border-[#f5b800] focus:ring-[#f5b800]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-sm border-slate-200 hover:bg-slate-100"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Prev
                    </Button>

                    {Array.from({ length: Math.ceil(totalBookings / itemsPerPage) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = Math.ceil(totalBookings / itemsPerPage);
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, array) => {
                        const prevPage = array[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-2 text-slate-400">…</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className={currentPage === page 
                                ? "h-9 w-9 p-0 bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] text-white" 
                                : "h-9 w-9 p-0 border-slate-200 hover:bg-slate-100"
                              }
                              onClick={() => setCurrentPage(page)}
                              disabled={loading}
                            >
                              {page}
                            </Button>
                          </React.Fragment>
                        );
                      })}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-sm border-slate-200 hover:bg-slate-100"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalBookings / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(totalBookings / itemsPerPage) || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

      {/* Booking Detail Dialog */}
      {selectedBooking && (
        <BookingDetailDialog
          booking={selectedBooking}
          open={showDetailDialog}
          onClose={() => {
            setShowDetailDialog(false);
            setSelectedBooking(null);
          }}
          navigate={navigate}
          location={location}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          getStatusColor={getStatusColor}
          getBillingStatusColor={getBillingStatusColor}
          getReturnShipmentStatusColor={getReturnShipmentStatusColor}
        />
      )}

      {/* Communication Panel Dialog */}
      {selectedOrderForCommunication && (
        <Dialog open={showCommunicationPanel} onOpenChange={(open) => {
          setShowCommunicationPanel(open);
          if (!open) {
            setSelectedOrderForCommunication(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('bookings.orderCommunication')}
              </DialogTitle>
              <DialogDescription>
                {t('bookings.communicateWithSupport')}
              </DialogDescription>
            </DialogHeader>
            <CommunicationPanel orderId={selectedOrderForCommunication} />
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}

// Detailed Booking Dialog Component for Customers
interface BookingDetailDialogProps {
  booking: Booking;
  open: boolean;
  onClose: () => void;
  navigate: any;
  location: ReturnType<typeof useLocation>;
  formatCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
  formatDateTime: (dateString: string) => string;
  getStatusColor: (status: string) => string;
  getBillingStatusColor: (status: string) => string;
  getReturnShipmentStatusColor: (status: string) => string;
}

function BookingDetailDialog({
  booking,
  open,
  onClose,
  navigate,
  location,
  formatCurrency,
  formatDate,
  formatDateTime,
  getStatusColor,
  getBillingStatusColor,
  getReturnShipmentStatusColor
}: BookingDetailDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [repairModelImages, setRepairModelImages] = useState<Record<string, string>>({});
  const [repairImageLoadErrors, setRepairImageLoadErrors] = useState<Record<string, boolean>>({});
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [loadingRepairJobs, setLoadingRepairJobs] = useState(false);;

  const repairItems = (booking.items || []).filter((item) => item.type === 'repair');

  const getEffectivePaymentStatus = (currentBooking: Booking) => {
    const invoiceStatuses = ['draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue'];
    const candidate = String(currentBooking.paymentStatus || '');
    return invoiceStatuses.includes(candidate) ? candidate : currentBooking.billingStatus;
  };

  const getBillingStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Vorlage';
      case 'sent':
        return 'Gesendet';
      case 'viewed':
        return 'Angesehen';
      case 'partially_paid':
        return 'Teilweise Bezahlt';
      case 'overdue':
        return 'Ueberfaellig';
      case 'unpaid':
        return 'Offen';
      case 'partially-paid':
        return 'Teilbezahlt';
      case 'paid':
        return 'Bezahlt';
      default:
        return status;
    }
  };

  const getRepairImageKey = (item: Booking['items'][number], index: number) => {
    return String(item.orderId || item._id || `${item.device || 'repair'}-${index}`);
  };

  const normalizeDeviceText = (value: string = '') => value.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizeDeviceTextCompact = (value: string = '') => normalizeDeviceText(value).replace(/[^a-z0-9]/g, '');

  const parseDeviceLabel = (label: string = '') => {
    const normalized = label.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return { brand: '', model: '' };
    }

    const parts = normalized.split(' ');
    if (parts.length < 2) {
      return { brand: normalized, model: '' };
    }

    return {
      brand: parts[0],
      model: parts.slice(1).join(' '),
    };
  };

  useEffect(() => {
    let isCancelled = false;

    const resolveRepairModelImages = async () => {
      if (!open || !repairItems.length) {
        setRepairModelImages({});
        setRepairImageLoadErrors({});
        return;
      }

      const nextImages: Record<string, string> = {};

      for (let index = 0; index < repairItems.length; index += 1) {
        const item = repairItems[index];
        const imageKey = getRepairImageKey(item, index);
        const { brand, model } = parseDeviceLabel(item.device || '');

        const queryCandidates = [
          `${brand} ${model}`.trim(),
          model,
          model.replace(/([a-zA-Z])([0-9])/g, '$1 $2').trim(),
          model.replace(/\s+/g, '').trim(),
          item.device || '',
        ]
          .map((candidate) => candidate.trim())
          .filter((candidate, candidateIndex, all) => candidate.length > 0 && all.indexOf(candidate) === candidateIndex);

        let devices: SearchResult[] = [];
        for (const query of queryCandidates) {
          try {
            const response = await searchDevices(query);
            const foundDevices: SearchResult[] = ((response as any)?.devices || []) as SearchResult[];
            if (foundDevices.length > 0) {
              devices = foundDevices;
              break;
            }
          } catch (searchError) {
            console.error('CustomerBookings: Failed to resolve device image from search query:', query, searchError);
          }
        }

        const normalizedBrand = normalizeDeviceText(brand);
        const normalizedModel = normalizeDeviceText(model);
        const compactModel = normalizeDeviceTextCompact(model);

        const exactBrandAndModel = devices.find((device) => {
          const name = normalizeDeviceText(device.name);
          const compactName = normalizeDeviceTextCompact(device.name);
          const manufacturer = normalizeDeviceText(device.manufacturer);
          return Boolean(device.image) && (name === normalizedModel || (compactModel && compactName === compactModel)) && (!normalizedBrand || manufacturer === normalizedBrand);
        });

        const sameModel = devices.find((device) => {
          const name = normalizeDeviceText(device.name);
          const compactName = normalizeDeviceTextCompact(device.name);
          return Boolean(device.image) && (name === normalizedModel || (compactModel && compactName === compactModel));
        });

        const fuzzyMatch = devices.find((device) => {
          const name = normalizeDeviceText(device.name);
          const displayName = normalizeDeviceText(device.displayName);
          const compactName = normalizeDeviceTextCompact(device.name);
          const compactDisplayName = normalizeDeviceTextCompact(device.displayName);
          return Boolean(device.image) && (
            displayName.includes(normalizedModel) ||
            normalizedModel.includes(name) ||
            (compactModel ? compactDisplayName.includes(compactModel) || compactModel.includes(compactName) : false)
          );
        });

        const bestMatch = exactBrandAndModel || sameModel || fuzzyMatch || devices.find((device) => Boolean(device.image));
        if (bestMatch?.image) {
          nextImages[imageKey] = bestMatch.image;
        }
      }

      if (!isCancelled) {
        setRepairModelImages(nextImages);
        setRepairImageLoadErrors({});
      }
    };

    resolveRepairModelImages();

    return () => {
      isCancelled = true;
    };
  }, [open, booking._id, repairItems.length]);

  // Load detailed order data (status + progress) via getBookingOrders
  useEffect(() => {
    if (!open) {
      setDetailOrders([]);
      return;
    }
    let isMounted = true;
    setLoadingRepairJobs(true);
    getBookingOrders(booking._id)
      .then((res: any) => {
        if (isMounted) setDetailOrders(res.orders || []);
      })
      .catch(() => {
        if (isMounted) setDetailOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoadingRepairJobs(false);
      });
    return () => { isMounted = false; };
  }, [open, booking._id]);

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Ausstehend';
      case 'diagnostic-assessment': return 'Diagnosebewertung';
      case 'diagnosed': return 'Diagnose abgeschlossen';
      case 'awaiting-parts': return 'Wartet auf Teile';
      case 'in-progress': return 'Reparatur läuft';
      case 'paused': return 'Pausiert';
      case 'on-hold': return 'Angehalten';
      case 'quality-check': return 'Qualitätsprüfung';
      case 'ready-for-pickup': return 'Abholbereit';
      case 'completed': return 'Abgeschlossen';
      case 'cancelled': return 'Storniert';
      default: return status;
    }
  };

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'diagnostic-assessment': return 'bg-purple-100 text-purple-800 border border-purple-300';
      case 'diagnosed': return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
      case 'awaiting-parts': return 'bg-orange-100 text-orange-800 border border-orange-300';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border border-blue-300';
      case 'paused': return 'bg-gray-100 text-gray-700 border border-gray-300';
      case 'on-hold': return 'bg-gray-100 text-gray-700 border border-gray-300';
      case 'quality-check': return 'bg-cyan-100 text-cyan-800 border border-cyan-300';
      case 'ready-for-pickup': return 'bg-teal-100 text-teal-800 border border-teal-300';
      case 'completed': return 'bg-green-100 text-green-800 border border-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border border-red-300';
      default: return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  const hasOutboundShipping = Boolean(
    booking.trackingNumber ||
    booking.shippingLabelUrl ||
    booking.shippingStatus ||
    booking.shippingCreatedAt ||
    booking.estimatedDelivery ||
    booking.actualDelivery
  );
  const hasReturnShipping = Boolean(
    booking.returnTrackingNumber ||
    booking.returnLabelUrl ||
    booking.returnQRCodeUrl ||
    booking.returnShipmentStatus ||
    booking.returnCreatedAt ||
    booking.returnReceivedAt
  );

  const handleViewOrder = (orderId: string) => {
    if (!orderId) {
      console.warn("No order ID provided for navigation");
      return;
    }
    navigate(getOrderDetailsPath(orderId), {
      state: buildOrderDetailsState(location, {
        label: t('common.back'),
        restoreState: { reopenBookingDialog: booking._id },
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="booking-detail-dialog-content max-w-[95vw] sm:max-w-2xl my-0 sm:my-3 max-h-dvh sm:max-h-[92vh] p-0 gap-0 overflow-hidden border-none rounded-[16px] sm:rounded-[24px] shadow-[0_20px_60px_rgba(26,42,94,0.3)] flex flex-col [&>button]:hidden">
        <DialogHeader className="booking-detail-dialog-header">
          <div className="booking-detail-dialog-header-bg-orb booking-detail-dialog-header-bg-orb--top" />
          <div className="booking-detail-dialog-header-bg-orb booking-detail-dialog-header-bg-orb--bottom" />

          <div className="booking-detail-dialog-header-content">
            <button
              onClick={onClose}
              className="booking-detail-dialog-close-x"
              aria-label="Schließen"
            >
              <X size={22} />
            </button>
            <DialogTitle className="booking-detail-dialog-title">
              Buchungsdetails
            </DialogTitle>
            <DialogDescription className="booking-detail-dialog-description">
              {booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`}
            </DialogDescription>

            <div className="booking-detail-dialog-meta-grid">
              <div className="booking-detail-dialog-meta-item">
                <p>Erstellt</p>
                <strong>{formatDate(booking.createdAt)}</strong>
              </div>
              <div className="booking-detail-dialog-meta-item">
                <p>Aktualisiert</p>
                <strong>{formatDate(booking.updatedAt)}</strong>
              </div>
              <div className="booking-detail-dialog-meta-item">
                <p>Gesamt</p>
                <strong>{formatCurrency(booking.totalCost)}</strong>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="booking-detail-dialog-body">
          <div className="booking-detail-dialog-inner">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-0">
          {(() => {
            const activeStyle = { background: "linear-gradient(135deg, #f5b800 0%, #e5ab00 100%)", color: "#1a2a5e" } as const;
            const inactiveStyle = { background: "transparent", color: "rgb(245, 185, 0)" } as const;
            const tabStyle = (val: string) => activeTab === val ? activeStyle : inactiveStyle;
            return (
          <TabsList className="booking-detail-tabs-list">
            <TabsTrigger value="overview" className="booking-detail-tab-trigger" style={tabStyle("overview")}>
              Übersicht
            </TabsTrigger>
            <TabsTrigger value="repairs" className="booking-detail-tab-trigger" style={tabStyle("repairs")}>
              Repara&shy;turen
            </TabsTrigger>
            <TabsTrigger value="items" className="booking-detail-tab-trigger" style={tabStyle("items")}>
              Artikel
            </TabsTrigger>
            <TabsTrigger value="shipping" className="booking-detail-tab-trigger" style={tabStyle("shipping")}>
              Versand
            </TabsTrigger>
            <TabsTrigger value="timeline" className="booking-detail-tab-trigger" style={tabStyle("timeline")}>
              {t('bookings.timeline')}
            </TabsTrigger>
          </TabsList>
            );
          })()}

          <TabsContent value="overview" className="space-y-3 sm:space-y-5 mt-3 sm:mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <div className="bg-white rounded-lg p-3 sm:p-5 shadow-md border border-[var(--gray-200,#d8dce6)]">
                <h3 className="font-bold text-xs sm:text-sm mb-2 sm:mb-3 text-[var(--primary-blue,#1a2a5e)] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                  Kunde
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Avatar className="h-9 w-9 sm:h-12 sm:w-12 border-2 border-[var(--accent-yellow,#f5b800)] flex-shrink-0">
                      <AvatarImage src={booking.customerId.avatar} />
                      <AvatarFallback className="text-xs sm:text-sm font-bold bg-[var(--primary-blue,#1a2a5e)] text-white">
                        {(booking.customerId.firstName || booking.customerId.name || booking.customerId.email).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-[var(--gray-800,#1a202c)] truncate">
                        {booking.customerId.firstName ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}` : (booking.customerId.name || booking.customerId.email)}
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--gray-500,#636e85)] truncate">{booking.customerId.email}</p>
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                    <span className="text-[var(--gray-600,#4a5568)] font-semibold">Telefon: </span>
                    <span className="font-semibold text-[var(--gray-800,#1a202c)]">{booking.customerId.phone || 'Nicht verfügbar'}</span>
                  </div>

                  {/* Billing address */}
                  {(() => {
                    const hasAddressData = (addr?: AddressFields | null) => Boolean(
                      addr && (addr.street || addr.city || addr.zipCode || addr.state || addr.country)
                    );
                    const firstOrder = Array.isArray(booking.orderIds)
                      ? booking.orderIds.find((order) => order && typeof order === 'object')
                      : undefined;
                    const addr = booking.customerId?.invoiceAddress
                      || booking.billingAddress
                      || booking.guestInfo?.billingAddress
                      || firstOrder?.billingAddress
                      || firstOrder?.guestInfo?.billingAddress;
                    const hasAddr = hasAddressData(addr);
                    return (
                      <div className="pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <CreditCard className="h-3.5 w-3.5 text-[var(--primary-blue,#1a2a5e)]" />
                          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[var(--gray-500,#636e85)]">Rechnungsadresse</p>
                        </div>
                        {hasAddr ? (
                          <div className="text-xs sm:text-sm space-y-0.5 text-[var(--gray-700,#2d3748)]">
                            {addr!.street && <p>{addr!.street}</p>}
                            {(addr!.zipCode || addr!.city) && <p>{[addr!.zipCode, addr!.city].filter(Boolean).join(' ')}</p>}
                            {addr!.country && <p className="text-[var(--gray-400,#8892a8)] text-[10px]">{addr!.country}</p>}
                          </div>
                        ) : (
                          <p className="text-xs italic text-[var(--gray-400,#8892a8)]">Nicht angegeben</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Delivery address */}
                  {(() => {
                    const hasAddressData = (addr?: AddressFields | null) => Boolean(
                      addr && (addr.street || addr.city || addr.zipCode || addr.state || addr.country)
                    );
                    const firstOrder = Array.isArray(booking.orderIds)
                      ? booking.orderIds.find((order) => order && typeof order === 'object')
                      : undefined;
                    const payAddr = booking.customerId?.paymentAddress;
                    const billAddr = booking.customerId?.invoiceAddress
                      || booking.billingAddress
                      || booking.guestInfo?.billingAddress
                      || firstOrder?.billingAddress
                      || firstOrder?.guestInfo?.billingAddress;
                    const deliveryAddr = payAddr?.sameAsInvoice === false
                      ? payAddr
                      : booking.shippingAddress
                        || booking.guestInfo?.shippingAddress
                        || firstOrder?.shippingAddress
                        || firstOrder?.guestInfo?.shippingAddress;
                    const hasBillAddr = hasAddressData(billAddr);
                    const sameAsInvoice = payAddr?.sameAsInvoice !== false && !hasAddressData(deliveryAddr);
                    if (sameAsInvoice) {
                      return (
                        <div className="pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Home className="h-3.5 w-3.5 text-[var(--primary-blue,#1a2a5e)]" />
                            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[var(--gray-500,#636e85)]">Lieferadresse</p>
                          </div>
                          {hasBillAddr ? (
                            <p className="text-xs italic text-[var(--gray-400,#8892a8)]">Identisch mit Rechnungsadresse</p>
                          ) : (
                            <p className="text-xs italic text-[var(--gray-400,#8892a8)]">Nicht angegeben</p>
                          )}
                        </div>
                      );
                    }
                    const hasPayAddr = hasAddressData(deliveryAddr);
                    return (
                      <div className="pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Home className="h-3.5 w-3.5 text-[var(--primary-blue,#1a2a5e)]" />
                          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[var(--gray-500,#636e85)]">Lieferadresse</p>
                        </div>
                        {hasPayAddr ? (
                          <div className="text-xs sm:text-sm space-y-0.5 text-[var(--gray-700,#2d3748)]">
                            {deliveryAddr!.street && <p>{deliveryAddr!.street}</p>}
                            {(deliveryAddr!.zipCode || deliveryAddr!.city) && <p>{[deliveryAddr!.zipCode, deliveryAddr!.city].filter(Boolean).join(' ')}</p>}
                            {deliveryAddr!.country && <p className="text-[var(--gray-400,#8892a8)] text-[10px]">{deliveryAddr!.country}</p>}
                          </div>
                        ) : (
                          <p className="text-xs italic text-[var(--gray-400,#8892a8)]">Nicht angegeben</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 sm:p-5 shadow-md border border-[var(--gray-200,#d8dce6)]">
                <h3 className="font-bold text-xs sm:text-sm mb-2 sm:mb-3 text-[var(--primary-blue,#1a2a5e)] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                  Status
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  <div>
                    <p className="text-[10px] sm:text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-1 sm:mb-2 uppercase">Aktuell</p>
                    <Badge className={`${getStatusColor(booking.status)} text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1`}>{t(`status.${booking.status}`)}</Badge>
                  </div>
                  <div className="pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                    <p className="text-[10px] sm:text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-1 sm:mb-2 uppercase">Abrechnung</p>
                    <Badge className={`${getBillingStatusColor(getEffectivePaymentStatus(booking))} text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1`}>{getBillingStatusLabel(getEffectivePaymentStatus(booking))}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-5">
              <div className="bg-gradient-to-br from-[var(--primary-blue,#1a2a5e)] to-[var(--primary-blue-light,#2a3f7e)] rounded-lg p-2 sm:p-5 shadow-lg text-white min-w-0 overflow-hidden">
                <p className="text-[10px] sm:text-sm font-semibold opacity-90 mb-0.5 sm:mb-1">Gesamtkosten</p>
                <p className="text-base sm:text-3xl font-extrabold tracking-tight truncate">{formatCurrency(booking.totalCost)}</p>
              </div>
              <div className="bg-gradient-to-br from-[var(--accent-yellow,#f5b800)] to-[var(--accent-yellow-hover,#e5ab00)] rounded-lg p-2 sm:p-5 shadow-lg text-[var(--primary-blue,#1a2a5e)] min-w-0 overflow-hidden">
                <p className="text-[10px] sm:text-sm font-semibold opacity-90 mb-0.5 sm:mb-1">Artikel</p>
                <p className="text-base sm:text-3xl font-extrabold tracking-tight">{booking.items.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 sm:p-5 shadow-md border border-[var(--gray-200,#d8dce6)]">
              <p className="text-xs sm:text-sm text-[var(--primary-blue,#1a2a5e)] mb-2 sm:mb-3 font-bold uppercase tracking-wide flex items-center gap-2">
                <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                Zeitstempel
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2 bg-[var(--gray-50,#f5f6f8)] p-2 sm:p-3 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <span className="text-[var(--gray-600,#4a5568)]">Erstellt: </span>
                    <span className="font-bold text-[var(--gray-800,#1a202c)] break-words">{formatDateTime(booking.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-[var(--gray-50,#f5f6f8)] p-2 sm:p-3 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <div className="min-w-0">
                    <span className="text-[var(--gray-600,#4a5568)]">Aktualisiert: </span>
                    <span className="font-bold text-[var(--gray-800,#1a202c)] break-words">{formatDateTime(booking.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="repairs" className="space-y-3 mt-3 sm:mt-5">
            {loadingRepairJobs ? (
              <div className="text-center py-12 bg-white rounded-lg border border-[var(--gray-200,#d8dce6)]">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary-blue,#1a2a5e)] border-t-transparent mb-2" />
                <p className="text-[var(--gray-400,#8892a8)] text-sm">Reparaturaufträge werden geladen...</p>
              </div>
            ) : (() => {
              const repairJobs = detailOrders.filter((o: any) => o.type === 'repair');
              const displayItems: any[] = repairJobs.length > 0 ? repairJobs : repairItems;

              if (displayItems.length === 0) {
                return (
                  <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-[var(--gray-300,#b0b8c9)]">
                    <Wrench className="h-8 w-8 mx-auto mb-2 text-[var(--gray-300,#c5cad8)]" />
                    <p className="text-[var(--gray-500,#636e85)] text-base font-semibold">Keine Reparaturaufträge</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayItems.map((item: any, index: number) => {
                    const imageKey = String(item.orderId || item._id || `${item.device || 'repair'}-${index}`);
                    const modelImage = repairModelImages[imageKey];
                    const showModelImage = Boolean(modelImage) && !repairImageLoadErrors[imageKey];
                    const progress = item.progress ?? 0;
                    const statusLabel = getOrderStatusLabel(item.status || 'pending');
                    const badgeClass = getOrderStatusBadgeClass(item.status || 'pending');

                    return (
                      <div
                        key={item._id || item.orderId || index}
                        className="bg-white rounded-xl border border-[var(--gray-200,#d8dce6)] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                        style={{ borderLeft: '4px solid var(--primary-blue, #1a2a5e)' }}
                        onClick={() => item.orderId && handleViewOrder(item.orderId)}
                      >
                        {/* Header */}
                        <div className="flex items-start gap-3 p-3 sm:p-4">
                          {/* Device image / icon */}
                          <div className="flex-shrink-0">
                            {showModelImage ? (
                              <img
                                src={modelImage}
                                alt={item.device || 'Gerät'}
                                className="booking-detail-repair-device-image"
                                onError={() => setRepairImageLoadErrors((prev) => ({ ...prev, [imageKey]: true }))}
                              />
                            ) : (
                              <div className="booking-detail-repair-device-placeholder" aria-hidden="true">
                                <Smartphone className="h-5 w-5" />
                              </div>
                            )}
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                {(item.orderNumber || item.orderId) && (
                                  <p className="text-[10px] sm:text-xs flex items-center gap-1 text-[var(--gray-400,#8892a8)] mb-0.5">
                                    <Hash className="h-2.5 w-2.5" />
                                    {item.orderNumber ? `Auftrag #${item.orderNumber}` : `Auftrag ${item.orderId.slice(-8).toUpperCase()}`}
                                  </p>
                                )}
                                <h4 className="font-bold text-sm sm:text-base text-[var(--gray-800,#1a202c)] truncate">
                                  {item.device || 'Gerät Reparatur'}
                                </h4>
                                {item.services && item.services.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.services.map((s: any, si: number) => (
                                      <span key={si} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#eef2ff', color: 'var(--primary-blue, #1a2a5e)', border: '1px solid #c7d2fe' }}>
                                        {s.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <Badge className={`${badgeClass} text-[10px] sm:text-xs font-bold px-2 py-0.5`}>
                                  {statusLabel}
                                </Badge>
                                <p className="font-bold text-sm sm:text-base text-[var(--primary-blue,#1a2a5e)] mt-1">{formatCurrency(item.cost)}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="px-3 sm:px-4 py-2 sm:py-3" style={{ background: '#f8faff', borderTop: '1px solid #eceef3' }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3 w-3 text-[var(--primary-blue,#1a2a5e)]" />
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-500,#636e85)]">Fortschritt</span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: progress === 100 ? '#38a169' : 'var(--primary-blue, #1a2a5e)' }}>
                              {progress}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-[var(--gray-200,#d8dce6)]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progress}%`,
                                background: progress === 100
                                  ? '#38a169'
                                  : progress >= 75
                                  ? 'var(--primary-blue, #1a2a5e)'
                                  : progress >= 40
                                  ? 'var(--accent-yellow, #f5b800)'
                                  : '#fc8181',
                              }}
                            />
                          </div>
                        </div>

                        {/* Footer CTA */}
                        {item.orderId && (
                          <div className="px-3 sm:px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #eceef3' }}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2"
                              style={{ color: 'var(--primary-blue, #1a2a5e)' }}
                              onClick={(e) => { e.stopPropagation(); handleViewOrder(item.orderId); }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Auftrag öffnen
                            </Button>
                            <ExternalLink className="h-3 w-3 text-[var(--gray-400,#8892a8)]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="items" className="space-y-3 mt-3 sm:mt-5">
            {booking.items && booking.items.filter(item => item.type === 'product').length > 0 ? (
              <div className="space-y-3">
                {booking.items.filter(item => item.type === 'product').map((item) => (
                  <div key={item._id || item.orderId} className="booking-detail-order-card bg-white border-2 border-[var(--gray-200,#d8dce6)] rounded-lg p-3 sm:p-4 shadow-md">
                    <div className="flex items-center justify-between mb-2 sm:mb-3 pb-2 sm:pb-3 border-b-2 border-[var(--accent-yellow,#f5b800)]">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-[var(--primary-blue,#1a2a5e)]">Produkt</h4>
                        {item.orderId && (
                          <p className="booking-detail-order-number">Auftrag {item.orderId.slice(-8).toUpperCase()}</p>
                        )}
                      </div>
                      <Badge className={`${getStatusColor(item.status || 'pending')} text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1`}>
                        {item.status || 'pending'}
                      </Badge>
                    </div>
                    {item.products && item.products.length > 0 ? (
                      <div className="space-y-2">
                        {item.products.map((product, idx) => (
                          <div key={idx} className="booking-detail-product-row flex justify-between items-center gap-2 text-xs sm:text-sm p-2 sm:p-3 bg-[var(--gray-50,#f5f6f8)] rounded-lg border-l-4 border-[var(--primary-blue,#1a2a5e)]">
                            <div className="min-w-0">
                              <p className="font-bold text-[var(--gray-800,#1a202c)] truncate">{product.name}</p>
                              <p className="text-[11px] sm:text-sm text-[var(--gray-600,#4a5568)] mt-0.5">
                                Menge: {product.quantity} × {formatCurrency(product.price)}
                              </p>
                            </div>
                            <p className="booking-detail-product-price font-extrabold text-sm sm:text-base text-[var(--primary-blue,#1a2a5e)] flex-shrink-0">{formatCurrency(product.totalPrice)}</p>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-xs sm:text-sm mt-3 sm:mt-4 pt-2 sm:pt-3 border-t-2 border-[var(--gray-300,#b0b8c9)] font-bold">
                          <span className="text-[var(--gray-700,#2d3748)] uppercase tracking-wide">Gesamt:</span>
                          <span className="text-sm sm:text-lg text-[var(--primary-blue,#1a2a5e)]">{formatCurrency(item.cost)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-[var(--gray-500,#636e85)] text-center py-3">Keine Produkte</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-[var(--gray-300,#b0b8c9)]">
                <p className="text-[var(--gray-500,#636e85)] text-base font-semibold">Keine Produktartikel</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="shipping" className="space-y-3 sm:space-y-4 mt-3 sm:mt-5">
            {(hasOutboundShipping || hasReturnShipping) ? (
              <div className="space-y-4">
                {hasOutboundShipping && (
                <div className="bg-white p-3 sm:p-5 rounded-lg border-2 border-[var(--primary-blue,#1a2a5e)] shadow-md">
                  <div className="flex items-center justify-between flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-[var(--accent-yellow,#f5b800)]">
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-1 sm:gap-2 text-[var(--primary-blue,#1a2a5e)]">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--accent-yellow,#f5b800)] flex-shrink-0" />
                      Versand an McRepair
                    </h3>
                    {booking.shippingStatus && (
                      <Badge className="bg-blue-100 text-[var(--primary-blue,#1a2a5e)] border border-blue-300 text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 flex-shrink-0">
                        {booking.shippingStatus}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {booking.trackingNumber && (
                      <div className="bg-[var(--gray-50,#f5f6f8)] rounded-lg p-3 sm:p-4 border border-[var(--gray-200,#d8dce6)]">
                        <p className="text-[10px] sm:text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-1 sm:mb-2 uppercase">Trackingnummer</p>
                        <p className="font-mono font-bold text-sm sm:text-base text-[var(--primary-blue,#1a2a5e)] break-all">{booking.trackingNumber}</p>
                        {booking.carrier && (
                          <p className="text-sm font-medium text-[var(--gray-600,#4a5568)] mt-2">Versanddienst: {booking.carrier}</p>
                        )}
                      </div>
                    )}

                    {booking.shippingLabelUrl && (
                      <div className="bg-[var(--gray-50,#f5f6f8)] rounded-lg p-4 border border-[var(--gray-200,#d8dce6)]">
                        <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Generiertes Versandlabel an McRepair</p>
                        <button
                          onClick={() => downloadBookingShippingLabel(booking._id, `versandlabel-buchung-${booking.bookingNumber || booking._id}.pdf`)}
                          className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-[var(--primary-blue,#1a2a5e)] text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-[var(--primary-blue-dark,#0f1d45)] transition-all hover:shadow-lg cursor-pointer"
                        >
                          <Download className="h-4 w-4 flex-shrink-0" />
                          <span>Versandlabel herunterladen (PDF)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {(booking.shippingCreatedAt || booking.estimatedDelivery || booking.actualDelivery || booking.shippingStatusDescription) && (
                    <div className="mt-4 pt-4 border-t border-[var(--gray-200,#d8dce6)] space-y-2">
                      {booking.shippingStatusDescription && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Statusinfo: </span>
                          {booking.shippingStatusDescription}
                        </p>
                      )}
                      {booking.liveShippingTracking?.statusCodeRaw && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">DHL Live-Statuscode: </span>
                          {booking.liveShippingTracking.statusCodeRaw}
                        </p>
                      )}
                      {booking.liveShippingTracking?.service && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Service: </span>
                          {booking.liveShippingTracking.service}
                        </p>
                      )}
                      {booking.liveShippingTracking?.shipmentId && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Shipment-ID: </span>
                          {booking.liveShippingTracking.shipmentId}
                        </p>
                      )}
                      {booking.shippingCreatedAt && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Label erstellt: </span>
                          {formatDateTime(booking.shippingCreatedAt)}
                        </p>
                      )}
                      {booking.estimatedDelivery && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Voraussichtl. Ankunft: </span>
                          {formatDateTime(booking.estimatedDelivery)}
                        </p>
                      )}
                      {booking.actualDelivery && (
                        <p className="text-xs sm:text-sm text-[var(--gray-700,#2d3748)] break-words">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Eingetroffen am: </span>
                          {formatDateTime(booking.actualDelivery)}
                        </p>
                      )}
                    </div>
                  )}

                  {booking.liveShippingTracking?.events && booking.liveShippingTracking.events.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--gray-200,#d8dce6)]">
                      <p className="text-xs sm:text-sm font-semibold text-[var(--gray-600,#4a5568)] mb-2 uppercase">DHL Live-Tracking Events</p>
                      <div className="space-y-2 max-h-56 overflow-auto">
                        {booking.liveShippingTracking.events.slice(0, 10).map((event, idx) => (
                          <div key={`${event.timestamp || 'no-time'}-${idx}`} className="rounded-lg p-2 sm:p-3 bg-[var(--gray-50,#f5f6f8)] border border-[var(--gray-200,#d8dce6)]">
                            <p className="text-xs sm:text-sm font-semibold text-[var(--gray-800,#1a202c)]">
                              {event.description || event.status || 'Statusupdate'}
                            </p>
                            <p className="text-[11px] sm:text-xs text-[var(--gray-600,#4a5568)] mt-1 break-words">
                              {event.timestamp ? formatDateTime(event.timestamp) : 'Zeit unbekannt'}
                              {event.location ? ` • ${event.location}` : ''}
                              {event.statusCode ? ` • ${event.statusCode}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {hasReturnShipping && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-5 rounded-lg border-2 border-[var(--primary-blue,#1a2a5e)] shadow-md">
                  <div className="flex items-center justify-between flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-[var(--accent-yellow,#f5b800)]">
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-1 sm:gap-2 text-[var(--primary-blue,#1a2a5e)]">
                      <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--accent-yellow,#f5b800)] flex-shrink-0" />
                      Rücksendung
                    </h3>
                    {booking.returnShipmentStatus && (
                      <Badge className={`${getReturnShipmentStatusColor(booking.returnShipmentStatus)} text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 flex-shrink-0`}>
                        {t(`status.${booking.returnShipmentStatus}`)}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4">
                    {booking.returnTrackingNumber && (
                      <div className="bg-white rounded-lg p-4 border-l-4 border-[var(--primary-blue,#1a2a5e)]">
                        <div className="flex items-start gap-3">
                          <Package className="h-5 w-5 text-[var(--primary-blue,#1a2a5e)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Sendungsverfolgung</p>
                            <p className="font-mono font-bold text-sm sm:text-base text-[var(--primary-blue,#1a2a5e)] break-all">
                              {booking.returnTrackingNumber}
                            </p>
                            {booking.returnShipmentStatusDescription && (
                              <p className="text-sm text-[var(--gray-600,#4a5568)] mt-2">
                                {booking.returnShipmentStatusDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.returnLabelUrl && (
                      <div className="bg-white rounded-lg p-4 border-l-4 border-[var(--accent-yellow,#f5b800)]">
                        <div className="flex items-start gap-3">
                          <FileText className="h-5 w-5 text-[var(--accent-yellow,#f5b800)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Versandetikett</p>
                            <button
                              onClick={() => downloadBookingReturnLabel(booking._id, `ruecksendeetikett-${booking.bookingNumber || booking._id}.pdf`)}
                              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-[var(--primary-blue,#1a2a5e)] text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-[var(--primary-blue-dark,#0f1d45)] transition-all hover:shadow-lg cursor-pointer"
                            >
                              <FileText className="h-4 w-4 flex-shrink-0" />
                              <span>PDF Herunterladen</span>
                              <Download className="h-4 w-4 flex-shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.returnQRCodeUrl && (
                      <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                        <div className="flex items-start gap-3">
                          <QrCode className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">QR Code</p>
                            <a
                              href={booking.returnQRCodeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-green-700 transition-all hover:shadow-lg"
                            >
                              <QrCode className="h-4 w-4 flex-shrink-0" />
                              <span>Code Anzeigen</span>
                              <ExternalLink className="h-4 w-4 flex-shrink-0" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {(booking.returnCreatedAt || booking.returnReceivedAt) && (
                      <div className="bg-white rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-[var(--primary-blue,#1a2a5e)] mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-3 uppercase">Zeitlinie</p>
                            <div className="space-y-2 text-sm">
                              {booking.returnCreatedAt && (
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 bg-[var(--gray-50,#f5f6f8)] p-2 rounded-lg">
                                  <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
                                  <span className="text-[var(--gray-600,#4a5568)] font-semibold text-xs sm:text-sm">Erstellt:</span>
                                  <span className="font-bold text-[var(--gray-800,#1a202c)] text-xs sm:text-sm break-all">{formatDateTime(booking.returnCreatedAt)}</span>
                                </div>
                              )}
                              {booking.returnReceivedAt && (
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 bg-green-50 p-2 rounded-lg">
                                  <div className="w-3 h-3 rounded-full bg-green-600 flex-shrink-0"></div>
                                  <span className="text-[var(--gray-600,#4a5568)] font-semibold text-xs sm:text-sm">Erhalten:</span>
                                  <span className="font-bold text-[var(--gray-800,#1a202c)] text-xs sm:text-sm break-all">{formatDateTime(booking.returnReceivedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                <div className="bg-[var(--accent-yellow-light,#ffd54f)]/20 p-5 rounded-lg border-2 border-[var(--accent-yellow,#f5b800)]">
                  <h4 className="font-bold mb-3 text-[var(--primary-blue,#1a2a5e)] uppercase tracking-wide text-sm flex items-center gap-2">
                    <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                    Anweisungen
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-[var(--gray-700,#2d3748)] text-sm font-medium">
                    <li>Etikett drucken oder QR-Code speichern</li>
                    <li>Artikel sicher verpacken</li>
                    <li>Etikett befestigen oder QR-Code bei DHL vorzeigen</li>
                    <li>Bei DHL-Standort abgeben</li>
                    <li>Rücksendung verfolgen</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-[var(--gray-300,#b0b8c9)]">
                <Truck className="h-16 w-16 mx-auto mb-4 text-[var(--gray-300,#b0b8c9)]" />
                <p className="text-[var(--gray-500,#636e85)] text-base font-semibold">Keine Rücksendung</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3 mt-3 sm:mt-5">
            {booking.timeline && booking.timeline.length > 0 ? (
              <div className="space-y-3">
                {booking.timeline.map((event) => (
                  <div key={event._id || event.completedAt} className="bg-white border-2 border-[var(--gray-200,#d8dce6)] p-3 sm:p-4 rounded-lg flex gap-3 sm:gap-4 shadow-md hover:border-[var(--accent-yellow,#f5b800)] transition-all">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 mt-0.5 sm:mt-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm sm:text-base text-[var(--primary-blue,#1a2a5e)] mb-1">{event.status}</h4>
                      <p className="text-xs sm:text-sm text-[var(--gray-600,#4a5568)] mb-1 sm:mb-2">{event.description}</p>
                      {event.staffName && (
                        <p className="text-xs sm:text-sm text-[var(--gray-600,#4a5568)] mb-1 sm:mb-2">
                          <span className="font-semibold">Von:</span> {event.staffName}
                        </p>
                      )}
                      <p className="text-[10px] sm:text-xs text-[var(--gray-500,#636e85)] font-semibold bg-[var(--gray-50,#f5f6f8)] inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                        {formatDateTime(event.completedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-[var(--gray-300,#b0b8c9)]">
                <p className="text-[var(--gray-500,#636e85)] text-base font-semibold">Keine Zeitlinienereignisse</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
          </div>
        </div>


      </DialogContent>
    </Dialog>
  );
}
