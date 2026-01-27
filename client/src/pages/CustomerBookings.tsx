import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Calendar,
  DollarSign,
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
import { useToast } from "@/hooks/useToast";

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
  returnCreatedAt?: string;
  returnReceivedAt?: string;
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

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, currentPage, itemsPerPage]);

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

  const getBookingProgress = (bookingId: string, fallbackProgress: number = 0) => {
    if (calculatedProgress[bookingId] !== undefined) {
      return calculatedProgress[bookingId];
    }
    return fallbackProgress;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'payment-pending':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'quality-check':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'ready-for-pickup':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'partially-paid':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getReturnShipmentStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'label-created':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in-transit':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-foreground/60">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('bookings.myBookings')}</h1>
        <p className="text-sm text-foreground/60">{t('bookings.manageYourBookings')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{totalBookings}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Pending</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{bookings.filter(b => b.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Processing</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{bookings.filter(b => b.status === 'processing').length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-foreground/60 uppercase tracking-wide">Completed</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold">{bookings.filter(b => b.status === 'completed').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="shadow-md">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Filter className="h-4 w-4" />
            {t('common.filter')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1.5 block text-foreground/70">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground/40" />
                <Input
                  placeholder={t('bookings.searchByBookingNumber')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm h-9"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <label className="text-xs font-medium mb-1.5 block text-foreground/70">{t('common.status')}</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
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

      {/* Bookings Table */}
      <Card className="shadow-md">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold">Bookings List</CardTitle>
            <CardDescription className="text-xs text-foreground/60">{filteredBookings.length} bookings found</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-6 text-foreground/60">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t('bookings.noBookings')}</p>
              <Button className="mt-3 h-9 text-sm" onClick={() => navigate('/new-order')}>
                {t('navigation.newOrder')}
              </Button>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12 h-9 text-xs font-semibold text-foreground/70"></TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Booking ID</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Status</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Billing</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Progress</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Total Cost</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Items</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70">Created</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-foreground/70 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <React.Fragment key={booking._id}>
                      <TableRow className="hover:bg-muted/40 h-10">
                        <TableCell className="w-12 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => toggleExpandBooking(booking._id)}
                            disabled={loadingOrders.has(booking._id)}
                          >
                            {expandedBookings.has(booking._id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium text-sm py-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3 text-foreground/60" />
                            <span>{booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`${getStatusColor(booking.status)} text-xs`}>
                            {t(`status.${booking.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className={`${getBillingStatusColor(booking.billingStatus)} text-xs`}>
                            {t(`billingStatus.${booking.billingStatus}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${getBookingProgress(booking._id, booking.overallProgress || 0)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-semibold whitespace-nowrap text-foreground/70">
                              {getBookingProgress(booking._id, booking.overallProgress || 0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm py-2">
                          {formatCurrency(booking.totalCost)}
                        </TableCell>
                        <TableCell className="text-center text-sm py-2 text-foreground/70">
                          {booking.items.length}
                        </TableCell>
                        <TableCell className="text-xs text-foreground/60 py-2">
                          {formatDate(booking.createdAt)}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleViewDetails(booking)} className="text-sm">
                                <Eye className="h-3 w-3 mr-2" />
                                {t('common.viewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleExpandBooking(booking._id)} className="text-sm">
                                {expandedBookings.has(booking._id) ? (
                                  <>
                                    <ChevronUp className="h-3 w-3 mr-2" />
                                    {t('common.hide')} Orders
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3 mr-2" />
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
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={9}>
                            <div className="p-3 space-y-3">
                              {/* Booking Status Summary */}
                              <div className="bg-muted/40 p-2.5 rounded-lg border border-muted">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-semibold text-foreground/70 uppercase">Booking Status</span>
                                  <Badge className={`${getStatusColor(booking.status)} text-xs`}>
                                    {t(`status.${booking.status}`)}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                  <div>
                                    <span className="text-foreground/60 text-xs">Billing:</span>
                                    <Badge className={`${getBillingStatusColor(booking.billingStatus)} ml-2 text-xs`}>
                                      {t(`billingStatus.${booking.billingStatus}`)}
                                    </Badge>
                                  </div>
                                  {booking.returnShipmentStatus && (
                                    <div>
                                      <span className="text-foreground/60 text-xs">Return:</span>
                                      <Badge className={`${getReturnShipmentStatusColor(booking.returnShipmentStatus)} ml-2 text-xs`}>
                                        {booking.returnShipmentStatus}
                                      </Badge>
                                    </div>
                                  )}
                                  <div className={booking.returnShipmentStatus ? "text-right" : "col-span-2 text-right"}>
                                    <span className="text-foreground/60 text-xs">Total: </span>
                                    <span className="font-semibold text-xs">{formatCurrency(booking.totalCost)}</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs text-foreground/60 mb-1 block">Progress:</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-muted rounded-full h-1.5">
                                      <div
                                        className="bg-primary h-1.5 rounded-full transition-all"
                                        style={{ width: `${getBookingProgress(booking._id, booking.overallProgress || 0)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs font-semibold whitespace-nowrap text-foreground/70">
                                      {getBookingProgress(booking._id, booking.overallProgress || 0)}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Return Shipping Information */}
                              {(booking.returnTrackingNumber || booking.returnLabelUrl || booking.returnQRCodeUrl) && (
                                <div className="bg-blue-50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase flex items-center gap-1">
                                      <Truck className="h-3 w-3" />
                                      Return Shipping
                                    </span>
                                    {booking.returnShipmentStatus && (
                                      <Badge className={`${getReturnShipmentStatusColor(booking.returnShipmentStatus)} text-xs`}>
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
                                <div className="text-center py-3">
                                  <p className="text-xs text-foreground/60">Loading orders...</p>
                                </div>
                              ) : expandedOrdersData[booking._id] && expandedOrdersData[booking._id].length > 0 ? (
                                <div className="space-y-2.5">
                                  <h4 className="font-semibold text-xs mb-2 text-foreground/70">ORDERS & REPAIRS</h4>
                                  <div className="border rounded-lg overflow-hidden">
                                    <Table className="text-xs">
                                      <TableHeader>
                                        <TableRow className="bg-muted/40">
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Order #</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Type</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Device</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Services</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70 text-center">Prog</TableHead>
                                          <TableHead className="h-7 text-xs font-semibold text-foreground/70">Status</TableHead>
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
                                              <Badge variant={item.type === 'repair' ? 'default' : 'secondary'} className="text-xs">
                                                {item.type === 'repair' ? 'Repair' : 'Prod'}
                                              </Badge>
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
                                <div className="text-center py-3">
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
          )}

          {/* Pagination Controls */}
          {filteredBookings.length > 0 && totalBookings > itemsPerPage && (
            <div className="flex items-center justify-between px-2 py-3 border-t">
              <div className="flex items-center gap-2">
                <p className="text-xs text-foreground/60">
                  {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalBookings)} of {totalBookings}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-foreground/60">Per page:</label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-16 text-xs">
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
                    className="h-8 px-2 text-xs"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" />
                    Prev
                  </Button>

                  <div className="flex items-center gap-0.5">
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
                              <span className="px-1 text-foreground/40 text-xs">…</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              disabled={loading}
                              className="h-8 w-8 p-0 text-xs"
                            >
                              {page}
                            </Button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalBookings / itemsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(totalBookings / itemsPerPage) || loading}
                  >
                    Next
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

  const handleViewOrder = (orderId: string) => {
    if (!orderId) {
      console.warn("No order ID provided for navigation");
      return;
    }
    navigate(`/orders/${orderId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">Booking Details</DialogTitle>
          <DialogDescription className="text-xs text-foreground/60">
            {booking.bookingNumber || `#${booking._id.slice(-8).toUpperCase()}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-8">
            <TabsTrigger value="overview" className="text-xs h-7">Overview</TabsTrigger>
            <TabsTrigger value="repairs" className="text-xs h-7">Repairs</TabsTrigger>
            <TabsTrigger value="items" className="text-xs h-7">Items</TabsTrigger>
            <TabsTrigger value="shipping" className="text-xs h-7">Shipping</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs h-7">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h3 className="font-semibold text-xs mb-2 text-foreground/70 uppercase">Customer</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={booking.customerId.avatar} />
                      <AvatarFallback className="text-xs">{(booking.customerId.firstName || booking.customerId.name || booking.customerId.email).charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-xs">{booking.customerId.firstName ? `${booking.customerId.firstName} ${booking.customerId.lastName || ''}` : (booking.customerId.name || booking.customerId.email)}</p>
                      <p className="text-xs text-foreground/60">{booking.customerId.email}</p>
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-foreground/60">Phone: </span>
                    <span className="font-medium">{booking.customerId.phone}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-xs mb-2 text-foreground/70 uppercase">Status</h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-foreground/60 mb-1">Current</p>
                    <Badge className={`${getStatusColor(booking.status)} text-xs`}>{booking.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/60 mb-1">Billing</p>
                    <Badge className={`${getBillingStatusColor(booking.billingStatus)} text-xs`}>{booking.billingStatus}</Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 p-2.5 rounded">
                <p className="text-xs text-foreground/60">Total Cost</p>
                <p className="text-base font-bold">{formatCurrency(booking.totalCost)}</p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded">
                <p className="text-xs text-foreground/60">Items</p>
                <p className="text-base font-bold">{booking.items.length}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs text-foreground/60 mb-1.5 font-medium">Dates</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-foreground/70">Created: <span className="font-medium">{formatDateTime(booking.createdAt)}</span></div>
                <div className="text-foreground/70">Updated: <span className="font-medium">{formatDateTime(booking.updatedAt)}</span></div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="repairs" className="space-y-2.5 mt-3">
            {booking.items && booking.items.filter(item => item.type === 'repair').length > 0 ? (
              <div className="space-y-2">
                {booking.items.filter(item => item.type === 'repair').map((item) => (
                  <div
                    key={item._id || item.orderId}
                    className="border p-3 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => item.orderId && handleViewOrder(item.orderId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm">{item.device || 'Device Repair'}</h4>
                          <Badge className={`${getStatusColor(item.status || 'pending')} text-xs`}>
                            {item.status || 'pending'}
                          </Badge>
                        </div>
                        {item.services && item.services.length > 0 && (
                          <p className="text-xs text-foreground/60 mt-1">{item.services.map(s => s.name).join(', ')}</p>
                        )}
                      </div>
                      {item.orderId && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-0.5 ml-2">
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>Cost: {formatCurrency(item.cost)}</div>
                      {item.services && item.services[0]?.estimatedTime && (
                        <div className="text-right">Est: {item.services[0].estimatedTime}m</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground/60 text-center py-3 text-xs">No repair jobs</p>
            )}
          </TabsContent>

          <TabsContent value="items" className="space-y-2.5 mt-3">
            {booking.items && booking.items.filter(item => item.type === 'product').length > 0 ? (
              <div className="space-y-2">
                {booking.items.filter(item => item.type === 'product').map((item) => (
                  <div key={item._id || item.orderId} className="border p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Product</h4>
                      <Badge className={`${getStatusColor(item.status || 'pending')} text-xs`}>
                        {item.status || 'pending'}
                      </Badge>
                    </div>
                    {item.products && item.products.length > 0 ? (
                      <div className="space-y-1.5">
                        {item.products.map((product, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs pb-1.5 border-b last:border-0">
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-foreground/60">Qty: {product.quantity} × {formatCurrency(product.price)}</p>
                            </div>
                            <p className="font-semibold">{formatCurrency(product.totalPrice)}</p>
                          </div>
                        ))}
                        <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t font-semibold">
                          <span>Total:</span>
                          <span>{formatCurrency(item.cost)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground/60">No products</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground/60 text-center py-3 text-xs">No product items</p>
            )}
          </TabsContent>

          <TabsContent value="shipping" className="space-y-3 mt-3">
            {(booking.returnTrackingNumber || booking.returnLabelUrl || booking.returnQRCodeUrl || booking.returnShipmentStatus) ? (
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Return Shipping
                    </h3>
                    {booking.returnShipmentStatus && (
                      <Badge className={`${getReturnShipmentStatusColor(booking.returnShipmentStatus)} text-xs`}>
                        {booking.returnShipmentStatus}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {booking.returnTrackingNumber && (
                      <div className="border-b pb-2">
                        <div className="flex items-start gap-2">
                          <Package className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground/60 mb-1">Tracking Number</p>
                            <p className="font-mono font-semibold text-sm text-blue-900 dark:text-blue-200">
                              {booking.returnTrackingNumber}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.returnLabelUrl && (
                      <div className="border-b pb-2">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground/60 mb-1">Return Label</p>
                            <a
                              href={booking.returnLabelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              <FileText className="h-3 w-3" />
                              Download PDF
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {booking.returnQRCodeUrl && (
                      <div className="border-b pb-2">
                        <div className="flex items-start gap-2">
                          <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground/60 mb-1">QR Code</p>
                            <a
                              href={booking.returnQRCodeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              <QrCode className="h-3 w-3" />
                              View Code
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {(booking.returnCreatedAt || booking.returnReceivedAt) && (
                      <div>
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-foreground/60 mb-1">Timeline</p>
                            <div className="space-y-1 text-xs">
                              {booking.returnCreatedAt && (
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                  <span className="text-foreground/60">Created:</span>
                                  <span className="font-semibold">{formatDateTime(booking.returnCreatedAt)}</span>
                                </div>
                              )}
                              {booking.returnReceivedAt && (
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>
                                  <span className="text-foreground/60">Received:</span>
                                  <span className="font-semibold">{formatDateTime(booking.returnReceivedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-muted/40 p-2.5 rounded-lg text-xs">
                  <h4 className="font-semibold mb-1.5 text-foreground/80">Instructions</h4>
                  <ol className="list-decimal list-inside space-y-0.5 text-foreground/70 text-xs">
                    <li>Print label or save QR code</li>
                    <li>Pack item securely</li>
                    <li>Attach label or show QR code at DHL</li>
                    <li>Drop off at DHL location</li>
                    <li>Track your return</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Truck className="h-10 w-10 mx-auto mb-3 text-foreground/20" />
                <p className="text-foreground/60 text-sm">No return shipping</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-2.5 mt-3">
            {booking.timeline && booking.timeline.length > 0 ? (
              <div className="space-y-2">
                {booking.timeline.map((event) => (
                  <div key={event._id || event.completedAt} className="border p-2.5 rounded-lg flex gap-2.5">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{event.status}</h4>
                      <p className="text-xs text-foreground/60 mt-0.5">{event.description}</p>
                      {event.staffName && (
                        <p className="text-xs text-foreground/60 mt-1">By: {event.staffName}</p>
                      )}
                      <p className="text-xs text-foreground/50 mt-1">{formatDateTime(event.completedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground/60 text-center py-4 text-xs">No timeline events</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
