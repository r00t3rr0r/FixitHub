import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { registerDuringCheckout, completeGuestCheckout } from "@/api/checkout";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from 'react-i18next';
import { UserPlus, LogIn, Eye, EyeOff, UserCheck, Package } from "lucide-react";
import { mergeGuestCartWithUserCart } from "@/utils/guestCart";
import { addToCart, addRepairOrderToCart } from "@/api/shop";
import { getGuestCart, clearGuestCart } from "@/utils/guestCart";
import { useNavigate } from "react-router-dom";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CheckoutDialog({ open, onOpenChange, onSuccess }: CheckoutDialogProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { toast } = useToast();

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Registration form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [vatId, setVatId] = useState("");

  // Billing address
  const [billingStreet, setBillingStreet] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZipCode, setBillingZipCode] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

  // Shipping address
  const [shippingStreet, setShippingStreet] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingZipCode, setShippingZipCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("");

  // Checkbox to determine if billing address is same as shipping
  const [billingIsShipping, setBillingIsShipping] = useState(true);

  const [registerLoading, setRegisterLoading] = useState(false);

  // Guest checkout form state
  const [guestEmail, setGuestEmail] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  
  // Guest billing address
  const [guestBillingStreet, setGuestBillingStreet] = useState("");
  const [guestBillingCity, setGuestBillingCity] = useState("");
  const [guestBillingState, setGuestBillingState] = useState("");
  const [guestBillingZipCode, setGuestBillingZipCode] = useState("");
  const [guestBillingCountry, setGuestBillingCountry] = useState("");

  // Guest shipping address
  const [guestShippingStreet, setGuestShippingStreet] = useState("");
  const [guestShippingCity, setGuestShippingCity] = useState("");
  const [guestShippingState, setGuestShippingState] = useState("");
  const [guestShippingZipCode, setGuestShippingZipCode] = useState("");
  const [guestShippingCountry, setGuestShippingCountry] = useState("");

  // Guest checkbox to determine if billing address is same as shipping
  const [guestBillingIsShipping, setGuestBillingIsShipping] = useState(true);

  const [guestCheckoutLoading, setGuestCheckoutLoading] = useState(false);
  
  // Guest checkout result with tracking links
  const [guestCheckoutResult, setGuestCheckoutResult] = useState<any>(null);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginEmail || !loginPassword) {
      toast({
        title: t('common.error'),
        description: t('checkout.pleaseEnterEmailPassword'),
        variant: "destructive"
      });
      return;
    }

    try {
      setLoginLoading(true);
      await login(loginEmail, loginPassword);

      toast({
        title: t('common.success'),
        description: t('checkout.loginSuccessful')
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('checkout.loginFailed'),
        variant: "destructive"
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email || !password || !firstName || !lastName) {
      toast({
        title: t('common.error'),
        description: t('checkout.pleaseEnterRequiredFields'),
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('checkout.passwordsDoNotMatch'),
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: t('common.error'),
        description: t('checkout.passwordTooShort'),
        variant: "destructive"
      });
      return;
    }

    try {
      setRegisterLoading(true);

      // If billing is shipping, use billing address for shipping
      const finalShippingAddress = billingIsShipping ? {
        street: billingStreet,
        city: billingCity,
        state: billingState,
        zipCode: billingZipCode,
        country: billingCountry
      } : {
        street: shippingStreet,
        city: shippingCity,
        state: shippingState,
        zipCode: shippingZipCode,
        country: shippingCountry
      };

      const response = await registerDuringCheckout({
        email,
        password,
        firstName,
        lastName,
        phone,
        company,
        country,
        vatId,
        billingAddress: {
          street: billingStreet,
          city: billingCity,
          state: billingState,
          zipCode: billingZipCode,
          country: billingCountry
        },
        shippingAddress: finalShippingAddress
      });

      // Store tokens and auto-login
      localStorage.setItem("accessToken", response.accessToken);
      localStorage.setItem("refreshToken", response.refreshToken);

      console.log('CheckoutDialog: Registration successful, merging guest cart...');

      // Merge guest cart with user cart after successful registration
      try {
        await mergeGuestCartWithUserCart({
          addToCart,
          addRepairOrderToCart
        });
        console.log('CheckoutDialog: Guest cart merged successfully');
      } catch (mergeError) {
        console.error('CheckoutDialog: Error merging guest cart:', mergeError);
        // Continue anyway - cart merge is not critical
      }

      toast({
        title: t('common.success'),
        description: t('checkout.accountCreatedSuccessfully')
      });

      // Close dialog and trigger success callback instead of reloading
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('checkout.registrationFailed'),
        variant: "destructive"
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleGuestCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!guestEmail || !guestFirstName || !guestLastName) {
      toast({
        title: t('common.error'),
        description: t('checkout.pleaseEnterGuestRequiredFields'),
        variant: "destructive"
      });
      return;
    }

    // Validate billing address
    if (!guestBillingStreet || !guestBillingCity || !guestBillingZipCode) {
      toast({
        title: t('common.error'),
        description: t('checkout.pleaseEnterGuestRequiredFields'),
        variant: "destructive"
      });
      return;
    }

    try {
      setGuestCheckoutLoading(true);

      // Get guest cart data
      const guestCart = getGuestCart();

      if (guestCart.items.length === 0 && guestCart.repairOrders.length === 0) {
        toast({
          title: t('common.error'),
          description: t('cart.failedToLoad'),
          variant: "destructive"
        });
        return;
      }

      // Prepare shipping address
      const finalShippingAddress = guestBillingIsShipping ? {
        street: guestBillingStreet,
        city: guestBillingCity,
        state: guestBillingState,
        zipCode: guestBillingZipCode,
        country: guestBillingCountry
      } : {
        street: guestShippingStreet,
        city: guestShippingCity,
        state: guestShippingState,
        zipCode: guestShippingZipCode,
        country: guestShippingCountry
      };

      const guestInfo = {
        email: guestEmail,
        firstName: guestFirstName,
        lastName: guestLastName,
        phone: guestPhone,
        billingAddress: {
          street: guestBillingStreet,
          city: guestBillingCity,
          state: guestBillingState,
          zipCode: guestBillingZipCode,
          country: guestBillingCountry
        },
        shippingAddress: finalShippingAddress
      };

      const cartData = {
        items: guestCart.items,
        repairOrders: guestCart.repairOrders
      };

      console.log('CheckoutDialog: Processing guest checkout with data:', { guestInfo, cartData });

      const response = await completeGuestCheckout(guestInfo, cartData);

      console.log('CheckoutDialog: Guest checkout successful:', response);

      // Clear guest cart after successful checkout
      clearGuestCart();

      // Store checkout result with tracking links
      setGuestCheckoutResult({
        success: true,
        bookingNumber: response.booking?.bookingNumber,
        orderNumbers: response.orders?.map((o: any) => o.orderNumber) || [],
        totalAmount: Number(response.orders?.reduce((sum: number, o: any) => sum + Number(o.totalCost || 0), 0) || 0),
        guestEmail: response.guestEmail,
        orderTrackingToken: response.trackingToken,
        bookingTrackingToken: response.bookingTrackingToken,
        orderCount: response.orderIds?.length || 0
      });

      toast({
        title: t('common.success'),
        description: t('checkout.guestCheckoutSuccessful')
      });

      // Don't close dialog - show tracking links instead
      // Dialog will be closed when user clicks "Done" on the success screen
    } catch (error: any) {
      console.error("Guest checkout error:", error);
      toast({
        title: t('common.error'),
        description: error.message || t('checkout.guestCheckoutFailed'),
        variant: "destructive"
      });
    } finally {
      setGuestCheckoutLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .checkout-dialog-content {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .checkout-tab-trigger {
          transition: all 0.2s ease;
        }

        .checkout-tab-trigger[data-state="active"] {
          background: linear-gradient(135deg, #1a2a5e 0%, #2a3f7e 100%);
          color: white;
          box-shadow: 0 4px 6px rgba(26, 42, 94, 0.2);
        }

        .checkout-tab-trigger:not([data-state="active"]):hover {
          background-color: #f5f6f8;
          color: #1a2a5e;
        }

        .checkout-button-primary {
          background: linear-gradient(135deg, #f5b800 0%, #e5ab00 100%);
          color: #1a2a5e;
          font-weight: 700;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(245, 184, 0, 0.3);
        }

        .checkout-button-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #e5ab00 0%, #d59f00 100%);
          box-shadow: 0 6px 16px rgba(245, 184, 0, 0.4);
          transform: translateY(-1px);
        }

        .checkout-button-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .checkout-input {
          border: 2px solid #d8dce6;
          transition: all 0.2s ease;
        }

        .checkout-input:focus {
          border-color: #1a2a5e;
          box-shadow: 0 0 0 3px rgba(26, 42, 94, 0.1);
        }

        .checkout-card {
          border: 1px solid #d8dce6;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease;
        }

        .checkout-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .checkout-section-title {
          color: #1a2a5e;
          font-weight: 700;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.375rem;
          border-bottom: 2px solid #f5b800;
          display: inline-block;
        }

        @media (max-width: 768px) {
          .checkout-dialog-content {
            max-width: 95vw;
          }
        }
      `}</style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto checkout-dialog-content" style={{ borderRadius: '12px', border: '2px solid #d8dce6' }}>
          {/* Success screen with tracking links */}
          {guestCheckoutResult ? (
            <>
              <DialogHeader className="pb-4 border-b-2" style={{ borderColor: '#eceef3' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="p-2 rounded-full" style={{ backgroundColor: '#d4edda' }}>
                    <UserCheck className="h-5 w-5" style={{ color: '#155724' }} />
                  </div>
                  <DialogTitle className="text-xl font-bold" style={{ color: '#155724' }}>
                    {t('checkout.orderPlacedSuccessfully')}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-sm" style={{ color: '#636e85' }}>
                  {t('checkout.trackingLinksDescription')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Order Summary */}
                <Card className="checkout-card">
                  <CardHeader>
                    <CardTitle className="text-base">{t('checkout.orderSummary')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('checkout.bookingNumber')}:</span>
                      <span className="text-sm font-semibold">{guestCheckoutResult.bookingNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('checkout.totalOrders')}:</span>
                      <span className="text-sm font-semibold">{guestCheckoutResult.orderCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('checkout.totalAmount')}:</span>
                      <span className="text-sm font-semibold">€{Number(guestCheckoutResult.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{t('checkout.confirmationEmail')}:</span>
                      <span className="text-sm font-semibold">{guestCheckoutResult.guestEmail}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Tracking Links */}
                <Card className="checkout-card" style={{ borderColor: '#1a2a5e' }}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: '#1a2a5e' }}>
                      {t('checkout.trackingLinks')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('checkout.saveTheseLinks')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Booking Tracking Link */}
                    {guestCheckoutResult.bookingTrackingToken && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900">
                            {t('checkout.trackCompleteBooking')}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-200 break-all text-xs font-mono mb-2">
                          {`${window.location.origin}/track-order/booking?token=${guestCheckoutResult.bookingTrackingToken}&email=${encodeURIComponent(guestCheckoutResult.guestEmail)}`}
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          style={{ backgroundColor: '#1a2a5e' }}
                          onClick={() => {
                            window.open(`/track-order/booking?token=${guestCheckoutResult.bookingTrackingToken}&email=${encodeURIComponent(guestCheckoutResult.guestEmail)}`, '_blank');
                          }}
                        >
                          {t('checkout.openBookingTracking')}
                        </Button>
                      </div>
                    )}

                    {/* Order Tracking Link */}
                    {guestCheckoutResult.orderTrackingToken && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-900">
                            {t('checkout.trackFirstOrder')}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded border border-green-200 break-all text-xs font-mono mb-2">
                          {`${window.location.origin}/track-order?token=${guestCheckoutResult.orderTrackingToken}&email=${encodeURIComponent(guestCheckoutResult.guestEmail)}`}
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          style={{ backgroundColor: '#28a745' }}
                          onClick={() => {
                            window.open(`/track-order?token=${guestCheckoutResult.orderTrackingToken}&email=${encodeURIComponent(guestCheckoutResult.guestEmail)}`, '_blank');
                          }}
                        >
                          {t('checkout.openOrderTracking')}
                        </Button>
                      </div>
                    )}

                    {/* Email confirmation note */}
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-xs text-yellow-900">
                        {t('checkout.trackingLinksEmailNote')}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Done Button */}
                <Button
                  className="w-full checkout-button-primary"
                  onClick={() => {
                    setGuestCheckoutResult(null);
                    onOpenChange(false);
                    onSuccess();
                  }}
                >
                  {t('common.close')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Regular checkout flow */}
              <DialogHeader className="pb-4 border-b-2" style={{ borderColor: '#eceef3' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-2 rounded-full" style={{ backgroundColor: '#f5f6f8' }}>
                <UserCheck className="h-5 w-5" style={{ color: '#1a2a5e' }} />
              </div>
              <DialogTitle className="text-xl font-bold" style={{ color: '#1a2a5e' }}>
                {t('checkout.authenticationRequired')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm" style={{ color: '#636e85' }}>
              {t('checkout.authenticationRequiredDesc')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="login" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3 gap-0.5 p-0.5 sm:p-1 rounded-lg mb-6 sm:mb-4" style={{ backgroundColor: '#f5f6f8', border: '2px solid #eceef3' }}>
              <TabsTrigger 
                value="login" 
                className="checkout-tab-trigger rounded-md py-1.5 sm:py-2 px-0.5 sm:px-2 text-[9px] sm:text-xs font-semibold flex items-center justify-center"
                style={{ color: '#2d3748' }}
              >
                <LogIn className="h-2.5 w-2.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">{t('checkout.login')}</span>
                <span className="sm:hidden truncate">Login</span>
              </TabsTrigger>
              <TabsTrigger 
                value="register" 
                className="checkout-tab-trigger rounded-md py-1.5 sm:py-2 px-0.5 sm:px-2 text-[9px] sm:text-xs font-semibold flex items-center justify-center"
                style={{ color: '#2d3748' }}
              >
                <UserPlus className="h-2.5 w-2.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">{t('checkout.createAccount')}</span>
                <span className="sm:hidden truncate">Register</span>
              </TabsTrigger>
              <TabsTrigger 
                value="guest" 
                className="checkout-tab-trigger rounded-md py-1.5 sm:py-2 px-0.5 sm:px-2 text-[9px] sm:text-xs font-semibold flex items-center justify-center"
                style={{ color: '#2d3748' }}
              >
                <UserCheck className="h-2.5 w-2.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">{t('checkout.guestCheckout')}</span>
                <span className="sm:hidden truncate">Gast</span>
              </TabsTrigger>
            </TabsList>

          {/* Login Tab */}
          <TabsContent value="login" className="mt-2">
            <Card className="checkout-card" style={{ borderRadius: '10px', backgroundColor: 'white' }}>
              <CardHeader className="pb-3 pt-4 px-4" style={{ borderBottom: '1px solid #eceef3' }}>
                <div className="flex items-center gap-2 mb-1">
                  <LogIn className="h-4 w-4" style={{ color: '#1a2a5e' }} />
                  <CardTitle className="text-base font-bold" style={{ color: '#1a2a5e' }}>
                    {t('checkout.loginToYourAccount')}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs" style={{ color: '#636e85' }}>
                  {t('checkout.loginToYourAccountDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3 px-3 pb-3">
                <form onSubmit={handleLogin} className="space-y-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="login-email" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                      {t('checkout.email')}
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('checkout.emailPlaceholder')}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="checkout-input h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="login-password" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                      {t('checkout.password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder={t('checkout.passwordPlaceholder')}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="checkout-input h-8 pr-9 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full hover:bg-transparent"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        style={{ color: '#636e85' }}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full checkout-button-primary h-9 text-sm font-bold rounded-lg mt-3" 
                    disabled={loginLoading}
                  >
                    {loginLoading ? t('common.loading') : t('checkout.login')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register" className="mt-2">
            <Card className="checkout-card" style={{ borderRadius: '10px', backgroundColor: 'white' }}>
              <CardHeader className="pb-3 pt-4 px-4" style={{ borderBottom: '1px solid #eceef3' }}>
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="h-4 w-4" style={{ color: '#1a2a5e' }} />
                  <CardTitle className="text-base font-bold" style={{ color: '#1a2a5e' }}>
                    {t('checkout.createNewAccount')}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs" style={{ color: '#636e85' }}>
                  {t('checkout.createNewAccountDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3 px-3 pb-3">
                <form onSubmit={handleRegister} className="space-y-3">
                  {/* Personal Information */}
                  <div className="space-y-2">
                    <h3 className="checkout-section-title">{t('checkout.personalInformation')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="firstName" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.firstName')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="lastName" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.lastName')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.email')} <span style={{ color: '#f5b800' }}>*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.phone')}
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="password" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.password')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="checkout-input h-8 pr-9 text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ color: '#636e85' }}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="confirmPassword" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.confirmPassword')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="checkout-input h-8 pr-9 text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            style={{ color: '#636e85' }}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Information */}
                  <div className="space-y-2">
                    <h3 className="checkout-section-title">{t('checkout.companyInformation')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="company" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.company')}
                        </Label>
                        <Input
                          id="company"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="country" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.country')}
                        </Label>
                        <Input
                          id="country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="vatId" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.vatId')}
                      </Label>
                      <Input
                        id="vatId"
                        value={vatId}
                        onChange={(e) => setVatId(e.target.value)}
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="space-y-2">
                    <h3 className="checkout-section-title">{t('checkout.billingAddress')}</h3>
                    <div className="space-y-1">
                      <Label htmlFor="billingStreet" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.street')}
                      </Label>
                      <Input
                        id="billingStreet"
                        value={billingStreet}
                        onChange={(e) => setBillingStreet(e.target.value)}
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="billingCity" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.city')}
                        </Label>
                        <Input
                          id="billingCity"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="billingState" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.state')}
                        </Label>
                        <Input
                          id="billingState"
                          value={billingState}
                          onChange={(e) => setBillingState(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="billingZipCode" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.zipCode')}
                        </Label>
                        <Input
                          id="billingZipCode"
                          value={billingZipCode}
                          onChange={(e) => setBillingZipCode(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="billingCountry" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.country')}
                        </Label>
                        <Input
                          id="billingCountry"
                          value={billingCountry}
                          onChange={(e) => setBillingCountry(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address Checkbox */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2.5 rounded-lg" style={{ backgroundColor: '#f5f6f8', border: '2px solid #eceef3' }}>
                      <Checkbox
                        id="billingIsShipping"
                        checked={billingIsShipping}
                        onCheckedChange={(checked) => setBillingIsShipping(checked === true)}
                        className="border-2"
                        style={{ borderColor: '#1a2a5e' }}
                      />
                      <Label
                        htmlFor="billingIsShipping"
                        className="text-xs font-semibold cursor-pointer"
                        style={{ color: '#2d3748' }}
                      >
                        {t('checkout.billingIsShippingAddress')}
                      </Label>
                    </div>
                  </div>

                  {/* Shipping Address - Only show when billing is NOT shipping */}
                  {!billingIsShipping && (
                    <div className="space-y-2">
                      <h3 className="checkout-section-title">{t('checkout.shippingAddress')}</h3>
                      <div className="space-y-1">
                        <Label htmlFor="shippingStreet" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.street')}
                        </Label>
                        <Input
                          id="shippingStreet"
                          value={shippingStreet}
                          onChange={(e) => setShippingStreet(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="shippingCity" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.city')}
                          </Label>
                          <Input
                            id="shippingCity"
                            value={shippingCity}
                            onChange={(e) => setShippingCity(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="shippingState" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.state')}
                          </Label>
                          <Input
                            id="shippingState"
                            value={shippingState}
                            onChange={(e) => setShippingState(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="shippingZipCode" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.zipCode')}
                          </Label>
                          <Input
                            id="shippingZipCode"
                            value={shippingZipCode}
                            onChange={(e) => setShippingZipCode(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="shippingCountry" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.country')}
                          </Label>
                          <Input
                            id="shippingCountry"
                            value={shippingCountry}
                            onChange={(e) => setShippingCountry(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full checkout-button-primary h-9 text-sm font-bold rounded-lg" 
                    disabled={registerLoading}
                  >
                    {registerLoading ? t('common.loading') : t('checkout.createAccount')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guest Checkout Tab */}
          <TabsContent value="guest" className="mt-2">
            <Card className="checkout-card" style={{ borderRadius: '10px', backgroundColor: 'white' }}>
              <CardHeader className="pb-3 pt-3 px-3" style={{ borderBottom: '1px solid #eceef3' }}>
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="h-4 w-4" style={{ color: '#1a2a5e' }} />
                  <CardTitle className="text-base font-bold" style={{ color: '#1a2a5e' }}>
                    {t('checkout.continueAsGuest')}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs" style={{ color: '#636e85' }}>
                  {t('checkout.continueAsGuestDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3 px-3 pb-3">
                <form onSubmit={handleGuestCheckout} className="space-y-2.5">
                  {/* Personal Information */}
                  <div className="space-y-2">
                    <h3 className="checkout-section-title">{t('checkout.personalInformation')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="guest-firstName" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.firstName')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <Input
                          id="guest-firstName"
                          value={guestFirstName}
                          onChange={(e) => setGuestFirstName(e.target.value)}
                          required
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guest-lastName" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.lastName')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <Input
                          id="guest-lastName"
                          value={guestLastName}
                          onChange={(e) => setGuestLastName(e.target.value)}
                          required
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="guest-email" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.email')} <span style={{ color: '#f5b800' }}>*</span>
                      </Label>
                      <Input
                        id="guest-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        required
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="guest-phone" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.phone')}
                      </Label>
                      <Input
                        id="guest-phone"
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="space-y-2">
                    <h3 className="checkout-section-title">{t('checkout.billingAddress')}</h3>
                    <div className="space-y-1">
                      <Label htmlFor="guest-billingStreet" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                        {t('checkout.street')} <span style={{ color: '#f5b800' }}>*</span>
                      </Label>
                      <Input
                        id="guest-billingStreet"
                        value={guestBillingStreet}
                        onChange={(e) => setGuestBillingStreet(e.target.value)}
                        required
                        className="checkout-input h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="guest-billingCity" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.city')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <Input
                          id="guest-billingCity"
                          value={guestBillingCity}
                          onChange={(e) => setGuestBillingCity(e.target.value)}
                          required
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guest-billingState" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.state')}
                        </Label>
                        <Input
                          id="guest-billingState"
                          value={guestBillingState}
                          onChange={(e) => setGuestBillingState(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="guest-billingZipCode" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.zipCode')} <span style={{ color: '#f5b800' }}>*</span>
                        </Label>
                        <Input
                          id="guest-billingZipCode"
                          value={guestBillingZipCode}
                          onChange={(e) => setGuestBillingZipCode(e.target.value)}
                          required
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guest-billingCountry" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.country')}
                        </Label>
                        <Input
                          id="guest-billingCountry"
                          value={guestBillingCountry}
                          onChange={(e) => setGuestBillingCountry(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address Checkbox */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 p-2.5 rounded-lg" style={{ backgroundColor: '#f5f6f8', border: '2px solid #eceef3' }}>
                      <Checkbox
                        id="guest-billingIsShipping"
                        checked={guestBillingIsShipping}
                        onCheckedChange={(checked) => setGuestBillingIsShipping(checked === true)}
                        className="border-2"
                        style={{ borderColor: '#1a2a5e' }}
                      />
                      <Label
                        htmlFor="guest-billingIsShipping"
                        className="text-xs font-semibold cursor-pointer"
                        style={{ color: '#2d3748' }}
                      >
                        {t('checkout.billingIsShippingAddress')}
                      </Label>
                    </div>
                  </div>

                  {/* Shipping Address - Only show when billing is NOT shipping */}
                  {!guestBillingIsShipping && (
                    <div className="space-y-2">
                      <h3 className="checkout-section-title">{t('checkout.shippingAddress')}</h3>
                      <div className="space-y-1">
                        <Label htmlFor="guest-shippingStreet" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                          {t('checkout.street')}
                        </Label>
                        <Input
                          id="guest-shippingStreet"
                          value={guestShippingStreet}
                          onChange={(e) => setGuestShippingStreet(e.target.value)}
                          className="checkout-input h-8 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="guest-shippingCity" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.city')}
                          </Label>
                          <Input
                            id="guest-shippingCity"
                            value={guestShippingCity}
                            onChange={(e) => setGuestShippingCity(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="guest-shippingState" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.state')}
                          </Label>
                          <Input
                            id="guest-shippingState"
                            value={guestShippingState}
                            onChange={(e) => setGuestShippingState(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="guest-shippingZipCode" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.zipCode')}
                          </Label>
                          <Input
                            id="guest-shippingZipCode"
                            value={guestShippingZipCode}
                            onChange={(e) => setGuestShippingZipCode(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="guest-shippingCountry" className="text-xs font-semibold" style={{ color: '#2d3748' }}>
                            {t('checkout.country')}
                          </Label>
                          <Input
                            id="guest-shippingCountry"
                            value={guestShippingCountry}
                            onChange={(e) => setGuestShippingCountry(e.target.value)}
                            className="checkout-input h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full checkout-button-primary h-9 text-sm font-bold rounded-lg" 
                    disabled={guestCheckoutLoading}
                  >
                    {guestCheckoutLoading ? t('common.loading') : t('checkout.continueAsGuest')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </>
          )}
      </DialogContent>
    </Dialog>
    </>
  );
}
