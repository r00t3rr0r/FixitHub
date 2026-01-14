import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { registerDuringCheckout } from "@/api/checkout";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from 'react-i18next';
import { UserPlus, LogIn, Eye, EyeOff } from "lucide-react";
import { mergeGuestCartWithUserCart } from "@/utils/guestCart";
import { addToCart, addRepairOrderToCart } from "@/api/shop";

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

  const [registerLoading, setRegisterLoading] = useState(false);

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
        shippingAddress: {
          street: shippingStreet,
          city: shippingCity,
          state: shippingState,
          zipCode: shippingZipCode,
          country: shippingCountry
        }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('checkout.authenticationRequired')}</DialogTitle>
          <DialogDescription>
            {t('checkout.authenticationRequiredDesc')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">
              <LogIn className="h-4 w-4 mr-2" />
              {t('checkout.login')}
            </TabsTrigger>
            <TabsTrigger value="register">
              <UserPlus className="h-4 w-4 mr-2" />
              {t('checkout.createAccount')}
            </TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.loginToYourAccount')}</CardTitle>
                <CardDescription>{t('checkout.loginToYourAccountDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t('checkout.email')}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder={t('checkout.emailPlaceholder')}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('checkout.password')}</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        placeholder={t('checkout.passwordPlaceholder')}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? t('common.loading') : t('checkout.login')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.createNewAccount')}</CardTitle>
                <CardDescription>{t('checkout.createNewAccountDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">{t('checkout.personalInformation')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">{t('checkout.firstName')} *</Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">{t('checkout.lastName')} *</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('checkout.email')} *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t('checkout.phone')}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="password">{t('checkout.password')} *</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">{t('checkout.confirmPassword')} *</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Company Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">{t('checkout.companyInformation')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">{t('checkout.company')}</Label>
                        <Input
                          id="company"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">{t('checkout.country')}</Label>
                        <Input
                          id="country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vatId">{t('checkout.vatId')}</Label>
                      <Input
                        id="vatId"
                        value={vatId}
                        onChange={(e) => setVatId(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Billing Address */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">{t('checkout.billingAddress')}</h3>
                    <div className="space-y-2">
                      <Label htmlFor="billingStreet">{t('checkout.street')}</Label>
                      <Input
                        id="billingStreet"
                        value={billingStreet}
                        onChange={(e) => setBillingStreet(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="billingCity">{t('checkout.city')}</Label>
                        <Input
                          id="billingCity"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billingState">{t('checkout.state')}</Label>
                        <Input
                          id="billingState"
                          value={billingState}
                          onChange={(e) => setBillingState(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="billingZipCode">{t('checkout.zipCode')}</Label>
                        <Input
                          id="billingZipCode"
                          value={billingZipCode}
                          onChange={(e) => setBillingZipCode(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billingCountry">{t('checkout.country')}</Label>
                        <Input
                          id="billingCountry"
                          value={billingCountry}
                          onChange={(e) => setBillingCountry(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">{t('checkout.shippingAddress')}</h3>
                    <div className="space-y-2">
                      <Label htmlFor="shippingStreet">{t('checkout.street')}</Label>
                      <Input
                        id="shippingStreet"
                        value={shippingStreet}
                        onChange={(e) => setShippingStreet(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shippingCity">{t('checkout.city')}</Label>
                        <Input
                          id="shippingCity"
                          value={shippingCity}
                          onChange={(e) => setShippingCity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shippingState">{t('checkout.state')}</Label>
                        <Input
                          id="shippingState"
                          value={shippingState}
                          onChange={(e) => setShippingState(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shippingZipCode">{t('checkout.zipCode')}</Label>
                        <Input
                          id="shippingZipCode"
                          value={shippingZipCode}
                          onChange={(e) => setShippingZipCode(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shippingCountry">{t('checkout.country')}</Label>
                        <Input
                          id="shippingCountry"
                          value={shippingCountry}
                          onChange={(e) => setShippingCountry(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={registerLoading}>
                    {registerLoading ? t('common.loading') : t('checkout.createAccount')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
