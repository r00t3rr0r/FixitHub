import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { useTranslation } from "react-i18next"
import { Eye, EyeOff, LogIn, Loader2, UserPlus, UserCheck } from "lucide-react"
import { registerDuringCheckout, resendCheckoutVerificationEmail } from "@/api/checkout"
import { CountrySelect } from "@/components/checkout/CountrySelect"
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries"

export interface GuestInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface AuthRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  onGuestProceed?: (guestInfo: GuestInfo) => void
  showGuestTab?: boolean
  title?: string
  description?: string
}

export function AuthRequiredDialog({
  open,
  onOpenChange,
  onSuccess,
  onGuestProceed,
  showGuestTab = false,
  title = "Authentifizierung erforderlich",
  description = "Bitte melden Sie sich an oder erstellen Sie ein Konto, um fortzufahren.",
}: AuthRequiredDialogProps) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const { toast } = useToast()

  // Login state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  // Register state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [accountType, setAccountType] = useState<"private" | "business">("private")
  const [company, setCompany] = useState("")
  const [country, setCountry] = useState(DEFAULT_COUNTRY_CODE)
  const [vatId, setVatId] = useState("")
  const [registerLoading, setRegisterLoading] = useState(false)
  const [verificationEmailSent, setVerificationEmailSent] = useState(false)
  const [verificationEmailAddress, setVerificationEmailAddress] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  // Guest state
  const [guestFirstName, setGuestFirstName] = useState("")
  const [guestLastName, setGuestLastName] = useState("")
  const [guestEmail, setGuestEmail] = useState("")
  const [guestPhone, setGuestPhone] = useState("")

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown <= 0) return
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCountdown])

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setLoginEmail("")
      setLoginPassword("")
      setShowLoginPassword(false)
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setFirstName("")
      setLastName("")
      setPhone("")
      setAccountType("private")
      setCompany("")
      setCountry(DEFAULT_COUNTRY_CODE)
      setVatId("")
      setVerificationEmailSent(false)
      setVerificationEmailAddress("")
      setResendCountdown(0)
      setGuestFirstName("")
      setGuestLastName("")
      setGuestEmail("")
      setGuestPhone("")
    }
  }, [open])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      toast({ title: t("common.error"), description: t("checkout.pleaseEnterEmailPassword"), variant: "destructive" })
      return
    }
    try {
      setLoginLoading(true)
      await login(loginEmail, loginPassword)
      toast({ title: t("common.success"), description: t("checkout.loginSuccessful") })
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message || t("checkout.loginFailed"), variant: "destructive" })
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (verificationEmailSent) return

    if (!email || !password || !firstName || !lastName) {
      toast({ title: t("common.error"), description: t("checkout.pleaseEnterRequiredFields"), variant: "destructive" })
      return
    }
    if (password !== confirmPassword) {
      toast({ title: t("common.error"), description: t("checkout.passwordsDoNotMatch"), variant: "destructive" })
      return
    }
    if (password.length < 6) {
      toast({ title: t("common.error"), description: t("checkout.passwordTooShort"), variant: "destructive" })
      return
    }
    if (accountType === "business" && !company.trim()) {
      toast({ title: t("common.error"), description: "Bitte geben Sie Ihren Firmennamen an.", variant: "destructive" })
      return
    }

    try {
      setRegisterLoading(true)
      const response = await registerDuringCheckout({
        email,
        password,
        firstName,
        lastName,
        phone,
        company: accountType === "business" ? company : "",
        country,
        vatId: accountType === "business" ? vatId : "",
      })
      toast({
        title: t("common.success"),
        description: response?.message || "Bitte bestätigen Sie Ihre E-Mail-Adresse, um sich anmelden zu können.",
      })
      setVerificationEmailAddress(email)
      setVerificationEmailSent(true)
      setResendCountdown(60)
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message || t("checkout.registrationFailed"), variant: "destructive" })
    } finally {
      setRegisterLoading(false)
    }
  }

  const handleResendVerificationEmail = async () => {    if (!verificationEmailAddress || resendLoading || resendCountdown > 0) return
    try {
      setResendLoading(true)
      const response = await resendCheckoutVerificationEmail(verificationEmailAddress)
      toast({ title: t("common.success"), description: response?.message || "Verifizierungs-E-Mail wurde erneut gesendet." })
      setResendCountdown(60)
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message || "Verifizierungs-E-Mail konnte nicht erneut gesendet werden.", variant: "destructive" })
    } finally {
      setResendLoading(false)
    }
  }

  const handleGuestProceed = (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestFirstName.trim() || !guestLastName.trim() || !guestEmail.trim()) {
      toast({ title: t("common.error"), description: "Bitte Vorname, Nachname und E-Mail angeben.", variant: "destructive" })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      toast({ title: t("common.error"), description: "Bitte eine gültige E-Mail-Adresse eingeben.", variant: "destructive" })
      return
    }
    onOpenChange(false)
    onGuestProceed?.({ firstName: guestFirstName.trim(), lastName: guestLastName.trim(), email: guestEmail.trim(), phone: guestPhone.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-xl border border-[#d8dce6] p-0 sm:max-w-lg">
        <div className="sticky top-0 z-10 bg-[#1a2a5e] px-4 py-3 sm:px-5 sm:py-3.5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-base font-bold tracking-tight !text-[#f5b800] sm:text-lg">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-blue-100 sm:text-sm">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-4 sm:p-5">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className={`mb-4 grid h-auto w-full gap-1 rounded-lg border border-[#d8dce6] bg-[#f6f8fc] p-1 ${showGuestTab ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="login" className="h-8 text-[11px] font-semibold sm:text-xs">
                <LogIn className="mr-1 h-3.5 w-3.5" /> {t("checkout.login")}
              </TabsTrigger>
              <TabsTrigger value="register" className="h-8 text-[11px] font-semibold sm:text-xs">
                <UserPlus className="mr-1 h-3.5 w-3.5" /> {t("checkout.createAccount")}
              </TabsTrigger>
              {showGuestTab && (
                <TabsTrigger value="guest" className="h-8 text-[11px] font-semibold sm:text-xs">
                  <UserCheck className="mr-1 h-3.5 w-3.5" /> Als Gast
                </TabsTrigger>
              )}
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="mt-0">
              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-bold text-[#1a2a5e]">{t("checkout.loginToYourAccount")}</CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  <form onSubmit={handleLogin} className="space-y-2.5">
                    <div className="space-y-1">
                      <Label htmlFor="auth-login-email" className="text-xs font-semibold">{t("checkout.email")}</Label>
                      <Input
                        id="auth-login-email"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="auth-login-password" className="text-xs font-semibold">{t("checkout.password")}</Label>
                      <div className="relative">
                        <Input
                          id="auth-login-password"
                          type={showLoginPassword ? "text" : "password"}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="h-8 pr-9 text-sm"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-8 w-8"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
                      disabled={loginLoading}
                    >
                      {loginLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.loading")}</> : t("checkout.login")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="mt-0">
              <Card className="border-[#d8dce6]">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-bold text-[#1a2a5e]">{t("checkout.createNewAccount")}</CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="auth-reg-firstName" className="text-xs font-semibold">
                          {t("checkout.firstName")} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="auth-reg-firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="h-8 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="auth-reg-lastName" className="text-xs font-semibold">
                          {t("checkout.lastName")} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="auth-reg-lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="h-8 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="auth-reg-email" className="text-xs font-semibold">
                        {t("checkout.email")} <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="auth-reg-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-8 text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="auth-reg-phone" className="text-xs font-semibold">{t("checkout.phone")}</Label>
                      <Input
                        id="auth-reg-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="auth-reg-password" className="text-xs font-semibold">
                          {t("checkout.password")} <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="auth-reg-password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-8 pr-9 text-sm"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-8 w-8"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="auth-reg-confirmPassword" className="text-xs font-semibold">
                          {t("checkout.confirmPassword")} <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="auth-reg-confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-8 pr-9 text-sm"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-8 w-8"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 rounded-lg border border-[#e3e8f2] bg-[#f6f8fc] p-2.5">
                      <Label className="text-xs font-semibold text-[#1a2a5e]">{t("checkout.accountType")}</Label>
                      <RadioGroup
                        value={accountType}
                        onValueChange={(v) => setAccountType(v === "business" ? "business" : "private")}
                        className="flex flex-row gap-4"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem id="auth-accountType-private" value="private" />
                          <Label htmlFor="auth-accountType-private" className="cursor-pointer text-xs">
                            {t("checkout.privateCustomer")}
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem id="auth-accountType-business" value="business" />
                          <Label htmlFor="auth-accountType-business" className="cursor-pointer text-xs">
                            {t("checkout.businessCustomer")}
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {accountType === "business" && (
                        <div className="space-y-1">
                          <Label htmlFor="auth-reg-company" className="text-xs font-semibold">
                            {t("checkout.company")} <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="auth-reg-company"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="h-8 text-sm"
                            required={accountType === "business"}
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label htmlFor="auth-reg-country" className="text-xs font-semibold">{t("checkout.country")}</Label>
                        <CountrySelect
                          id="auth-reg-country"
                          value={country}
                          onChange={setCountry}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {accountType === "business" && (
                      <div className="space-y-1">
                        <Label htmlFor="auth-reg-vatId" className="text-xs font-semibold">{t("checkout.vatId")}</Label>
                        <Input
                          id="auth-reg-vatId"
                          value={vatId}
                          onChange={(e) => setVatId(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
                      disabled={registerLoading || verificationEmailSent}
                    >
                      {registerLoading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.loading")}</>
                        : verificationEmailSent
                          ? "Verifizierungs-E-Mail bereits gesendet"
                          : t("checkout.createAccount")}
                    </Button>

                    {verificationEmailSent && (
                      <div className="space-y-2 rounded-md border border-[#c7e9cf] bg-[#effaf2] px-2.5 py-2 text-[11px] text-[#166534]">
                        <p>
                          Die Verifizierungs-E-Mail wurde gesendet. Bitte bestätigen Sie Ihre E-Mail-Adresse und melden Sie sich anschließend über den Tab <strong>Anmelden</strong> an.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 w-full border-[#8bbf9b] text-[11px] font-semibold text-[#14532d] hover:bg-[#dff3e5]"
                          onClick={handleResendVerificationEmail}
                          disabled={resendLoading || resendCountdown > 0}
                        >
                          {resendLoading
                            ? "Wird gesendet..."
                            : resendCountdown > 0
                              ? `Erneut senden in ${resendCountdown}s`
                              : "Verifizierungs-E-Mail erneut senden"}
                        </Button>
                      </div>
                    )}

                    <p className="text-[10px] text-[#8b9dbf]">
                      <span className="text-red-500">*</span> {t("checkout.requiredFieldsNote")}
                    </p>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Guest Tab */}
            {showGuestTab && (
              <TabsContent value="guest" className="mt-0">
                <Card className="border-[#d8dce6]">
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-sm font-bold text-[#1a2a5e]">Als Gast fortfahren</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-1">
                    <form onSubmit={handleGuestProceed} className="space-y-3">
                      <div className="rounded-md border border-[#d8e9fa] bg-[#f0f7ff] px-3 py-2 text-[11px] text-[#1a2a5e]">
                        Sie erhalten nach Absenden eine Bestätigungs-E-Mail mit einem Tracking-Link, über den Sie Ihre Anfrage jederzeit einsehen und mit uns kommunizieren können.
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="guest-firstName" className="text-xs font-semibold">
                            Vorname <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="guest-firstName"
                            value={guestFirstName}
                            onChange={(e) => setGuestFirstName(e.target.value)}
                            className="h-8 text-sm"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="guest-lastName" className="text-xs font-semibold">
                            Nachname <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="guest-lastName"
                            value={guestLastName}
                            onChange={(e) => setGuestLastName(e.target.value)}
                            className="h-8 text-sm"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guest-email" className="text-xs font-semibold">
                          E-Mail <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="guest-email"
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className="h-8 text-sm"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="guest-phone" className="text-xs font-semibold">Telefon</Label>
                        <Input
                          id="guest-phone"
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Optional"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
                      >
                        <UserCheck className="mr-2 h-4 w-4" /> Anfrage als Gast absenden
                      </Button>
                      <p className="text-[10px] text-[#8b9dbf]">
                        <span className="text-red-500">*</span> Pflichtfelder
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
