import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { trackBooking, TrackedOrder } from "@/api/orderTracking";
import { useTranslation } from 'react-i18next';
import {
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Mail,
  MapPin,
  Calendar,
  TrendingUp,
  Home,
  User,
  FileText
} from "lucide-react";

export function GuestBookingTracking() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");

    if (urlToken && urlEmail) {
      setToken(urlToken);
      setEmail(urlEmail);
      handleTrackBooking(urlToken, urlEmail);
    }
  }, [searchParams]);

  const handleTrackBooking = async (trackingToken?: string, trackingEmail?: string) => {
    const finalToken = trackingToken || token;
    const finalEmail = trackingEmail || email;

    if (!finalToken || !finalEmail) {
      toast({
        title: t('common.error'),
        description: t('orderTracking.enterTokenAndEmail'),
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const response = await trackBooking({
        token: finalToken,
        email: finalEmail
      });

      setBooking(response.booking);
      setOrders(response.orders || []);

      toast({
        title: t('common.success'),
        description: t('orderTracking.bookingFound')
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('orderTracking.bookingNotFound'),
        variant: "destructive"
      });
      setBooking(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'payment-pending':
        return { bg: '#fff3cd', text: '#856404' };
      case 'in-progress':
      case 'diagnostic-assessment':
        return { bg: '#d1ecf1', text: '#0c5460' };
      case 'completed':
      case 'ready-for-pickup':
        return { bg: '#d4edda', text: '#155724' };
      case 'cancelled':
        return { bg: '#f8d7da', text: '#721c24' };
      default:
        return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  const getStatusIcon = (status: string) => {
    const iconStyle = { width: '16px', height: '16px' };
    switch (status) {
      case 'pending':
      case 'payment-pending':
        return <Clock style={iconStyle} />;
      case 'in-progress':
      case 'diagnostic-assessment':
        return <TrendingUp style={iconStyle} />;
      case 'completed':
      case 'ready-for-pickup':
        return <CheckCircle2 style={iconStyle} />;
      case 'cancelled':
        return <AlertCircle style={iconStyle} />;
      default:
        return <Package style={iconStyle} />;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div style={{ background: 'var(--off-white, #f8f9fc)', minHeight: 'calc(100vh - 100px)' }}>
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '60px', maxWidth: 'var(--max-width, 1200px)' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <Link to="/" style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px',
              color: 'var(--gray-600, #4a5568)',
              fontSize: '14px',
              marginBottom: '16px',
              transition: 'var(--transition)'
            }}>
              <Home style={{ width: '16px', height: '16px' }} />
              <span>{t('common.back')}</span>
            </Link>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'var(--primary-blue, #1a2a5e)',
              marginBottom: '8px'
            }}>
              {t('orderTracking.trackBooking')}
            </h1>
            <p style={{ color: 'var(--gray-600, #4a5568)', fontSize: '15px' }}>
              {t('orderTracking.trackBookingDescription')}
            </p>
          </div>

          {/* Search Form */}
          {!booking && (
            <div style={{
              background: 'var(--white, #fff)',
              borderRadius: 'var(--radius-lg, 16px)',
              boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.1))',
              padding: '32px',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: 'var(--primary-blue, #1a2a5e)',
                marginBottom: '8px'
              }}>
                {t('orderTracking.trackYourBooking')}
              </h2>
              <p style={{ 
                color: 'var(--gray-600, #4a5568)', 
                fontSize: '14px',
                marginBottom: '24px'
              }}>
                {t('orderTracking.enterDetailsBooking')}
              </p>
              
              <form onSubmit={(e) => { e.preventDefault(); handleTrackBooking(); }}>
                <div style={{ display: 'grid', gap: '20px' }}>
                  {/* Email Input */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--gray-700, #2d3748)',
                      marginBottom: '8px'
                    }}>
                      {t('checkout.email')}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '18px',
                        height: '18px',
                        color: 'var(--gray-400, #8892a8)'
                      }} />
                      <input
                        type="email"
                        placeholder={t('checkout.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 12px 12px 44px',
                          border: '1px solid var(--gray-200, #d8dce6)',
                          borderRadius: 'var(--radius-md, 10px)',
                          fontSize: '15px',
                          transition: 'var(--transition)',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary-blue, #1a2a5e)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--gray-200, #d8dce6)'}
                      />
                    </div>
                  </div>

                  {/* Token Input */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--gray-700, #2d3748)',
                      marginBottom: '8px'
                    }}>
                      {t('orderTracking.trackingToken')}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <FileText style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '18px',
                        height: '18px',
                        color: 'var(--gray-400, #8892a8)'
                      }} />
                      <input
                        type="text"
                        placeholder={t('orderTracking.tokenPlaceholder')}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '12px 12px 12px 44px',
                          border: '1px solid var(--gray-200, #d8dce6)',
                          borderRadius: 'var(--radius-md, 10px)',
                          fontSize: '15px',
                          transition: 'var(--transition)',
                          outline: 'none'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--primary-blue, #1a2a5e)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--gray-200, #d8dce6)'}
                      />
                    </div>
                    <p style={{ 
                      fontSize: '13px', 
                      color: 'var(--gray-500, #636e85)',
                      marginTop: '6px'
                    }}>
                      {t('orderTracking.tokenHintBooking')}
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '14px 24px',
                      background: loading ? 'var(--gray-300, #b0b8c9)' : 'var(--accent-yellow, #f5b800)',
                      color: 'var(--primary-blue, #1a2a5e)',
                      fontWeight: '600',
                      fontSize: '15px',
                      border: 'none',
                      borderRadius: 'var(--radius-md, 10px)',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'var(--transition)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-yellow-hover, #e5ab00)')}
                    onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-yellow, #f5b800)')}
                  >
                    <Search style={{ width: '18px', height: '18px' }} />
                    {loading ? t('common.loading') : t('orderTracking.trackBooking')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Booking Details */}
          {booking && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Booking Summary Card */}
              <div style={{
                background: 'var(--white, #fff)',
                borderRadius: 'var(--radius-lg, 16px)',
                boxShadow: 'var(--shadow-md)',
                padding: '24px'
              }}>
                {/* Booking Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <h2 style={{ 
                      fontSize: '18px', 
                      fontWeight: '700', 
                      color: 'var(--primary-blue)', 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <FileText style={{ width: '20px', height: '20px' }} />
                      {booking.bookingNumber}
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                      {t('orderTracking.created')}: {formatDate(booking.createdAt)}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    background: getStatusColor(booking.status).bg,
                    color: getStatusColor(booking.status).text,
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {getStatusIcon(booking.status)}
                    {booking.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                      {t('orderTracking.overallProgress')}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-blue)' }}>
                      {booking.overallProgress || 0}%
                    </span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    background: 'var(--gray-100)', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${booking.overallProgress || 0}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary-blue) 0%, var(--primary-blue-light) 100%)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>

                {/* Booking Summary Stats */}
                <div style={{ 
                  padding: '16px', 
                  background: 'var(--gray-50)', 
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: 'var(--gray-700)',
                    marginBottom: '12px'
                  }}>
                    {t('orderTracking.bookingSummary')}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('orderTracking.totalOrders')}
                      </p>
                      <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary-blue)' }}>
                        {booking.totalOrders || orders.length}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('orderTracking.totalCost')}
                      </p>
                      <p style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary-blue)' }}>
                        €{booking.totalCost?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('orderTracking.paymentStatus')}
                      </p>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: getStatusColor(booking.paymentStatus).bg,
                        color: getStatusColor(booking.paymentStatus).text,
                        fontSize: '12px',
                        fontWeight: '600',
                        marginTop: '4px'
                      }}>
                        {booking.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div style={{ 
                  padding: '16px', 
                  background: 'var(--gray-50)', 
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: 'var(--gray-700)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <User style={{ width: '16px', height: '16px' }} />
                    {t('orderTracking.customerInformation')}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('common.name')}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>
                        {booking.guestInfo.firstName} {booking.guestInfo.lastName}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('checkout.email')}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>
                        {booking.guestInfo.email}
                      </p>
                    </div>
                    {booking.guestInfo.phone && (
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                          {t('checkout.phone')}
                        </p>
                        <p style={{ fontSize: '14px', fontWeight: '500' }}>
                          {booking.guestInfo.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                {booking.guestInfo.billingAddress && (
                  <div style={{ 
                    padding: '16px', 
                    background: 'var(--gray-50)', 
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '20px'
                  }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: 'var(--gray-700)',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <MapPin style={{ width: '16px', height: '16px' }} />
                      {t('checkout.billingAddress')}
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--gray-700)', lineHeight: '1.6' }}>
                      {booking.guestInfo.billingAddress.street}<br />
                      {booking.guestInfo.billingAddress.zipCode} {booking.guestInfo.billingAddress.city}<br />
                      {booking.guestInfo.billingAddress.state && `${booking.guestInfo.billingAddress.state}, `}
                      {booking.guestInfo.billingAddress.country}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                {booking.timeline && booking.timeline.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: 'var(--gray-700)',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Calendar style={{ width: '16px', height: '16px' }} />
                      {t('orderTracking.bookingTimeline')}
                    </h4>
                    <div style={{ position: 'relative', paddingLeft: '20px' }}>
                      <div style={{
                        position: 'absolute',
                        left: '6px',
                        top: '8px',
                        bottom: '8px',
                        width: '2px',
                        background: 'var(--gray-200)'
                      }} />
                      
                      {booking.timeline.map((event: any, index: number) => (
                        <div key={index} style={{ 
                          position: 'relative', 
                          marginBottom: '16px',
                          paddingLeft: '12px'
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: '-14px',
                            top: '6px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--primary-blue)',
                            border: '2px solid var(--white)',
                            zIndex: 1
                          }} />
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-800)', marginBottom: '2px' }}>
                            {event.status}
                          </p>
                          <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '2px' }}>
                            {event.description}
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                            {formatDate(event.completedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Track Another Button */}
                <button
                  onClick={() => {
                    setBooking(null);
                    setOrders([]);
                    setEmail("");
                    setToken("");
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'var(--white)',
                    border: '2px solid var(--primary-blue)',
                    color: 'var(--primary-blue)',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-blue)';
                    e.currentTarget.style.color = 'var(--white)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--white)';
                    e.currentTarget.style.color = 'var(--primary-blue)';
                  }}
                >
                  {t('orderTracking.trackAnotherBooking')}
                </button>
              </div>

              {/* Orders List */}
              {orders.length > 0 && (
                <div style={{
                  background: 'var(--white, #fff)',
                  borderRadius: 'var(--radius-lg, 16px)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '24px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-blue)', marginBottom: '8px' }}>
                    {t('orderTracking.ordersInBooking')}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '16px' }}>
                    {t('orderTracking.ordersInBookingDesc')}
                  </p>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {orders.map((order: TrackedOrder) => (
                      <div key={order._id} style={{
                        padding: '20px',
                        border: '2px solid var(--gray-100)',
                        borderRadius: 'var(--radius-lg)',
                        transition: 'var(--transition)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-blue)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--gray-100)'}
                      >
                        {/* Order Header */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          marginBottom: '12px',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}>
                          <div>
                            <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gray-800)', marginBottom: '4px' }}>
                              {order.orderNumber}
                            </p>
                            <p style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                              {order.deviceBrand} {order.deviceModel}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              background: getStatusColor(order.status).bg,
                              color: getStatusColor(order.status).text,
                              fontSize: '12px',
                              fontWeight: '600',
                              marginBottom: '4px'
                            }}>
                              {getStatusIcon(order.status)}
                              {order.status}
                            </span>
                            <p style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                              {order.progress}%
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ 
                            width: '100%', 
                            height: '6px', 
                            background: 'var(--gray-100)', 
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${order.progress}%`,
                              height: '100%',
                              background: 'var(--primary-blue)',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                        </div>

                        {/* Services */}
                        {order.services && order.services.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gray-600)', marginBottom: '8px', textTransform: 'uppercase' }}>
                              {t('orderTracking.services')}
                            </p>
                            <div style={{ display: 'grid', gap: '6px' }}>
                              {order.services.map((service: any, idx: number) => (
                                <div key={idx} style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '13px',
                                  padding: '8px',
                                  background: 'var(--gray-50)',
                                  borderRadius: 'var(--radius-sm)'
                                }}>
                                  <span style={{ color: 'var(--gray-700)' }}>
                                    {service.serviceId?.name || t('common.service')}
                                  </span>
                                  <span style={{ fontWeight: '600', color: 'var(--primary-blue)' }}>
                                    €{service.price?.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Total */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '12px',
                          borderTop: '1px solid var(--gray-200)'
                        }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                            {t('orderTracking.totalCost')}
                          </span>
                          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--primary-blue)' }}>
                            €{order.totalCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}
