import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./CustomerBookings.css";
import {
  Package,
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
  MessageSquare,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBookings, getBookingOrders, getBooking } from "@/api/bookings";
import { getUnreadMessageCounts } from "@/api/inspectionCommunication";
import { useToast } from "@/hooks/useToast";
import { CommunicationPanel } from "@/components/inspection/CommunicationPanel";

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
  };
  items: Array<{
    _id?: string;
    type: string;
    device?: string;
    orderId: string;
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
  }>;
  totalCost: number;
  status: string;
  billingStatus: string;
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
}

export function CustomerBookings() {
  const { t } = useTranslation();
  const { toast } = useToast();
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
    navigate(`/orders/${orderId}`);
  };

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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#f5b800] rounded-full opacity-5 blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <Package className="h-8 w-8 text-[#f5b800]" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('bookings.myBookings')}</h1>
            </div>
            <p className="text-blue-100 text-base md:text-lg">{t('bookings.manageYourBookings')}</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-lg bg-white">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[#1a2a5e]">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#f5b800] to-[#e5ab00] flex items-center justify-center flex-shrink-0">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm uppercase tracking-wide whitespace-nowrap">{t('common.filter')}</span>
              </div>
              <div className="flex-1 min-w-[200px]">
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
              <div className="min-w-[180px]">
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
                <Button className="bg-gradient-to-r from-[#f5b800] to-[#e5ab00] hover:from-[#e5ab00] hover:to-[#d59a00] text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all" onClick={() => navigate('/new-order')}>
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
                {filteredBookings.length} bookings found
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2 border-slate-200">
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4"></TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Booking ID</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('common.status')}</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Billing</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Progress</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Total Cost</TableHead>
                      <TableHead className="text-center text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Items</TableHead>
                      <TableHead className="text-center text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Msgs</TableHead>
                      <TableHead className="text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">Created</TableHead>
                      <TableHead className="text-right text-sm font-bold uppercase tracking-wide text-[#1a2a5e] py-4">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredBookings.map((booking) => (
                    <React.Fragment key={booking._id}>
                      <TableRow
                        className="hover:bg-slate-50 transition-colors"
                        onClick={(e) => {
                          // Only trigger on mobile (when screen width is <= 640px)
                          if (window.innerWidth <= 640) {
                            // Don't trigger if clicking on buttons or interactive elements
                            const target = e.target as HTMLElement;
                            if (!target.closest('button') && !target.closest('a') && !target.closest('[role="menu"]')) {
                              toggleExpandBooking(booking._id);
                            }
                          }
                        }}
                        style={{ cursor: window.innerWidth <= 640 ? 'pointer' : 'default' }}
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
                          <Badge className={getBillingStatusColor(booking.billingStatus)}>
                            {t(`billingStatus.${booking.billingStatus}`)}
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
                                  <span className="expanded-section-title">Booking Status</span>
                                  <Badge className={getStatusColor(booking.status)}>
                                    {t(`status.${booking.status}`)}
                                  </Badge>
                                </div>
                                <div className="info-grid">
                                  <div className="info-item">
                                    <div className="info-label">Billing</div>
                                    <Badge className={getBillingStatusColor(booking.billingStatus)}>
                                      {t(`billingStatus.${booking.billingStatus}`)}
                                    </Badge>
                                  </div>
                                  {booking.returnShipmentStatus && (
                                    <div className="info-item">
                                      <div className="info-label">Return Status</div>
                                      <Badge className={getReturnShipmentStatusColor(booking.returnShipmentStatus)}>
                                        {booking.returnShipmentStatus}
                                      </Badge>
                                    </div>
                                  )}
                                  <div className="info-item">
                                    <div className="info-label">Total Cost</div>
                                    <div className="info-value">{formatCurrency(booking.totalCost)}</div>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <div className="info-label mb-1.5">Progress</div>
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
                                      Return Shipping
                                    </span>
                                    {booking.returnShipmentStatus && (
                                      <Badge className={getReturnShipmentStatusColor(booking.returnShipmentStatus)}>
                                        {booking.returnShipmentStatus}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    {booking.returnTrackingNumber && (
                                      <div className="flex items-start gap-2">
                                        <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">Tracking:</span>
                                          <span className="font-mono font-semibold text-blue-900 dark:text-blue-200 text-xs">{booking.returnTrackingNumber}</span>
                                        </div>
                                      </div>
                                    )}
                                    {booking.returnLabelUrl && (
                                      <div className="flex items-start gap-2">
                                        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">Label:</span>
                                          <a
                                            href={booking.returnLabelUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-xs"
                                          >
                                            Download <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                    {booking.returnQRCodeUrl && (
                                      <div className="flex items-start gap-2">
                                        <QrCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">QR Code:</span>
                                          <a
                                            href={booking.returnQRCodeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-xs"
                                          >
                                            View <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                    {booking.returnCreatedAt && (
                                      <div className="flex items-start gap-2">
                                        <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                          <span className="text-foreground/60 block text-xs">Created:</span>
                                          <span className="font-semibold text-xs">{formatDateTime(booking.returnCreatedAt)}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {loadingOrders.has(booking._id) ? (
                                <div className="text-center py-2">
                                  <p className="text-xs text-foreground/60">Loading orders...</p>
                                </div>
                              ) : expandedOrdersData[booking._id] && expandedOrdersData[booking._id].length > 0 ? (
                                <div className="space-y-1.5">
                                  <h4 className="font-semibold text-xs mb-1.5 text-foreground/70">ORDERS & REPAIRS</h4>
                                  <div className="border rounded-md overflow-hidden">
                                    <Table className="text-xs">
                                      <TableHeader>
                                        <TableRow className="bg-muted/40">
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Order #</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Type</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Device</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Services</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-center">Prog</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Status</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-center">Msgs</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-right">Cost</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {expandedOrdersData[booking._id].map((item: any) => (
                                          <TableRow
                                            key={item.orderId || item._id}
                                            className="hover:bg-muted/30 cursor-pointer transition-colors h-8"
                                            onClick={() => item.orderId && handleViewOrder(item.orderId)}
                                          >
                                            <TableCell className="font-medium py-1 text-xs">
                                              {item.orderNumber}
                                            </TableCell>
                                            <TableCell className="py-1">
                                              {item.isComplaintFollowup ? (
                                                <Badge className="text-xs bg-rose-100 text-rose-800 border border-rose-300">
                                                  Reklamationsauftrag
                                                </Badge>
                                              ) : (
                                                <Badge variant={item.type === 'repair' ? 'default' : 'secondary'} className="text-xs">
                                                  {item.type === 'repair' ? 'Repair' : 'Prod'}
                                                </Badge>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-1">
                                              <div className="text-xs text-foreground/80">
                                                {item.type === 'repair' ? (
                                                  <span>{item.device || 'Device'}</span>
                                                ) : (
                                                  <span className="truncate">{item.products?.map((p: any) => p.name).join(', ') || 'Product'}</span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-1">
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
                                                    {item.products.length} item(s)
                                                  </div>
                                                ) : (
                                                  <span className="text-xs text-foreground/50">—</span>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell className="text-center py-1">
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
                                            <TableCell className="py-1">
                                              <Badge className={`${getOrderStatusColor(item.status || 'pending')} text-xs`}>
                                                {item.status || 'pending'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-center py-1">
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
                                            <TableCell className="text-right font-medium text-xs py-1">
                                              ${item.cost?.toFixed(2) || '0.00'}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
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
            </ScrollArea>

            {/* Pagination Controls */}
            {filteredBookings.length > 0 && totalBookings > itemsPerPage && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                <div className="text-sm text-slate-600">
                  {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalBookings)} of {totalBookings}
                </div>

                <div className="flex items-center gap-4">
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
  formatCurrency,
  formatDate,
  formatDateTime,
  getStatusColor,
  getBillingStatusColor,
  getReturnShipmentStatusColor
}: BookingDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("overview");
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
    navigate(`/orders/${orderId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[var(--off-white,#f8f9fc)]">
        <DialogHeader className="-mx-6 -mt-6 px-6 pt-6 pb-5 border-b-2 border-[var(--accent-yellow,#f5b800)] bg-gradient-to-r from-[var(--primary-blue,#1a2a5e)] to-[var(--primary-blue-light,#2a3f7e)]">
          <DialogTitle
            className="text-2xl font-extrabold"
            style={{ color: "#f5b800" }}
          >
            Buchungsdetails
          </DialogTitle>
          <DialogDescription className="text-sm font-semibold text-white/85 mt-1">
            {booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="flex w-full md:grid md:grid-cols-5 h-auto md:h-10 bg-[var(--primary-blue,#1a2a5e)] rounded-lg p-1 gap-1 overflow-x-auto">
            <TabsTrigger 
              value="overview" 
              className="text-sm font-semibold flex-shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-[var(--accent-yellow,#f5b800)] data-[state=active]:text-[var(--primary-blue,#1a2a5e)] text-white/80"
            >
              Übersicht
            </TabsTrigger>
            <TabsTrigger 
              value="repairs" 
              className="text-sm font-semibold flex-shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-[var(--accent-yellow,#f5b800)] data-[state=active]:text-[var(--primary-blue,#1a2a5e)] text-white/80"
            >
              Reparaturen
            </TabsTrigger>
            <TabsTrigger 
              value="items" 
              className="text-sm font-semibold flex-shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-[var(--accent-yellow,#f5b800)] data-[state=active]:text-[var(--primary-blue,#1a2a5e)] text-white/80"
            >
              Artikel
            </TabsTrigger>
            <TabsTrigger 
              value="shipping" 
              className="text-sm font-semibold flex-shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-[var(--accent-yellow,#f5b800)] data-[state=active]:text-[var(--primary-blue,#1a2a5e)] text-white/80"
            >
              Versand
            </TabsTrigger>
            <TabsTrigger 
              value="timeline" 
              className="text-sm font-semibold flex-shrink-0 min-w-[120px] md:min-w-0 data-[state=active]:bg-[var(--accent-yellow,#f5b800)] data-[state=active]:text-[var(--primary-blue,#1a2a5e)] text-white/80"
            >
              Verlauf
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5 mt-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white rounded-lg p-5 shadow-md border border-[var(--gray-200,#d8dce6)]">
                <h3 className="font-bold text-sm mb-3 text-[var(--primary-blue,#1a2a5e)] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                  Kunde
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-[var(--accent-yellow,#f5b800)]">
                      <AvatarImage src={booking.customerId.avatar} />
                      <AvatarFallback className="text-sm font-bold bg-[var(--primary-blue,#1a2a5e)] text-white">
                        {(booking.customerId.firstName || booking.customerId.name || booking.customerId.email).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-sm text-[var(--gray-800,#1a202c)]">
                        {booking.customerId.firstName ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}` : (booking.customerId.name || booking.customerId.email)}
                      </p>
                      <p className="text-sm text-[var(--gray-500,#636e85)]">{booking.customerId.email}</p>
                    </div>
                  </div>
                  <div className="text-sm pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                    <span className="text-[var(--gray-600,#4a5568)] font-semibold">Telefon: </span>
                    <span className="font-semibold text-[var(--gray-800,#1a202c)]">{booking.customerId.phone}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-md border border-[var(--gray-200,#d8dce6)]">
                <h3 className="font-bold text-sm mb-3 text-[var(--primary-blue,#1a2a5e)] uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                  Status
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Aktuell</p>
                    <Badge className={`${getStatusColor(booking.status)} text-sm font-bold px-3 py-1`}>{booking.status}</Badge>
                  </div>
                  <div className="pt-2 border-t border-[var(--gray-200,#d8dce6)]">
                    <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Abrechnung</p>
                    <Badge className={`${getBillingStatusColor(booking.billingStatus)} text-sm font-bold px-3 py-1`}>{booking.billingStatus}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="bg-gradient-to-br from-[var(--primary-blue,#1a2a5e)] to-[var(--primary-blue-light,#2a3f7e)] rounded-lg p-5 shadow-lg text-white">
                <p className="text-sm font-semibold opacity-90 mb-1">Gesamtkosten</p>
                <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(booking.totalCost)}</p>
              </div>
              <div className="bg-gradient-to-br from-[var(--accent-yellow,#f5b800)] to-[var(--accent-yellow-hover,#e5ab00)] rounded-lg p-5 shadow-lg text-[var(--primary-blue,#1a2a5e)]">
                <p className="text-sm font-semibold opacity-90 mb-1">Artikel</p>
                <p className="text-3xl font-extrabold tracking-tight">{booking.items.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 shadow-md border border-[var(--gray-200,#d8dce6)]">
              <p className="text-sm text-[var(--primary-blue,#1a2a5e)] mb-3 font-bold uppercase tracking-wide flex items-center gap-2">
                <span className="w-1 h-4 bg-[var(--accent-yellow,#f5b800)] rounded"></span>
                Zeitstempel
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 bg-[var(--gray-50,#f5f6f8)] p-3 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <div>
                    <span className="text-[var(--gray-600,#4a5568)]">Erstellt: </span>
                    <span className="font-bold text-[var(--gray-800,#1a202c)]">{formatDateTime(booking.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-[var(--gray-50,#f5f6f8)] p-3 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <div>
                    <span className="text-[var(--gray-600,#4a5568)]">Aktualisiert: </span>
                    <span className="font-bold text-[var(--gray-800,#1a202c)]">{formatDateTime(booking.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="repairs" className="space-y-3 mt-5">
            {booking.items && booking.items.filter(item => item.type === 'repair').length > 0 ? (
              <div className="space-y-3">
                {booking.items.filter(item => item.type === 'repair').map((item) => (
                  <div
                    key={item._id || item.orderId}
                    className="bg-white border-2 border-[var(--gray-200,#d8dce6)] rounded-lg p-4 hover:border-[var(--accent-yellow,#f5b800)] hover:shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                    onClick={() => item.orderId && handleViewOrder(item.orderId)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                          <h4 className="font-bold text-base text-[var(--gray-800,#1a202c)]">{item.device || 'Gerät Reparatur'}</h4>
                          <Badge className={`${getStatusColor(item.status || 'pending')} text-sm font-bold px-3 py-1`}>
                            {item.status || 'pending'}
                          </Badge>
                        </div>
                        {item.services && item.services.length > 0 && (
                          <p className="text-sm text-[var(--gray-600,#4a5568)] font-medium">{item.services.map(s => s.name).join(', ')}</p>
                        )}
                      </div>
                      {item.orderId && (
                        <span className="text-sm text-[var(--primary-blue,#1a2a5e)] flex items-center gap-1 ml-3 font-semibold">
                          <ExternalLink className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--gray-200,#d8dce6)]">
                      <div className="text-sm">
                        <span className="text-[var(--gray-600,#4a5568)]">Kosten: </span>
                        <span className="font-bold text-[var(--primary-blue,#1a2a5e)]">{formatCurrency(item.cost)}</span>
                      </div>
                      {item.services && item.services[0]?.estimatedTime && (
                        <div className="text-sm text-right">
                          <span className="text-[var(--gray-600,#4a5568)]">Geschätzt: </span>
                          <span className="font-bold text-[var(--gray-800,#1a202c)]">{item.services[0].estimatedTime}m</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-[var(--gray-300,#b0b8c9)]">
                <p className="text-[var(--gray-500,#636e85)] text-base font-semibold">Keine Reparaturaufträge</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="items" className="space-y-3 mt-5">
            {booking.items && booking.items.filter(item => item.type === 'product').length > 0 ? (
              <div className="space-y-3">
                {booking.items.filter(item => item.type === 'product').map((item) => (
                  <div key={item._id || item.orderId} className="bg-white border-2 border-[var(--gray-200,#d8dce6)] rounded-lg p-4 shadow-md">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-[var(--accent-yellow,#f5b800)]">
                      <h4 className="font-bold text-base text-[var(--primary-blue,#1a2a5e)]">Produkt</h4>
                      <Badge className={`${getStatusColor(item.status || 'pending')} text-sm font-bold px-3 py-1`}>
                        {item.status || 'pending'}
                      </Badge>
                    </div>
                    {item.products && item.products.length > 0 ? (
                      <div className="space-y-2">
                        {item.products.map((product, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm p-3 bg-[var(--gray-50,#f5f6f8)] rounded-lg border-l-4 border-[var(--primary-blue,#1a2a5e)]">
                            <div>
                              <p className="font-bold text-[var(--gray-800,#1a202c)]">{product.name}</p>
                              <p className="text-sm text-[var(--gray-600,#4a5568)] mt-1">
                                Menge: {product.quantity} × {formatCurrency(product.price)}
                              </p>
                            </div>
                            <p className="font-extrabold text-base text-[var(--primary-blue,#1a2a5e)]">{formatCurrency(product.totalPrice)}</p>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-sm mt-4 pt-3 border-t-2 border-[var(--gray-300,#b0b8c9)] font-bold">
                          <span className="text-[var(--gray-700,#2d3748)] uppercase tracking-wide">Gesamt:</span>
                          <span className="text-lg text-[var(--primary-blue,#1a2a5e)]">{formatCurrency(item.cost)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--gray-500,#636e85)] text-center py-3">Keine Produkte</p>
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

          <TabsContent value="shipping" className="space-y-4 mt-5">
            {(hasOutboundShipping || hasReturnShipping) ? (
              <div className="space-y-4">
                {hasOutboundShipping && (
                <div className="bg-white p-5 rounded-lg border-2 border-[var(--primary-blue,#1a2a5e)] shadow-md">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[var(--accent-yellow,#f5b800)]">
                    <h3 className="font-bold text-base flex items-center gap-2 text-[var(--primary-blue,#1a2a5e)]">
                      <Package className="h-5 w-5 text-[var(--accent-yellow,#f5b800)]" />
                      Versand an McRepair
                    </h3>
                    {booking.shippingStatus && (
                      <Badge className="bg-blue-100 text-[var(--primary-blue,#1a2a5e)] border border-blue-300 text-sm font-bold px-3 py-1">
                        {booking.shippingStatus}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {booking.trackingNumber && (
                      <div className="bg-[var(--gray-50,#f5f6f8)] rounded-lg p-4 border border-[var(--gray-200,#d8dce6)]">
                        <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Trackingnummer</p>
                        <p className="font-mono font-bold text-base text-[var(--primary-blue,#1a2a5e)] break-all">{booking.trackingNumber}</p>
                        {booking.carrier && (
                          <p className="text-sm font-medium text-[var(--gray-600,#4a5568)] mt-2">Versanddienst: {booking.carrier}</p>
                        )}
                      </div>
                    )}

                    {booking.shippingLabelUrl && (
                      <div className="bg-[var(--gray-50,#f5f6f8)] rounded-lg p-4 border border-[var(--gray-200,#d8dce6)]">
                        <p className="text-xs text-[var(--gray-600,#4a5568)] font-semibold mb-2 uppercase">Generiertes Versandlabel an McRepair</p>
                        <a
                          href={booking.shippingLabelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-blue,#1a2a5e)] text-white rounded-lg text-sm font-bold hover:bg-[var(--primary-blue-dark,#0f1d45)] transition-all hover:shadow-lg"
                        >
                          <FileText className="h-4 w-4" />
                          Versandlabel zu McRepair öffnen
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    )}
                  </div>

                  {(booking.shippingCreatedAt || booking.estimatedDelivery || booking.actualDelivery || booking.shippingStatusDescription) && (
                    <div className="mt-4 pt-4 border-t border-[var(--gray-200,#d8dce6)] space-y-2 text-sm">
                      {booking.shippingStatusDescription && (
                        <p className="text-[var(--gray-700,#2d3748)]">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Statusinfo: </span>
                          {booking.shippingStatusDescription}
                        </p>
                      )}
                      {booking.shippingCreatedAt && (
                        <p className="text-[var(--gray-700,#2d3748)]">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Label erstellt: </span>
                          {formatDateTime(booking.shippingCreatedAt)}
                        </p>
                      )}
                      {booking.estimatedDelivery && (
                        <p className="text-[var(--gray-700,#2d3748)]">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Voraussichtliche Ankunft bei McRepair: </span>
                          {formatDateTime(booking.estimatedDelivery)}
                        </p>
                      )}
                      {booking.actualDelivery && (
                        <p className="text-[var(--gray-700,#2d3748)]">
                          <span className="font-semibold text-[var(--gray-600,#4a5568)]">Bei McRepair eingetroffen am: </span>
                          {formatDateTime(booking.actualDelivery)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                )}

                {hasReturnShipping && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border-2 border-[var(--primary-blue,#1a2a5e)] shadow-md">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[var(--accent-yellow,#f5b800)]">
                    <h3 className="font-bold text-base flex items-center gap-2 text-[var(--primary-blue,#1a2a5e)]">
                      <Truck className="h-5 w-5 text-[var(--accent-yellow,#f5b800)]" />
                      Rücksendung
                    </h3>
                    {booking.returnShipmentStatus && (
                      <Badge className={`${getReturnShipmentStatusColor(booking.returnShipmentStatus)} text-sm font-bold px-3 py-1`}>
                        {booking.returnShipmentStatus}
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
                            <p className="font-mono font-bold text-base text-[var(--primary-blue,#1a2a5e)]">
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
                            <a
                              href={booking.returnLabelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary-blue,#1a2a5e)] text-white rounded-lg text-sm font-bold hover:bg-[var(--primary-blue-dark,#0f1d45)] transition-all hover:shadow-lg"
                            >
                              <FileText className="h-4 w-4" />
                              PDF Herunterladen
                              <ExternalLink className="h-4 w-4" />
                            </a>
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
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-all hover:shadow-lg"
                            >
                              <QrCode className="h-4 w-4" />
                              Code Anzeigen
                              <ExternalLink className="h-4 w-4" />
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
                                <div className="flex items-center gap-3 bg-[var(--gray-50,#f5f6f8)] p-2 rounded-lg">
                                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                  <span className="text-[var(--gray-600,#4a5568)] font-semibold">Erstellt:</span>
                                  <span className="font-bold text-[var(--gray-800,#1a202c)]">{formatDateTime(booking.returnCreatedAt)}</span>
                                </div>
                              )}
                              {booking.returnReceivedAt && (
                                <div className="flex items-center gap-3 bg-green-50 p-2 rounded-lg">
                                  <div className="w-3 h-3 rounded-full bg-green-600"></div>
                                  <span className="text-[var(--gray-600,#4a5568)] font-semibold">Erhalten:</span>
                                  <span className="font-bold text-[var(--gray-800,#1a202c)]">{formatDateTime(booking.returnReceivedAt)}</span>
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

          <TabsContent value="timeline" className="space-y-3 mt-5">
            {booking.timeline && booking.timeline.length > 0 ? (
              <div className="space-y-3">
                {booking.timeline.map((event) => (
                  <div key={event._id || event.completedAt} className="bg-white border-2 border-[var(--gray-200,#d8dce6)] p-4 rounded-lg flex gap-4 shadow-md hover:border-[var(--accent-yellow,#f5b800)] transition-all">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-6 w-6 text-green-600 mt-1" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-base text-[var(--primary-blue,#1a2a5e)] mb-1">{event.status}</h4>
                      <p className="text-sm text-[var(--gray-600,#4a5568)] mb-2">{event.description}</p>
                      {event.staffName && (
                        <p className="text-sm text-[var(--gray-600,#4a5568)] mb-2">
                          <span className="font-semibold">Von:</span> {event.staffName}
                        </p>
                      )}
                      <p className="text-xs text-[var(--gray-500,#636e85)] font-semibold bg-[var(--gray-50,#f5f6f8)] inline-block px-3 py-1 rounded-full">
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
      </DialogContent>
    </Dialog>
  );
}
