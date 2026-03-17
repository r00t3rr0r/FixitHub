import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import { trackOrder, TrackedOrder } from "@/api/orderTracking";
import { useTranslation } from 'react-i18next';
import {
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Mail,
  MapPin,
  Wrench,
  Calendar,
  TrendingUp,
  Home,
  ShoppingCart,
  User
} from "lucide-react";

export function GuestOrderTracking() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [relatedOrders, setRelatedOrders] = useState<any[]>([]);
  const [booking, setBooking] = useState<any | null>(null);

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");

    if (urlToken && urlEmail) {
      setToken(urlToken);
      setEmail(urlEmail);
      handleTrackOrder(urlToken, urlEmail);
    }
  }, [searchParams]);

  const handleTrackOrder = async (trackingToken?: string, trackingEmail?: string) => {
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
      const response = await trackOrder({
        token: finalToken,
        email: finalEmail
      });

      setOrder(response.order);
      setRelatedOrders(response.relatedOrders || []);
      setBooking(response.booking);

      toast({
        title: t('common.success'),
        description: t('orderTracking.orderFound')
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('orderTracking.orderNotFound'),
        variant: "destructive"
      });
      setOrder(null);
      setRelatedOrders([]);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#fff3cd', text: '#856404' };
      case 'in-progress':
      case 'diagnostic-assessment':
        return { bg: '#d1ecf1', text: '#0c5460' };
      case 'quality-check':
        return { bg: '#e2d9f3', text: '#5a2d82' };
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
              {t('orderTracking.title')}
            </h1>
            <p style={{ color: 'var(--gray-600, #4a5568)', fontSize: '15px' }}>
              {t('orderTracking.description')}
            </p>
          </div>

          {/* Search Form */}
          {!order && (
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
                {t('orderTracking.trackYourOrder')}
              </h2>
              <p style={{ 
                color: 'var(--gray-600, #4a5568)', 
                fontSize: '14px',
                marginBottom: '24px'
              }}>
                {t('orderTracking.enterDetails')}
              </p>
              
              <form onSubmit={(e) => { e.preventDefault(); handleTrackOrder(); }}>
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
                      <Package style={{
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
                      {t('orderTracking.tokenHint')}
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
                    {loading ? t('common.loading') : t('orderTracking.trackOrder')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Order Details */}
          {order && (
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Booking Info Card */}
              {booking && (
                <div style={{
                  background: 'var(--white, #fff)',
                  borderRadius: 'var(--radius-lg, 16px)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '24px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-blue)', marginBottom: '16px' }}>
                    {t('orderTracking.bookingDetails')}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                        {t('orderTracking.bookingNumber')}
                      </p>
                      <p style={{ fontWeight: '600', color: 'var(--gray-800)' }}>{booking.bookingNumber}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                        {t('common.status')}
                      </p>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: getStatusColor(booking.status).bg,
                        color: getStatusColor(booking.status).text,
                        fontSize: '13px',
                        fontWeight: '500'
                      }}>
                        {booking.status}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                        {t('orderTracking.orderDate')}
                      </p>
                      <p style={{ fontWeight: '600', color: 'var(--gray-800)' }}>{formatDate(booking.createdAt)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Order Card */}
              <div style={{
                background: 'var(--white, #fff)',
                borderRadius: 'var(--radius-lg, 16px)',
                boxShadow: 'var(--shadow-md)',
                padding: '24px'
              }}>
                {/* Order Header */}
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
                      <Package style={{ width: '20px', height: '20px' }} />
                      {order.orderNumber}
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                      {t('orderTracking.created')}: {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    background: getStatusColor(order.status).bg,
                    color: getStatusColor(order.status).text,
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gray-700)' }}>
                      {t('orderTracking.progress')}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-blue)' }}>
                      {order.progress}%
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
                      width: `${order.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary-blue) 0%, var(--primary-blue-light) 100%)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>

                {/* Device Info */}
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
                    <Wrench style={{ width: '16px', height: '16px' }} />
                    {t('orderTracking.deviceInformation')}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('orderTracking.deviceType')}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-800)' }}>
                        {order.deviceType}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('orderTracking.brand')}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-800)' }}>
                        {order.deviceBrand}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('orderTracking.model')}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-800)' }}>
                        {order.deviceModel}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Services */}
                {order.services && order.services.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '12px' }}>
                      {t('orderTracking.services')}
                    </h4>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {order.services.map((service: any, index: number) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          background: 'var(--gray-50)',
                          borderRadius: 'var(--radius-sm)',
                          gap: '12px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--gray-800)' }}>
                              {service.serviceId?.name || t('common.service')}
                            </p>
                            {service.serviceId?.description && (
                              <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                {service.serviceId.description}
                              </p>
                            )}
                          </div>
                          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary-blue)' }}>
                            €{service.price.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {order.addOns && order.addOns.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)', marginBottom: '12px' }}>
                      {t('orderTracking.addOns')}
                    </h4>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {order.addOns.map((addOn: any, index: number) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: 'var(--gray-50)',
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          <p style={{ fontSize: '14px', fontWeight: '500' }}>{addOn.name}</p>
                          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary-blue)' }}>
                            €{addOn.price.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products */}
                {order.shopProducts && order.shopProducts.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: 'var(--gray-700)', 
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <ShoppingCart style={{ width: '16px', height: '16px' }} />
                      {t('orderTracking.products')}
                    </h4>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {order.shopProducts.map((product: any, index: number) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          background: 'var(--gray-50)',
                          borderRadius: 'var(--radius-sm)',
                          gap: '12px'
                        }}>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--gray-800)' }}>
                              {product.productId?.name || t('common.product')}
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                              {t('orderTracking.quantity')}: {product.quantity}
                            </p>
                          </div>
                          <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary-blue)' }}>
                            €{(product.priceAtOrder * product.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div style={{
                  padding: '16px',
                  background: 'var(--primary-blue)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--white)' }}>
                    {t('orderTracking.totalCost')}
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-yellow)' }}>
                    €{order.totalCost.toFixed(2)}
                  </span>
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
                        {order.guestInfo.firstName} {order.guestInfo.lastName}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {t('checkout.email')}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>
                        {order.guestInfo.email}
                      </p>
                    </div>
                    {order.guestInfo.phone && (
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--gray-500)', marginBottom: '2px' }}>
                          {t('checkout.phone')}
                        </p>
                        <p style={{ fontSize: '14px', fontWeight: '500' }}>
                          {order.guestInfo.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                {order.guestInfo.billingAddress && (
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
                      {order.guestInfo.billingAddress.street}<br />
                      {order.guestInfo.billingAddress.zipCode} {order.guestInfo.billingAddress.city}<br />
                      {order.guestInfo.billingAddress.state && `${order.guestInfo.billingAddress.state}, `}
                      {order.guestInfo.billingAddress.country}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                {order.timeline && order.timeline.length > 0 && (
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
                      {t('orderTracking.timeline')}
                    </h4>
                    <div style={{ position: 'relative', paddingLeft: '20px' }}>
                      {/* Timeline Line */}
                      <div style={{
                        position: 'absolute',
                        left: '6px',
                        top: '8px',
                        bottom: '8px',
                        width: '2px',
                        background: 'var(--gray-200)'
                      }} />
                      
                      {order.timeline.map((event: any, index: number) => (
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
                    setOrder(null);
                    setRelatedOrders([]);
                    setBooking(null);
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
                  {t('orderTracking.trackAnotherOrder')}
                </button>
              </div>

              {/* Related Orders */}
              {relatedOrders.length > 0 && (
                <div style={{
                  background: 'var(--white, #fff)',
                  borderRadius: 'var(--radius-lg, 16px)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '24px'
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--primary-blue)', marginBottom: '8px' }}>
                    {t('orderTracking.relatedOrders')}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginBottom: '16px' }}>
                    {t('orderTracking.relatedOrdersDesc')}
                  </p>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {relatedOrders.map((relOrder: any) => (
                      <div key={relOrder._id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--radius-md)',
                        gap: '16px'
                      }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--gray-800)' }}>
                            {relOrder.orderNumber}
                          </p>
                          <p style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                            {relOrder.deviceBrand} {relOrder.deviceModel}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            background: getStatusColor(relOrder.status).bg,
                            color: getStatusColor(relOrder.status).text,
                            fontSize: '12px',
                            fontWeight: '500',
                            marginBottom: '4px'
                          }}>
                            {relOrder.status}
                          </span>
                          <p style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                            {relOrder.progress}%
                          </p>
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
