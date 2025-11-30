import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { getBookings, getBookingOrders } from "@/api/bookings";
import { useToast } from "@/hooks/useToast";

interface Booking {
  _id: string;
  bookingNumber: string;
  customerId: string;
  items: any[];
  totalCost: number;
  status: string;
  billingStatus: string;
  overallProgress: number;
  createdAt: string;
  updatedAt: string;
}

export function CustomerBookings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [bookingOrders, setBookingOrders] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      console.log('CustomerBookings: Fetching bookings with status filter:', statusFilter);

      const filters: any = {};
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      const response = await getBookings(filters);
      console.log('CustomerBookings: Received bookings:', response.bookings?.length);

      setBookings(response.bookings || []);
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

  const handleExpandBooking = async (bookingId: string) => {
    if (expandedBooking === bookingId) {
      setExpandedBooking(null);
      return;
    }

    setExpandedBooking(bookingId);

    // Fetch orders if not already loaded
    if (!bookingOrders[bookingId]) {
      try {
        console.log('CustomerBookings: Fetching orders for booking:', bookingId);
        const response = await getBookingOrders(bookingId);
        console.log('CustomerBookings: Received orders:', response.orders?.length);

        setBookingOrders((prev) => ({
          ...prev,
          [bookingId]: response.orders || [],
        }));
      } catch (error: any) {
        console.error('CustomerBookings: Error fetching booking orders:', error);
        toast({
          title: t('common.error'),
          description: error.message || t('bookings.errorFetchingOrders'),
          variant: "destructive",
        });
      }
    }
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'pending':
      case 'payment-pending':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getBillingStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'partially-paid':
        return 'secondary';
      case 'unpaid':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      booking.bookingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

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
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out;
        }

        .stagger-item {
          animation: fadeInUp 0.5s ease-out;
        }

        .stagger-item:nth-child(1) { animation-delay: 0s; }
        .stagger-item:nth-child(2) { animation-delay: 0.1s; }
        .stagger-item:nth-child(3) { animation-delay: 0.2s; }
        .stagger-item:nth-child(4) { animation-delay: 0.3s; }
        .stagger-item:nth-child(5) { animation-delay: 0.4s; }
      `}</style>

      <div className="space-y-6 animate-fade-in-up">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('bookings.myBookings')}</h1>
            <p className="text-muted-foreground">{t('bookings.manageYourBookings')}</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="stagger-item">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('common.filter')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('bookings.searchByBookingNumber')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.status')}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
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
          <Card className="stagger-item">
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{t('bookings.noBookings')}</h3>
              <p className="text-muted-foreground">{t('bookings.noBookingsDescription')}</p>
              <Button className="mt-4" onClick={() => navigate('/new-order')}>
                {t('navigation.newOrder')}
              </Button>
            </div>
          </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card key={booking._id} className="stagger-item hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {booking.bookingNumber}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${booking.totalCost?.toFixed(2) || '0.00'}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge variant={getStatusBadgeVariant(booking.status)}>
                      {t(`status.${booking.status}`)}
                    </Badge>
                    <Badge variant={getBillingStatusBadgeVariant(booking.billingStatus)}>
                      {t(`billingStatus.${booking.billingStatus}`)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {t('bookings.progress')}: {booking.overallProgress || 0}%
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExpandBooking(booking._id)}
                    >
                      {expandedBooking === booking._id ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          {t('common.hide')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          {t('bookings.viewOrders')}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${booking.overallProgress || 0}%` }}
                    />
                  </div>

                  {/* Expanded Orders */}
                  {expandedBooking === booking._id && bookingOrders[booking._id] && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('orders.orderNumber')}</TableHead>
                            <TableHead>{t('orders.type')}</TableHead>
                            <TableHead>{t('orders.device')}</TableHead>
                            <TableHead>{t('common.status')}</TableHead>
                            <TableHead>{t('orders.cost')}</TableHead>
                            <TableHead>{t('common.actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookingOrders[booking._id].map((order: any) => (
                            <TableRow key={order.orderId}>
                              <TableCell className="font-medium">{order.orderNumber}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{order.type || 'Repair'}</Badge>
                              </TableCell>
                              <TableCell>
                                {order.device ? `${order.device.brand} ${order.device.model}` : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusBadgeVariant(order.status)}>
                                  {t(`status.${order.status}`)}
                                </Badge>
                              </TableCell>
                              <TableCell>${order.cost?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewOrder(order.orderId)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t('common.view')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
