import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import {
  registerDuringCheckout,
  resendCheckoutVerificationEmail,
  completeGuestCheckout,
  initializeCheckout,
  completeCheckout,
  getCheckoutPaypalConfig,
  createCheckoutPaypalOrder,
  captureCheckoutPaypalOrder,
  getGuestCheckoutPaypalConfig,
  createGuestCheckoutPaypalOrder,
  captureGuestCheckoutPaypalOrder,
  type CheckoutApiError,
  type CheckoutPaypalConfig,
} from "@/api/checkout"
import { updateUserProfile } from "@/api/user"
import { useToast } from "@/hooks/useToast"
import { useTranslation } from "react-i18next"
import {
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  UserCheck,
  Package,
  CreditCard,
  Landmark,
  Wallet,
  Shield,
  Loader2,
  CheckCircle2,
  Lock,
  Truck,
  MapPin,
  Mail,
  Phone,
  User,
  Check,
  Wrench,
  Tag,
} from "lucide-react"
import { addToCart, addRepairOrderToCart, Cart } from "@/api/shop"
import { getGuestCart, clearGuestCart } from "@/utils/guestCart"
import { CountrySelect } from "@/components/checkout/CountrySelect"
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
  cart: Cart | null
}

type CheckoutMode = "authenticated" | "guest" | null

type GuestInfoState = {
  email: string
  firstName: string
  lastName: string
  phone: string
  billingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  shippingAddress: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}

type PaypalButtonsInstance = {
  isEligible?: () => boolean
  render: (container: HTMLElement) => Promise<void> | void
}

type PaypalNamespace = {
  Buttons: (options: unknown) => PaypalButtonsInstance
}

declare global {
  interface Window {
    paypal?: PaypalNamespace
  }
}

export function CheckoutDialog({ open, onOpenChange, onSuccess, cart }: CheckoutDialogProps) {
  const { t } = useTranslation()
  const { login, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<"auth" | "review">("auth")
  const [mode, setMode] = useState<CheckoutMode>(null)
  const [reviewCart, setReviewCart] = useState<Cart | null>(null)
  const [initializingCheckout, setInitializingCheckout] = useState(false)

  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "invoice">("card")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [highlightTermsConsent, setHighlightTermsConsent] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)

  const [checkoutSuccessResult, setCheckoutSuccessResult] = useState<any>(null)
  const [guestCheckoutResult, setGuestCheckoutResult] = useState<any>(null)
  const [userInfo, setUserInfo] = useState<any>(null)

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

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

  const [billingStreet, setBillingStreet] = useState("")
  const [billingCity, setBillingCity] = useState("")
  const [billingState, setBillingState] = useState("")
  const [billingZipCode, setBillingZipCode] = useState("")
  const [billingCountry, setBillingCountry] = useState(DEFAULT_COUNTRY_CODE)

  const [shippingStreet, setShippingStreet] = useState("")
  const [shippingCity, setShippingCity] = useState("")
  const [shippingState, setShippingState] = useState("")
  const [shippingZipCode, setShippingZipCode] = useState("")
  const [shippingCountry, setShippingCountry] = useState(DEFAULT_COUNTRY_CODE)

  const [billingIsShipping, setBillingIsShipping] = useState(true)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [resendVerificationLoading, setResendVerificationLoading] = useState(false)
  const [verificationEmailSent, setVerificationEmailSent] = useState(false)
  const [verificationEmailDialogOpen, setVerificationEmailDialogOpen] = useState(false)
  const [verificationEmailAddress, setVerificationEmailAddress] = useState("")
  const [resendCountdown, setResendCountdown] = useState(0)

  const [guestEmail, setGuestEmail] = useState("")
  const [guestFirstName, setGuestFirstName] = useState("")
  const [guestLastName, setGuestLastName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")

  const [guestBillingStreet, setGuestBillingStreet] = useState("")
  const [guestBillingCity, setGuestBillingCity] = useState("")
  const [guestBillingState, setGuestBillingState] = useState("")
  const [guestBillingZipCode, setGuestBillingZipCode] = useState("")
  const [guestBillingCountry, setGuestBillingCountry] = useState("")

  const [guestShippingStreet, setGuestShippingStreet] = useState("")
  const [guestShippingCity, setGuestShippingCity] = useState("")
  const [guestShippingState, setGuestShippingState] = useState("")
  const [guestShippingZipCode, setGuestShippingZipCode] = useState("")
  const [guestShippingCountry, setGuestShippingCountry] = useState("")

  const [guestBillingIsShipping, setGuestBillingIsShipping] = useState(true)

  const [guestInfo, setGuestInfo] = useState<GuestInfoState | null>(null)

  const [billingAddressEditorOpen, setBillingAddressEditorOpen] = useState(false)
  const [billingAddressNeedsAttention, setBillingAddressNeedsAttention] = useState(false)
  const [savingBillingAddress, setSavingBillingAddress] = useState(false)
  const [billingAddressStreetDraft, setBillingAddressStreetDraft] = useState("")
  const [billingAddressCityDraft, setBillingAddressCityDraft] = useState("")
  const [billingAddressZipDraft, setBillingAddressZipDraft] = useState("")
  const [billingAddressCountryDraft, setBillingAddressCountryDraft] = useState("")

  // Payment-method-specific field states
  const [cardholderName, setCardholderName] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvc, setCardCvc] = useState("")
  const [paypalEmail, setPaypalEmail] = useState("")
  const paypalButtonRef = useRef<HTMLDivElement | null>(null)
  const [paypalConfig, setPaypalConfig] = useState<CheckoutPaypalConfig | null>(null)
  const [paypalSdkReady, setPaypalSdkReady] = useState(false)
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [paypalError, setPaypalError] = useState("")

  const getProductImage = (product: any) => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images[0]
    }

    if (typeof product?.image === "string" && product.image.trim()) {
      return product.image
    }

    return null
  }

  const getRepairOrderImage = (order: any) => {
    if (typeof order?.deviceImage === "string" && order.deviceImage.trim()) {
      return order.deviceImage
    }

    if (Array.isArray(order?.photos) && order.photos.length > 0) {
      return order.photos[0]
    }

    return null
  }

  const totals = useMemo(() => {
    const subtotal = Number(reviewCart?.subtotal || 0)
    const tax = Number(reviewCart?.tax || 0)
    const discount = Number(reviewCart?.discount || 0)
    const total = Number(reviewCart?.total || 0)
    return { subtotal, tax, discount, total }
  }, [reviewCart])

  const paymentOptions = [
    {
      value: "card" as const,
      label: t("checkout.paymentCard"),
      icon: CreditCard,
      hint: t("checkout.paymentCardHint"),
    },
    {
      value: "paypal" as const,
      label: t("checkout.paymentPaypal"),
      icon: Wallet,
      hint: t("checkout.paymentPaypalHint"),
    },
    {
      value: "invoice" as const,
      label: t("checkout.paymentInvoice"),
      icon: Landmark,
      hint: t("checkout.paymentInvoiceHint"),
    },
  ]

  const resetReviewState = () => {
    setStep("auth")
    setMode(null)
    setReviewCart(null)
    setGuestInfo(null)
    setUserInfo(null)
    setInitializingCheckout(false)
    setProcessingCheckout(false)
    setPaymentMethod("card")
    setAcceptTerms(false)
    setHighlightTermsConsent(false)
    setCardholderName("")
    setCardNumber("")
    setCardExpiry("")
    setCardCvc("")
    setPaypalEmail("")
    setPaypalConfig(null)
    setPaypalSdkReady(false)
    setPaypalLoading(false)
    setPaypalError("")
    setBillingAddressEditorOpen(false)
    setBillingAddressNeedsAttention(false)
    setSavingBillingAddress(false)
    setBillingAddressStreetDraft("")
    setBillingAddressCityDraft("")
    setBillingAddressZipDraft("")
    setBillingAddressCountryDraft("")
    setVerificationEmailSent(false)
    setVerificationEmailDialogOpen(false)
    setVerificationEmailAddress("")
    setResendVerificationLoading(false)
    setResendCountdown(0)
  }

  const hasMissingBillingAddress = (address: any) => {
    return !address?.street || !address?.city || !address?.zipCode
  }

  const handleSaveBillingAddress = async () => {
    if (!billingAddressStreetDraft.trim() || !billingAddressCityDraft.trim() || !billingAddressZipDraft.trim()) {
      toast({
        title: t("common.error"),
        description: "Bitte Straße, Stadt und PLZ ausfüllen.",
        variant: "destructive",
      })
      return
    }

    try {
      setSavingBillingAddress(true)

      const invoiceAddress = {
        street: billingAddressStreetDraft.trim(),
        city: billingAddressCityDraft.trim(),
        state: userInfo?.billingAddress?.state || "",
        zipCode: billingAddressZipDraft.trim(),
        country: (billingAddressCountryDraft || "DE").trim(),
      }

      const existingPaymentAddress = userInfo?.shippingAddress || {}
      const sameAsInvoice = !existingPaymentAddress?.street

      await updateUserProfile({
        invoiceAddress,
        paymentAddress: sameAsInvoice
          ? { ...invoiceAddress, sameAsInvoice: true }
          : {
              street: existingPaymentAddress.street || "",
              city: existingPaymentAddress.city || "",
              state: existingPaymentAddress.state || "",
              zipCode: existingPaymentAddress.zipCode || "",
              country: existingPaymentAddress.country || invoiceAddress.country,
              sameAsInvoice: false,
            },
      })

      setUserInfo((prev: any) => ({
        ...(prev || {}),
        billingAddress: invoiceAddress,
      }))

      setBillingAddressNeedsAttention(false)
      setBillingAddressEditorOpen(false)
      toast({
        title: t("common.success"),
        description: "Ihre Angaben wurden gespeichert. Sie können jetzt bezahlen.",
      })
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error?.message || "Speichern der Angaben fehlgeschlagen.",
        variant: "destructive",
      })
    } finally {
      setSavingBillingAddress(false)
    }
  }

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16)
    const formatted = raw.match(/.{1,4}/g)?.join(" ") ?? raw
    setCardNumber(formatted)
  }

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4)
    const formatted = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw
    setCardExpiry(formatted)
  }

  const validatePaymentDetails = (): boolean => {
    if (paymentMethod === "card") {
      if (!cardholderName.trim()) {
        toast({ title: t("common.error"), description: t("checkout.cardholderNameRequired"), variant: "destructive" })
        return false
      }
      const rawCard = cardNumber.replace(/\s/g, "")
      if (!/^\d{16}$/.test(rawCard)) {
        toast({ title: t("common.error"), description: t("checkout.invalidCardNumber"), variant: "destructive" })
        return false
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
        toast({ title: t("common.error"), description: t("checkout.invalidCardExpiry"), variant: "destructive" })
        return false
      }
      if (!/^\d{3,4}$/.test(cardCvc.trim())) {
        toast({ title: t("common.error"), description: t("checkout.invalidCardCvc"), variant: "destructive" })
        return false
      }
    }
    return true
  }

  const renderPaymentDetails = () => {
    if (paymentMethod === "card") {
      return (
        <div className="mt-2 space-y-2 rounded-lg border border-[#c9d9f5] bg-[#f4f8ff] p-3">
          <p className="text-xs font-bold text-[#1a2a5e]">{t("checkout.cardDetails")}</p>
          <div className="space-y-1">
            <Label htmlFor="cardholderName" className="text-xs font-semibold">{t("checkout.cardholderName")}</Label>
            <Input
              id="cardholderName"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder={t("checkout.cardholderNamePlaceholder")}
              className="h-8 text-sm"
              autoComplete="cc-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cardNumber" className="text-xs font-semibold">{t("checkout.cardNumber")}</Label>
            <Input
              id="cardNumber"
              value={cardNumber}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              className="h-8 font-mono text-sm tracking-wider"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={19}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cardExpiry" className="text-xs font-semibold">{t("checkout.cardExpiry")}</Label>
              <Input
                id="cardExpiry"
                value={cardExpiry}
                onChange={handleCardExpiryChange}
                placeholder="MM/JJ"
                className="h-8 text-sm"
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={5}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cardCvc" className="text-xs font-semibold">{t("checkout.cardCvc")}</Label>
              <Input
                id="cardCvc"
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="CVC"
                className="h-8 text-sm"
                inputMode="numeric"
                autoComplete="cc-csc"
                maxLength={4}
              />
            </div>
          </div>
        </div>
      )
    }

    if (paymentMethod === "paypal") {
      return (
        <div className="mt-2 space-y-2 rounded-lg border border-[#c9d9f5] bg-[#f4f8ff] p-3">
          <p className="text-xs text-[#5f6d86]">{t("checkout.paypalRedirectNotice")}</p>
          <div className="space-y-1">
            <Label htmlFor="paypalEmail" className="text-xs font-semibold">{t("checkout.paypalEmail")}</Label>
            <Input
              id="paypalEmail"
              type="email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              placeholder="paypal@example.com"
              className="h-8 text-sm"
              autoComplete="email"
            />
            <p className="text-[10px] text-[#5f6d86]">{t("checkout.paypalEmailDesc")}</p>
          </div>

          {paypalLoading && (
            <p className="flex items-center gap-1.5 text-[11px] text-[#5f6d86]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> PayPal wird geladen...
            </p>
          )}

          {paypalError && (
            <p className="rounded-md border border-[#fecaca] bg-[#fff1f2] px-2.5 py-2 text-[11px] text-[#b91c1c]">
              {paypalError}
            </p>
          )}

          {!paypalError && <div ref={paypalButtonRef} className="min-h-10" />}
        </div>
      )
    }

    if (paymentMethod === "invoice") {
      return (
        <div className="mt-2 rounded-lg border border-[#c9d9f5] bg-[#f4f8ff] p-3">
          <p className="text-xs text-[#5f6d86]">{t("checkout.invoiceDesc")}</p>
        </div>
      )
    }

    return null
  }

  const prepareAuthenticatedReview = async () => {
    try {
      setInitializingCheckout(true)

      // Preserve guest cart items after verification by merging once authenticated.
      await mergeGuestCartIntoUserCart()

      const response = await initializeCheckout()
      const checkoutUserInfo = (response as any).userInfo || null
      const billingAddress = checkoutUserInfo?.billingAddress || {}
      const missingBillingAddress = hasMissingBillingAddress(billingAddress)

      setMode("authenticated")
      setUserInfo(checkoutUserInfo)
      setBillingAddressStreetDraft(billingAddress?.street || "")
      setBillingAddressCityDraft(billingAddress?.city || "")
      setBillingAddressZipDraft(billingAddress?.zipCode || "")
      setBillingAddressCountryDraft(billingAddress?.country || checkoutUserInfo?.country || "DE")
      setBillingAddressNeedsAttention(missingBillingAddress)
      setBillingAddressEditorOpen(missingBillingAddress)
      setReviewCart((response as any).cart || cart)
      setStep("review")
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("checkout.checkoutFailed"),
        variant: "destructive",
      })
      setStep("auth")
    } finally {
      setInitializingCheckout(false)
    }
  }

  const mergeGuestCartIntoUserCart = async () => {
    const localGuestCart = getGuestCart()
    if (localGuestCart.items.length === 0 && localGuestCart.repairOrders.length === 0) {
      return
    }

    for (const item of localGuestCart.items) {
      await addToCart({ productId: item.product._id, quantity: item.quantity, product: item.product as any })
    }

    for (const repairOrder of localGuestCart.repairOrders) {
      await addRepairOrderToCart(repairOrder as any)
    }

    clearGuestCart()
  }

  useEffect(() => {
    if (resendCountdown <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setResendCountdown((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [resendCountdown])

  useEffect(() => {
    if (!open) {
      resetReviewState()
      return
    }

    setCheckoutSuccessResult(null)
    setGuestCheckoutResult(null)

    if (isAuthenticated) {
      prepareAuthenticatedReview()
    } else {
      setStep("auth")
      setMode(null)
      setReviewCart(cart)
    }
  }, [open, isAuthenticated])

  useEffect(() => {
    if (!open || step !== "review" || paymentMethod !== "paypal" || (mode !== "authenticated" && mode !== "guest")) {
      return
    }

    let cancelled = false

    const loadConfigAndSdk = async () => {
      try {
        setPaypalLoading(true)
        setPaypalError("")

        const config = mode === "guest"
          ? await getGuestCheckoutPaypalConfig()
          : await getCheckoutPaypalConfig()
        if (cancelled) return

        setPaypalConfig(config)

        const scriptId = "paypal-js-sdk"
        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
        // PayPal SDK requires underscore locale format (e.g. de_DE), not hyphen (de-DE)
        const paypalLocale = (config.locale || 'de_DE').replace('-', '_')
        const sdkSrc = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=${encodeURIComponent(config.currency)}&intent=${encodeURIComponent(config.intent.toLowerCase())}&locale=${encodeURIComponent(paypalLocale)}&components=buttons`

        if (window.paypal?.Buttons) {
          setPaypalSdkReady(true)
          setPaypalLoading(false)
          return
        }

        if (existingScript) {
          // If the script loaded correctly, window.paypal would already be set above.
          // Getting here means the existing script failed or used a wrong client-id — remove it and reload.
          if (existingScript.src !== sdkSrc || !window.paypal?.Buttons) {
            existingScript.remove()
            // fall through to create a new script element
          } else {
            const onLoad = () => {
              if (cancelled) return
              setPaypalSdkReady(true)
              setPaypalLoading(false)
            }
            const onError = () => {
              if (cancelled) return
              setPaypalError("PayPal SDK konnte nicht geladen werden.")
              setPaypalLoading(false)
            }
            existingScript.addEventListener("load", onLoad)
            existingScript.addEventListener("error", onError)
            return
          }
        }

        const script = document.createElement("script")
        script.id = scriptId
        script.src = sdkSrc
        script.async = true
        script.onload = () => {
          if (cancelled) return
          setPaypalSdkReady(true)
          setPaypalLoading(false)
        }
        script.onerror = () => {
          if (cancelled) return
          setPaypalError("PayPal SDK konnte nicht geladen werden.")
          setPaypalLoading(false)
        }
        document.body.appendChild(script)
      } catch (error: any) {
        if (cancelled) return
        setPaypalError(error.message || "PayPal-Konfiguration konnte nicht geladen werden.")
        setPaypalLoading(false)
      }
    }

    loadConfigAndSdk()

    return () => {
      cancelled = true
    }
  }, [open, step, mode, paymentMethod])

  useEffect(() => {
    if (!open || step !== "review" || paymentMethod !== "paypal" || (mode !== "authenticated" && mode !== "guest")) {
      return
    }
    if (!paypalSdkReady || !paypalConfig || !paypalButtonRef.current || !window.paypal?.Buttons) {
      return
    }

    paypalButtonRef.current.innerHTML = ""

    const paypalButtons = window.paypal.Buttons({
      style: {
        layout: paypalConfig.button.layout || "vertical",
        color: paypalConfig.button.color || "gold",
        shape: paypalConfig.button.shape || "rect",
        label: paypalConfig.button.label || "paypal",
      },
      createOrder: async () => {
        if (!acceptTerms) {
          setHighlightTermsConsent(true)
          toast({
            title: t("common.error"),
            description: t("checkout.acceptTermsRequired"),
            variant: "destructive",
          })
          throw new Error("Terms not accepted")
        }

        if (mode === "guest") {
          if (!guestInfo) {
            throw new Error(t("checkout.guestCheckoutFailed"))
          }

          const localGuestCart = getGuestCart()
          const result = await createGuestCheckoutPaypalOrder({
            guestInfo,
            cartData: {
              items: localGuestCart.items,
              repairOrders: localGuestCart.repairOrders,
            },
            returnPath: window.location.pathname,
          })

          return result.orderId
        }

        const result = await createCheckoutPaypalOrder({
          returnPath: window.location.pathname,
        })

        return result.orderId
      },
      onApprove: async (data: { orderID: string }) => {
        try {
          setProcessingCheckout(true)

          if (mode === "guest") {
            if (!guestInfo) {
              throw new Error(t("checkout.guestCheckoutFailed"))
            }

            const localGuestCart = getGuestCart()
            const capture = await captureGuestCheckoutPaypalOrder({
              orderId: data.orderID,
              guestInfo,
            })

            const response = await completeGuestCheckout(
              guestInfo,
              { items: localGuestCart.items, repairOrders: localGuestCart.repairOrders },
              "paypal",
              {
                paypalOrderId: capture.orderId,
                paypalCaptureId: capture.captureId,
                paypalReceiptId: capture.receipt?.transactionId,
                paypalEmail,
              }
            )

            clearGuestCart()

            const guestOrderData = {
              success: true,
              bookingNumber: response.booking?.bookingNumber,
              orderNumbers: response.orders?.map((o: any) => o.orderNumber) || [],
              totalAmount: Number(response.orders?.reduce((sum: number, o: any) => sum + Number(o.totalCost || 0), 0) || 0),
              guestEmail: response.guestEmail,
              orderTrackingToken: response.trackingToken,
              bookingTrackingToken: response.bookingTrackingToken,
              orderCount: response.orderIds?.length || 0,
            }

            setGuestCheckoutResult(guestOrderData)

            toast({
              title: t("common.success"),
              description: t("checkout.guestCheckoutSuccessful"),
            })

            // Store order data and navigate to success page
            sessionStorage.setItem('lastOrderData', JSON.stringify(guestOrderData))
            onOpenChange(false)
            // Fire cleanup in background without blocking navigation
            onSuccess().catch((err) => console.error('Cleanup error:', err))
            navigate('/order-success')
            return
          }

          const capture = await captureCheckoutPaypalOrder(data.orderID)
          const checkoutResult = await completeCheckout("paypal", {
            paypalOrderId: capture.orderId,
            paypalCaptureId: capture.captureId,
            paypalReceiptId: capture.receipt?.paymentId,
            paypalEmail,
          })

          setCheckoutSuccessResult(checkoutResult)

          toast({
            title: t("common.success"),
            description: checkoutResult.message || t("checkout.checkoutDone"),
          })

          // Store order data and navigate to success page
          sessionStorage.setItem('lastOrderData', JSON.stringify(checkoutResult))
          onOpenChange(false)
          // Fire cleanup in background without blocking navigation
          onSuccess().catch((err) => console.error('Cleanup error:', err))
          navigate('/order-success')
        } catch (error: any) {
          toast({
            title: t("common.error"),
            description: error.message || "PayPal-Zahlung konnte nicht abgeschlossen werden.",
            variant: "destructive",
          })
        } finally {
          setProcessingCheckout(false)
        }
      },
      onCancel: () => {
        toast({
          title: t("common.error"),
          description: "PayPal-Zahlung wurde abgebrochen.",
          variant: "destructive",
        })
      },
      onError: () => {
        toast({
          title: t("common.error"),
          description: "PayPal-Dialog konnte nicht gestartet werden.",
          variant: "destructive",
        })
      },
    })

    if (!paypalButtons?.isEligible || !paypalButtons.isEligible()) {
      setPaypalError("PayPal ist in dieser Umgebung nicht verfügbar.")
      return
    }

    paypalButtons.render(paypalButtonRef.current)
  }, [
    open,
    step,
    mode,
    paymentMethod,
    paypalSdkReady,
    paypalConfig,
    acceptTerms,
    paypalEmail,
    guestInfo,
    onSuccess,
    t,
    toast,
  ])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!loginEmail || !loginPassword) {
      toast({
        title: t("common.error"),
        description: t("checkout.pleaseEnterEmailPassword"),
        variant: "destructive",
      })
      return
    }

    try {
      setLoginLoading(true)
      await login(loginEmail, loginPassword)

      toast({
        title: t("common.success"),
        description: t("checkout.loginSuccessful"),
      })

      await prepareAuthenticatedReview()
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("checkout.loginFailed"),
        variant: "destructive",
      })
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (registerLoading) {
      return
    }

    if (verificationEmailSent) {
      setVerificationEmailDialogOpen(true)
      return
    }

    if (!email || !password || !firstName || !lastName) {
      toast({
        title: t("common.error"),
        description: t("checkout.pleaseEnterRequiredFields"),
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: t("checkout.passwordsDoNotMatch"),
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: t("common.error"),
        description: t("checkout.passwordTooShort"),
        variant: "destructive",
      })
      return
    }

    try {
      setRegisterLoading(true)

      const finalShippingAddress = billingIsShipping
        ? {
            street: billingStreet,
            city: billingCity,
            state: billingState,
            zipCode: billingZipCode,
            country: billingCountry,
          }
        : {
            street: shippingStreet,
            city: shippingCity,
            state: shippingState,
            zipCode: shippingZipCode,
            country: shippingCountry,
          }

      const response = await registerDuringCheckout({
        email,
        password,
        firstName,
        lastName,
        phone,
        company: accountType === "business" ? company : "",
        country,
        vatId: accountType === "business" ? vatId : "",
        billingAddress: {
          street: billingStreet,
          city: billingCity,
          state: billingState,
          zipCode: billingZipCode,
          country: billingCountry,
        },
        shippingAddress: finalShippingAddress,
      })

      toast({
        title: t("common.success"),
        description: response?.message || "Bitte bestätigen Sie Ihre E-Mail-Adresse, um den Checkout fortzusetzen.",
      })

      setVerificationEmailAddress(email)
      setVerificationEmailSent(true)
      setResendCountdown(60)
      setVerificationEmailDialogOpen(true)
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("checkout.registrationFailed"),
        variant: "destructive",
      })
    } finally {
      setRegisterLoading(false)
    }
  }

  const handleResendVerificationEmail = async () => {
    if (!verificationEmailAddress || resendVerificationLoading || resendCountdown > 0) {
      return
    }

    try {
      setResendVerificationLoading(true)
      const response = await resendCheckoutVerificationEmail(verificationEmailAddress)

      toast({
        title: t("common.success"),
        description: response?.message || "Verifizierungs-E-Mail wurde erneut gesendet.",
      })

      setResendCountdown(60)
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "Verifizierungs-E-Mail konnte nicht erneut gesendet werden.",
        variant: "destructive",
      })
    } finally {
      setResendVerificationLoading(false)
    }
  }

  const handlePrepareGuestReview = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!guestEmail || !guestFirstName || !guestLastName) {
      toast({
        title: t("common.error"),
        description: t("checkout.pleaseEnterGuestRequiredFields"),
        variant: "destructive",
      })
      return
    }

    if (!guestBillingStreet || !guestBillingCity || !guestBillingZipCode) {
      toast({
        title: t("common.error"),
        description: t("checkout.pleaseEnterGuestRequiredFields"),
        variant: "destructive",
      })
      return
    }

    const localGuestCart = getGuestCart()
    if (localGuestCart.items.length === 0 && localGuestCart.repairOrders.length === 0) {
      toast({
        title: t("common.error"),
        description: t("cart.failedToLoad"),
        variant: "destructive",
      })
      return
    }

    const finalShippingAddress = guestBillingIsShipping
      ? {
          street: guestBillingStreet,
          city: guestBillingCity,
          state: guestBillingState,
          zipCode: guestBillingZipCode,
          country: guestBillingCountry,
        }
      : {
          street: guestShippingStreet,
          city: guestShippingCity,
          state: guestShippingState,
          zipCode: guestShippingZipCode,
          country: guestShippingCountry,
        }

    setGuestInfo({
      email: guestEmail,
      firstName: guestFirstName,
      lastName: guestLastName,
      phone: guestPhone,
      billingAddress: {
        street: guestBillingStreet,
        city: guestBillingCity,
        state: guestBillingState,
        zipCode: guestBillingZipCode,
        country: guestBillingCountry,
      },
      shippingAddress: finalShippingAddress,
    })

    setReviewCart({
      _id: "guest-cart",
      user: "guest",
      items: localGuestCart.items.map((item) => ({
        _id: item._id,
        productId: item.product as any,
        quantity: item.quantity,
        price: item.product.price,
      })),
      repairOrders: localGuestCart.repairOrders as any,
      subtotal: localGuestCart.totalCost,
      tax: 0,
      total: localGuestCart.totalCost,
      totalItems: localGuestCart.itemCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    setMode("guest")
    setStep("review")
  }

  const handlePayNow = async () => {
    if (!acceptTerms) {
      setHighlightTermsConsent(true)
      toast({
        title: t("common.error"),
        description: t("checkout.acceptTermsRequired"),
        variant: "destructive",
      })
      return
    }

    if (!validatePaymentDetails()) return

    // Build non-sensitive payment metadata to pass to the gateway/backend.
    // NOTE: In production replace card fields with Stripe Elements tokenization —
    // the raw card number and CVC must never reach your own server (PCI DSS).
    const rawCard = cardNumber.replace(/\s/g, "")
    const expiryParts = cardExpiry.split("/")
    const paymentData: Record<string, string> =
      paymentMethod === "card"
        ? {
            cardholderName,
            lastFour: rawCard.slice(-4),
            expiryMonth: expiryParts[0] ?? "",
            expiryYear: expiryParts[1] ?? "",
          }
        : paymentMethod === "paypal"
        ? { paypalEmail }
        : {}

    try {
      setProcessingCheckout(true)

      if (mode === "guest") {
        const localGuestCart = getGuestCart()
        if (!guestInfo) {
          throw new Error(t("checkout.guestCheckoutFailed"))
        }

        const response = await completeGuestCheckout(
          guestInfo as any,
          { items: localGuestCart.items, repairOrders: localGuestCart.repairOrders },
          paymentMethod,
          paymentData
        )

        clearGuestCart()

        const guestOrderData = {
          success: true,
          bookingNumber: response.booking?.bookingNumber,
          orderNumbers: response.orders?.map((o: any) => o.orderNumber) || [],
          totalAmount: Number(response.orders?.reduce((sum: number, o: any) => sum + Number(o.totalCost || 0), 0) || 0),
          guestEmail: response.guestEmail,
          orderTrackingToken: response.trackingToken,
          bookingTrackingToken: response.bookingTrackingToken,
          orderCount: response.orderIds?.length || 0,
        }

        setGuestCheckoutResult(guestOrderData)

        toast({
          title: t("common.success"),
          description: t("checkout.guestCheckoutSuccessful"),
        })

        // Store order data and navigate to success page
        sessionStorage.setItem('lastOrderData', JSON.stringify(guestOrderData))
        onOpenChange(false)
        // Fire cleanup in background without blocking navigation
        onSuccess().catch((err) => console.error('Cleanup error:', err))
        navigate('/order-success')
        return
      }

      const checkoutResult = await completeCheckout(paymentMethod, paymentData)
      setCheckoutSuccessResult(checkoutResult)

      toast({
        title: t("common.success"),
        description: checkoutResult.message || t("checkout.checkoutDone"),
      })

      // Store order data and navigate to success page
      sessionStorage.setItem('lastOrderData', JSON.stringify(checkoutResult))
      onOpenChange(false)
      // Fire cleanup in background without blocking navigation
      onSuccess().catch((err) => console.error('Cleanup error:', err))
      navigate('/order-success')
    } catch (error: any) {
      const checkoutError = error as CheckoutApiError
      if (
        mode === "authenticated" &&
        checkoutError?.status === 400 &&
        checkoutError?.missingFields &&
        (checkoutError.missingFields.street || checkoutError.missingFields.city || checkoutError.missingFields.zipCode)
      ) {
        setBillingAddressNeedsAttention(true)
        setBillingAddressEditorOpen(true)
        toast({
          title: "Fehlende Rechnungsadresse",
          description: "Bitte ergänzen Sie Ihre Rechnungsadresse im Bereich Kontakt & Rechnungsadresse.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: t("common.error"),
        description: error.message || t("checkout.checkoutFailed"),
        variant: "destructive",
      })
    } finally {
      setProcessingCheckout(false)
    }
  }

  const closeAndNavigateBookings = () => {
    onOpenChange(false)
    navigate("/bookings")
  }

  const renderOrderRows = () => {
    if (!reviewCart) return null

    return (
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {reviewCart.items.map((item) => {
          const product = item.productId as any
          const lineTotal = (Number(product?.price || item.price || 0) * Number(item.quantity || 1)).toFixed(2)
          const productImage = getProductImage(product)
          return (
            <div key={`product-${item._id}`} className="flex items-start gap-2.5 rounded-lg border border-[#e5eaf4] bg-white p-2.5">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[#eef3ff]">
                {productImage ? (
                  <img
                    src={productImage}
                    alt={product?.name || t("checkout.article")}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                      const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                      fallback?.classList.remove("hidden")
                    }}
                  />
                ) : null}
                <div className={`${productImage ? "hidden" : "flex"} h-full w-full items-center justify-center`}>
                  <Package className="h-4 w-4 text-[#1a2a5e]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold leading-tight text-[#1a2a5e]">{product?.name || t("checkout.article")}</p>
                  <p className="shrink-0 text-[13px] font-bold text-[#1a2a5e]">{lineTotal} €</p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {product?.category && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-[#f0f4ff] px-1.5 py-0.5 text-[10px] font-medium text-[#1a2a5e]">
                      <Tag className="h-2.5 w-2.5" />{product.category}
                    </span>
                  )}
                  <span className="text-xs text-[#5f6d86]">
                    {item.quantity} × {Number(product?.price || item.price || 0).toFixed(2)} €
                  </span>
                </div>
                {product?.variant && (
                  <p className="mt-0.5 text-[10px] text-[#8b9dbf]">{product.variant}</p>
                )}
              </div>
            </div>
          )
        })}

        {(reviewCart.repairOrders || []).map((order: any) => {
          const services: string[] = order.serviceNames || []
          const addOns: Array<{ name: string; price: number }> = order.addOns || []
          const deviceImage = getRepairOrderImage(order)
          return (
            <div key={`repair-${order._id}`} className="flex items-start gap-2.5 rounded-lg border border-[#dbe8ff] bg-[#f5f9ff] p-2.5">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[#dbe8ff]">
                {deviceImage ? (
                  <img
                    src={deviceImage}
                    alt={[order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") || t("checkout.repairOrder")}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                      const fallback = event.currentTarget.nextElementSibling as HTMLElement | null
                      fallback?.classList.remove("hidden")
                    }}
                  />
                ) : null}
                <div className={`${deviceImage ? "hidden" : "flex"} h-full w-full items-center justify-center`}>
                  <Wrench className="h-4 w-4 text-[#1a2a5e]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-tight text-[#1a2a5e]">
                    {order.deviceBrand || ""} {order.deviceModel || ""}
                  </p>
                  <p className="shrink-0 text-[13px] font-bold text-[#1a2a5e]">{Number(order.totalCost || 0).toFixed(2)} €</p>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded bg-[#dbe8ff] px-1.5 py-0.5 text-[10px] font-medium text-[#1a2a5e]">{order.deviceType || t("checkout.repairOrder")}</span>
                </div>
                {services.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {services.map((s: string) => (
                      <span key={s} className="rounded border border-[#c9d9f5] bg-white px-1.5 py-0.5 text-[10px] text-[#3b5298]">{s}</span>
                    ))}
                  </div>
                )}
                {addOns.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {addOns.map((a) => (
                      <p key={a.name} className="text-[10px] text-[#5f6d86]">+ {a.name} ({Number(a.price || 0).toFixed(2)} €)</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderContactSummary = () => {
    const info = mode === "guest" ? guestInfo : userInfo
    if (!info) return null

    const addr = info.billingAddress
    const authenticatedCheckout = mode === "authenticated"
    const missingBillingAddress = authenticatedCheckout && hasMissingBillingAddress(addr)
    const hasAddress = addr?.street || addr?.city

    return (
      <Card className="border-[#d8dce6]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-1.5 text-sm font-bold text-[#1a2a5e]">
            <User className="h-3.5 w-3.5" />
            {t("checkout.contactDetails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-1 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0 text-[#5f6d86]" />
            <span className="font-medium text-[#1a2a5e]">{info.firstName} {info.lastName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-[#5f6d86]" />
            <span className="text-[#5f6d86]">{info.email}</span>
          </div>
          {info.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[#5f6d86]" />
              <span className="text-[#5f6d86]">{info.phone}</span>
            </div>
          )}
          {authenticatedCheckout && (missingBillingAddress || billingAddressNeedsAttention) && (
            <div className="rounded-lg border border-[#f5b800] bg-[#fff8db] p-2 text-xs text-[#7a5a00]">
              <p className="font-semibold">Rechnungsadresse unvollständig</p>
              <p className="mt-0.5">Bitte füllen Sie die markierten Felder aus und speichern Sie, bevor Sie bezahlen.</p>
            </div>
          )}

          {authenticatedCheckout && (billingAddressEditorOpen || missingBillingAddress || billingAddressNeedsAttention) && (
            <div className="space-y-2 rounded-lg border-2 border-[#f5b800] bg-[#fffdf3] p-2.5">
              <p className="text-xs font-semibold text-[#1a2a5e]">Rechnungsadresse nachtragen</p>
              <div className="space-y-1">
                <Label htmlFor="checkout-billing-street" className="text-xs font-semibold">Straße und Hausnummer *</Label>
                <Input
                  id="checkout-billing-street"
                  value={billingAddressStreetDraft}
                  onChange={(e) => setBillingAddressStreetDraft(e.target.value)}
                  className={`h-8 text-sm ${billingAddressNeedsAttention && !billingAddressStreetDraft.trim() ? "border-red-400 ring-1 ring-red-200" : ""}`}
                  placeholder="Musterstraße 12"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="checkout-billing-zip" className="text-xs font-semibold">PLZ *</Label>
                  <Input
                    id="checkout-billing-zip"
                    value={billingAddressZipDraft}
                    onChange={(e) => setBillingAddressZipDraft(e.target.value)}
                    className={`h-8 text-sm ${billingAddressNeedsAttention && !billingAddressZipDraft.trim() ? "border-red-400 ring-1 ring-red-200" : ""}`}
                    placeholder="12345"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="checkout-billing-city" className="text-xs font-semibold">Stadt *</Label>
                  <Input
                    id="checkout-billing-city"
                    value={billingAddressCityDraft}
                    onChange={(e) => setBillingAddressCityDraft(e.target.value)}
                    className={`h-8 text-sm ${billingAddressNeedsAttention && !billingAddressCityDraft.trim() ? "border-red-400 ring-1 ring-red-200" : ""}`}
                    placeholder="Berlin"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="checkout-billing-country" className="text-xs font-semibold">Land</Label>
                <Input
                  id="checkout-billing-country"
                  value={billingAddressCountryDraft}
                  onChange={(e) => setBillingAddressCountryDraft(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Deutschland"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setBillingAddressEditorOpen(false)} disabled={savingBillingAddress || missingBillingAddress}>
                  Schließen
                </Button>
                <Button type="button" className="h-8 bg-[#f5b800] px-2.5 text-xs font-bold text-[#1a2a5e] hover:bg-[#e5ab00]" onClick={handleSaveBillingAddress} disabled={savingBillingAddress}>
                  {savingBillingAddress ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Speichert...</> : "Adresse speichern"}
                </Button>
              </div>
            </div>
          )}

          {hasAddress && !billingAddressEditorOpen && (
            <div className="flex items-start gap-2 border-t border-[#e7eaf1] pt-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5f6d86]" />
              <div className="text-[#5f6d86]">
                <p>{addr.street}</p>
                <p>{[addr.zipCode, addr.city].filter(Boolean).join(" ")}{addr.state ? `, ${addr.state}` : ""}</p>
                {addr.country && <p>{addr.country}</p>}
              </div>
            </div>
          )}

          {authenticatedCheckout && !billingAddressEditorOpen && (
            <div className="pt-1.5">
              <Button type="button" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => setBillingAddressEditorOpen(true)}>
                Rechnungsadresse bearbeiten
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-[95vw] overflow-y-auto rounded-xl border border-[#d8dce6] p-0 sm:max-w-4xl [&>button]:text-[#f5b800] [&>button]:opacity-100 [&>button:hover]:text-[#f5b800]">
        {guestCheckoutResult ? (
          <div className="p-4 sm:p-5">
            <DialogHeader className="space-y-2 border-b border-[#e7eaf1] pb-3 text-left">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#166534]">
                <CheckCircle2 className="h-5 w-5" />
                {t("checkout.orderPlacedSuccessfully")}
              </DialogTitle>
              <DialogDescription className="text-sm text-[#5f6d86]">{t("checkout.trackingLinksDescription")}</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <Card className="border-[#d1fae5] bg-[#f0fdf4]">
                <CardContent className="space-y-2.5 p-3.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#5f6d86]">{t("checkout.bookingNumber")}</span>
                    <span className="font-bold text-[#1a2a5e]">{guestCheckoutResult.bookingNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5f6d86]">{t("checkout.totalOrders")}</span>
                    <span className="font-semibold text-[#1a2a5e]">{guestCheckoutResult.orderCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5f6d86]">{t("checkout.totalAmount")}</span>
                    <span className="font-bold text-[#1a2a5e]">{Number(guestCheckoutResult.totalAmount || 0).toFixed(2)} €</span>
                  </div>
                  {guestCheckoutResult.paymentMethod && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#5f6d86]">{t("checkout.paymentMethod")}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{guestCheckoutResult.paymentMethod}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-sm text-[#1e40af]">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t("checkout.confirmationEmailSent")} <span className="font-semibold">{guestCheckoutResult.guestEmail}</span></p>
              </div>

              <Button className="h-10 w-full bg-[#1a2a5e] text-sm font-semibold text-white" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        ) : checkoutSuccessResult ? (
          <div className="p-4 sm:p-5">
            <DialogHeader className="space-y-2 border-b border-[#e7eaf1] pb-3 text-left">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#166534]">
                <CheckCircle2 className="h-5 w-5" />
                {t("checkout.orderPlacedSuccessfully")}
              </DialogTitle>
              <DialogDescription className="text-sm text-[#5f6d86]">{checkoutSuccessResult.message || t("checkout.checkoutDone")}</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <Card className="border-[#d1fae5] bg-[#f0fdf4]">
                <CardContent className="space-y-2.5 p-3.5 text-sm">
                  {checkoutSuccessResult.bookingNumber && (
                    <div className="flex justify-between">
                      <span className="text-[#5f6d86]">{t("checkout.bookingNumber")}</span>
                      <span className="font-bold text-[#1a2a5e]">{checkoutSuccessResult.bookingNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#5f6d86]">{t("checkout.totalOrders")}</span>
                    <span className="font-semibold text-[#1a2a5e]">{checkoutSuccessResult.orderIds?.length || 0}</span>
                  </div>
                  {checkoutSuccessResult.totalAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#5f6d86]">{t("checkout.totalAmount")}</span>
                      <span className="font-bold text-[#1a2a5e]">{Number(checkoutSuccessResult.totalAmount || 0).toFixed(2)} €</span>
                    </div>
                  )}
                  {(checkoutSuccessResult.paymentMethod || paymentMethod) && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#5f6d86]">{t("checkout.paymentMethod")}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{checkoutSuccessResult.paymentMethod || paymentMethod}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {userInfo?.email && (
                <div className="flex items-start gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-sm text-[#1e40af]">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{t("checkout.confirmationEmailSent")} <span className="font-semibold">{userInfo.email}</span></p>
                </div>
              )}

              <Button className="h-10 w-full bg-[#1a2a5e] text-sm font-semibold text-white" onClick={closeAndNavigateBookings}>
                {t("checkout.goToBookings")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 bg-[#1a2a5e] px-4 py-3 sm:px-5 sm:py-3.5">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-base font-bold tracking-tight !text-[#f5b800] sm:text-lg">
                  {step === "review" ? t("checkout.proceedToCheckoutDialogTitle") : t("checkout.authenticationRequired")}
                </DialogTitle>
                <DialogDescription className="text-xs text-blue-100 sm:text-sm">
                  {step === "review" ? t("checkout.reviewAndPayDesc") : t("checkout.authenticationRequiredDesc")}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-4 sm:p-5">
              {initializingCheckout ? (
                <div className="flex min-h-[220px] items-center justify-center">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#1a2a5e]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("common.loading")}
                  </div>
                </div>
              ) : step === "review" ? (
                <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr]">
                  {/* ── Left column ── */}
                  <div className="space-y-3">
                    <Card className="border-[#d8dce6]">
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-1.5 text-sm font-bold text-[#1a2a5e]">
                            <Package className="h-3.5 w-3.5" />
                            {t("checkout.bookingSummary")}
                          </CardTitle>
                          <Badge variant="secondary" className="text-[11px]">
                            {reviewCart?.totalItems || 0} {t("checkout.positions")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-1">
                        {renderOrderRows()}
                        {/* Shipping hint */}
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#f0fdf4] px-2.5 py-1.5">
                          <Truck className="h-3.5 w-3.5 text-[#15803d]" />
                          <span className="text-xs font-medium text-[#15803d]">{t("checkout.shippingFree")}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {renderContactSummary()}
                  </div>

                  {/* ── Right column ── */}
                  <div className="space-y-3">
                    {/* Order totals + CTA */}
                    <Card className="border-[#d8dce6]">
                      <CardContent className="space-y-2 p-3.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#5f6d86]">{t("cart.subtotal")}</span>
                          <span className="font-semibold text-[#1a2a5e]">{totals.subtotal.toFixed(2)} €</span>
                        </div>

                        {totals.discount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#5f6d86]">{t("cart.discount")}</span>
                            <span className="font-semibold text-[#15803d]">- {totals.discount.toFixed(2)} €</span>
                          </div>
                        )}

                        <div className="flex justify-between">
                          <span className="text-[#5f6d86]">{t("checkout.shippingCost")}</span>
                          <span className="font-semibold text-[#15803d]">{t("checkout.shippingFreeShort")}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-[#5f6d86]">{t("cart.tax")}</span>
                          <span className="font-semibold text-[#1a2a5e]">{totals.tax.toFixed(2)} €</span>
                        </div>

                        <div className="mt-1 flex items-center justify-between rounded-lg bg-[#f0f4ff] px-2.5 py-2 text-base border-t border-[#d8e3ff]">
                          <span className="font-bold text-[#1a2a5e]">{t("cart.grandTotal")}</span>
                          <div className="text-right">
                            <span className="text-lg font-extrabold text-[#1a2a5e]">{totals.total.toFixed(2)} €</span>
                            {totals.tax > 0 && (
                              <p className="text-[10px] font-normal text-[#5f6d86]">{t("checkout.inclTax")}</p>
                            )}
                          </div>
                        </div>

                        {/* Accept terms */}
                        <div className={`flex items-start gap-2 rounded-lg px-2.5 py-2 transition-all ${highlightTermsConsent && !acceptTerms ? "border-2 border-[#f5b800] bg-[#fff8db] shadow-[0_0_0_2px_rgba(245,184,0,0.25)]" : "bg-[#f7f9fd]"}`}>
                          <Checkbox
                            id="accept-terms"
                            checked={acceptTerms}
                            onCheckedChange={(checked) => {
                              const isAccepted = checked === true
                              setAcceptTerms(isAccepted)
                              if (isAccepted) {
                                setHighlightTermsConsent(false)
                              }
                            }}
                            className="mt-0.5 h-5 w-5 border-2 border-[#1a2a5e] bg-white ring-2 ring-[#2a3f7e] ring-offset-1 ring-offset-white shadow-sm data-[state=checked]:border-[#0f1d45] data-[state=checked]:bg-[#1a2a5e] data-[state=checked]:text-white focus-visible:ring-[#1a2a5e]"
                          />
                          <Label htmlFor="accept-terms" className="cursor-pointer text-xs leading-snug text-[#4b5b79]">
                            {t("checkout.acceptTermsPrefix")}{" "}
                            <a href="/agb" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold underline decoration-dotted hover:decoration-solid">
                              {t("checkout.termsLink")}
                            </a>
                            {" "}{t("checkout.acceptTermsAnd")}{" "}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold underline decoration-dotted hover:decoration-solid">
                              {t("checkout.privacyLink")}
                            </a>
                            {" "}{t("checkout.acceptTermsSuffix")}
                          </Label>
                        </div>

                        {/* Pay button */}
                        <Button
                          type="button"
                          className="h-11 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
                          onClick={handlePayNow}
                          disabled={processingCheckout || paymentMethod === "paypal"}
                        >
                          {processingCheckout
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("common.loading")}</>
                            : paymentMethod === "paypal"
                              ? <><Wallet className="mr-2 h-4 w-4" />Bitte den PayPal-Button oben verwenden</>
                              : <><CreditCard className="mr-2 h-4 w-4" />{t("checkout.payNow")} — {totals.total.toFixed(2)} €</>
                          }
                        </Button>

                        {/* Trust bar */}
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-[#e7eaf1] bg-[#f9fafb] px-3 py-2">
                          <Lock className="h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                          <span className="text-[11px] font-semibold text-[#15803d]">SSL</span>
                          <span className="text-[#d8dce6]">|</span>
                          <Shield className="h-3.5 w-3.5 shrink-0 text-[#5f6d86]" />
                          <span className="text-[11px] text-[#5f6d86]">{t("checkout.securePaymentNotice")}</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment method selection */}
                    <Card className="border-[#d8dce6]">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-bold text-[#1a2a5e]">{t("checkout.paymentMethod")}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-1">
                        {paymentOptions.map((option) => {
                          const Icon = option.icon
                          const active = paymentMethod === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (!acceptTerms) {
                                  setHighlightTermsConsent(true)
                                }
                                setPaymentMethod(option.value)
                              }}
                              className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${active ? "border-[#1a2a5e] bg-[#eef3ff] ring-1 ring-[#1a2a5e]" : "border-[#e3e7ef] bg-white hover:border-[#c9d3e7]"}`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? "border-[#1a2a5e] bg-[#1a2a5e]" : "border-[#c9d3e7]"}`}>
                                  {active && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <Icon className="h-4 w-4 text-[#1a2a5e]" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-[#1a2a5e]">{option.label}</p>
                                  <p className="text-xs text-[#5f6d86]">{option.hint}</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}

                        {/* Accepted card/payment logos */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {(paymentMethod === "card" || paymentMethod !== "invoice") && (
                            <>
                              <span className="rounded border border-[#d8dce6] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-[#1a334f]">VISA</span>
                              <span className="rounded border border-[#d8dce6] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-[#eb001b]">MC</span>
                              <span className="rounded border border-[#003087] px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-[#003087]">PayPal</span>
                              <span className="rounded border border-[#d8dce6] px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-[#5f6d86]">SEPA</span>
                              <span className="rounded border border-[#d8dce6] px-1.5 py-0.5 text-[9px] font-semibold text-[#5f6d86]">Amex</span>
                            </>
                          )}
                        </div>

                        {renderPaymentDetails()}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 rounded-lg border border-[#d8dce6] bg-[#f6f8fc] p-1">
                    <TabsTrigger value="login" className="h-8 text-[11px] font-semibold sm:text-xs">
                      <LogIn className="mr-1 h-3.5 w-3.5" /> {t("checkout.login")}
                    </TabsTrigger>
                    <TabsTrigger value="register" className="h-8 text-[11px] font-semibold sm:text-xs">
                      <UserPlus className="mr-1 h-3.5 w-3.5" /> {t("checkout.createAccount")}
                    </TabsTrigger>
                    <TabsTrigger value="guest" className="h-8 text-[11px] font-semibold sm:text-xs">
                      <UserCheck className="mr-1 h-3.5 w-3.5" /> {t("checkout.guestCheckout")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-0">
                    <Card className="border-[#d8dce6]">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-bold text-[#1a2a5e]">{t("checkout.loginToYourAccount")}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-1">
                        <form onSubmit={handleLogin} className="space-y-2.5">
                          <div className="space-y-1">
                            <Label htmlFor="login-email" className="text-xs font-semibold">{t("checkout.email")}</Label>
                            <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="h-8 text-sm" required />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="login-password" className="text-xs font-semibold">{t("checkout.password")}</Label>
                            <div className="relative">
                              <Input id="login-password" type={showLoginPassword ? "text" : "password"} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="h-8 pr-9 text-sm" required />
                              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                          <Button type="submit" className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]" disabled={loginLoading}>
                            {loginLoading ? t("common.loading") : t("checkout.login")}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="register" className="mt-0">
                    <Card className="border-[#d8dce6]">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-bold text-[#1a2a5e]">{t("checkout.createNewAccount")}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-1">
                        <form onSubmit={handleRegister} className="space-y-3">
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="firstName" className="text-xs font-semibold">{t("checkout.firstName")} <span className="text-red-500">*</span></Label>
                              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-sm" required />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="lastName" className="text-xs font-semibold">{t("checkout.lastName")} <span className="text-red-500">*</span></Label>
                              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-sm" required />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="email" className="text-xs font-semibold">{t("checkout.email")} <span className="text-red-500">*</span></Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" required />
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="phone" className="text-xs font-semibold">{t("checkout.phone")}</Label>
                            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-sm" />
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="password" className="text-xs font-semibold">{t("checkout.password")} <span className="text-red-500">*</span></Label>
                              <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 pr-9 text-sm" required />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8" onClick={() => setShowPassword(!showPassword)}>
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="confirmPassword" className="text-xs font-semibold">{t("checkout.confirmPassword")} <span className="text-red-500">*</span></Label>
                              <div className="relative">
                                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-8 pr-9 text-sm" required />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
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
                                <RadioGroupItem id="accountType-private" value="private" />
                                <Label htmlFor="accountType-private" className="cursor-pointer text-xs">{t("checkout.privateCustomer")}</Label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <RadioGroupItem id="accountType-business" value="business" />
                                <Label htmlFor="accountType-business" className="cursor-pointer text-xs">{t("checkout.businessCustomer")}</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {accountType === "business" && (
                              <div className="space-y-1">
                                <Label htmlFor="company" className="text-xs font-semibold">{t("checkout.company")} <span className="text-red-500">*</span></Label>
                                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="h-8 text-sm" required={accountType === "business"} />
                              </div>
                            )}
                            <div className="space-y-1">
                              <Label htmlFor="country" className="text-xs font-semibold">{t("checkout.country")}</Label>
                              <CountrySelect id="country" value={country} onChange={setCountry} className="h-8 text-sm" />
                            </div>
                          </div>

                          {accountType === "business" && (
                            <div className="space-y-1">
                              <Label htmlFor="vatId" className="text-xs font-semibold">{t("checkout.vatId")}</Label>
                              <Input id="vatId" value={vatId} onChange={(e) => setVatId(e.target.value)} className="h-8 text-sm" />
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="billingStreet" className="text-xs font-semibold">{t("checkout.street")}</Label>
                              <Input id="billingStreet" value={billingStreet} onChange={(e) => setBillingStreet(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="billingCity" className="text-xs font-semibold">{t("checkout.city")}</Label>
                              <Input id="billingCity" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} className="h-8 text-sm" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label htmlFor="billingState" className="text-xs font-semibold">{t("checkout.state")}</Label>
                              <Input id="billingState" value={billingState} onChange={(e) => setBillingState(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="billingZipCode" className="text-xs font-semibold">{t("checkout.zipCode")}</Label>
                              <Input id="billingZipCode" value={billingZipCode} onChange={(e) => setBillingZipCode(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="billingCountry" className="text-xs font-semibold">{t("checkout.country")}</Label>
                              <CountrySelect id="billingCountry" value={billingCountry} onChange={setBillingCountry} className="h-8 text-sm" />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 rounded-lg bg-[#f6f8fc] px-2.5 py-2">
                            <Checkbox id="billingIsShipping" checked={billingIsShipping} onCheckedChange={(checked) => setBillingIsShipping(checked === true)} />
                            <Label htmlFor="billingIsShipping" className="cursor-pointer text-xs">{t("checkout.billingIsShippingAddress")}</Label>
                          </div>

                          {!billingIsShipping && (
                            <div className="space-y-2.5 rounded-lg border border-[#e3e8f2] p-2.5">
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label htmlFor="shippingStreet" className="text-xs font-semibold">{t("checkout.street")}</Label>
                                  <Input id="shippingStreet" value={shippingStreet} onChange={(e) => setShippingStreet(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="shippingCity" className="text-xs font-semibold">{t("checkout.city")}</Label>
                                  <Input id="shippingCity" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} className="h-8 text-sm" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                <div className="space-y-1">
                                  <Label htmlFor="shippingState" className="text-xs font-semibold">{t("checkout.state")}</Label>
                                  <Input id="shippingState" value={shippingState} onChange={(e) => setShippingState(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="shippingZipCode" className="text-xs font-semibold">{t("checkout.zipCode")}</Label>
                                  <Input id="shippingZipCode" value={shippingZipCode} onChange={(e) => setShippingZipCode(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="shippingCountry" className="text-xs font-semibold">{t("checkout.country")}</Label>
                                  <CountrySelect id="shippingCountry" value={shippingCountry} onChange={setShippingCountry} className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>
                          )}

                          <Button type="submit" className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]" disabled={registerLoading || verificationEmailSent}>
                            {registerLoading ? t("common.loading") : verificationEmailSent ? "Verifizierungs-E-Mail bereits gesendet" : t("checkout.createAccount")}
                          </Button>
                          {verificationEmailSent && (
                            <div className="space-y-2 rounded-md border border-[#c7e9cf] bg-[#effaf2] px-2.5 py-2 text-[11px] text-[#166534]">
                              <p>
                                Die Verifizierungs-E-Mail wurde gesendet. Bitte bestätigen Sie Ihre Adresse und kehren Sie dann zum Checkout zurück.
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 w-full border-[#8bbf9b] text-[11px] font-semibold text-[#14532d] hover:bg-[#dff3e5]"
                                onClick={handleResendVerificationEmail}
                                disabled={resendVerificationLoading || resendCountdown > 0}
                              >
                                {resendVerificationLoading
                                  ? "Wird gesendet..."
                                  : resendCountdown > 0
                                    ? `Erneut senden in ${resendCountdown}s`
                                    : "Verifizierungs-E-Mail erneut senden"}
                              </Button>
                            </div>
                          )}
                          <p className="text-[10px] text-[#8b9dbf]"><span className="text-red-500">*</span> {t("checkout.requiredFieldsNote")}</p>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="guest" className="mt-0">
                    <Card className="border-[#d8dce6]">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-bold text-[#1a2a5e]">{t("checkout.continueAsGuest")}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-1">
                        <form onSubmit={handlePrepareGuestReview} className="space-y-3">
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="guest-firstName" className="text-xs font-semibold">{t("checkout.firstName")} <span className="text-red-500">*</span></Label>
                              <Input id="guest-firstName" value={guestFirstName} onChange={(e) => setGuestFirstName(e.target.value)} className="h-8 text-sm" required />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="guest-lastName" className="text-xs font-semibold">{t("checkout.lastName")} <span className="text-red-500">*</span></Label>
                              <Input id="guest-lastName" value={guestLastName} onChange={(e) => setGuestLastName(e.target.value)} className="h-8 text-sm" required />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="guest-email" className="text-xs font-semibold">{t("checkout.email")} <span className="text-red-500">*</span></Label>
                            <Input id="guest-email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="h-8 text-sm" required />
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="guest-phone" className="text-xs font-semibold">{t("checkout.phone")}</Label>
                            <Input id="guest-phone" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="h-8 text-sm" />
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor="guest-billingStreet" className="text-xs font-semibold">{t("checkout.street")} <span className="text-red-500">*</span></Label>
                              <Input id="guest-billingStreet" value={guestBillingStreet} onChange={(e) => setGuestBillingStreet(e.target.value)} className="h-8 text-sm" required />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="guest-billingCity" className="text-xs font-semibold">{t("checkout.city")} <span className="text-red-500">*</span></Label>
                              <Input id="guest-billingCity" value={guestBillingCity} onChange={(e) => setGuestBillingCity(e.target.value)} className="h-8 text-sm" required />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label htmlFor="guest-billingState" className="text-xs font-semibold">{t("checkout.state")}</Label>
                              <Input id="guest-billingState" value={guestBillingState} onChange={(e) => setGuestBillingState(e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="guest-billingZipCode" className="text-xs font-semibold">{t("checkout.zipCode")} <span className="text-red-500">*</span></Label>
                              <Input id="guest-billingZipCode" value={guestBillingZipCode} onChange={(e) => setGuestBillingZipCode(e.target.value)} className="h-8 text-sm" required />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="guest-billingCountry" className="text-xs font-semibold">{t("checkout.country")}</Label>
                              <Input id="guest-billingCountry" value={guestBillingCountry} onChange={(e) => setGuestBillingCountry(e.target.value)} className="h-8 text-sm" />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 rounded-lg bg-[#f6f8fc] px-2.5 py-2">
                            <Checkbox id="guest-billingIsShipping" checked={guestBillingIsShipping} onCheckedChange={(checked) => setGuestBillingIsShipping(checked === true)} />
                            <Label htmlFor="guest-billingIsShipping" className="cursor-pointer text-xs">{t("checkout.billingIsShippingAddress")}</Label>
                          </div>

                          {!guestBillingIsShipping && (
                            <div className="space-y-2.5 rounded-lg border border-[#e3e8f2] p-2.5">
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label htmlFor="guest-shippingStreet" className="text-xs font-semibold">{t("checkout.street")}</Label>
                                  <Input id="guest-shippingStreet" value={guestShippingStreet} onChange={(e) => setGuestShippingStreet(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="guest-shippingCity" className="text-xs font-semibold">{t("checkout.city")}</Label>
                                  <Input id="guest-shippingCity" value={guestShippingCity} onChange={(e) => setGuestShippingCity(e.target.value)} className="h-8 text-sm" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                <div className="space-y-1">
                                  <Label htmlFor="guest-shippingState" className="text-xs font-semibold">{t("checkout.state")}</Label>
                                  <Input id="guest-shippingState" value={guestShippingState} onChange={(e) => setGuestShippingState(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="guest-shippingZipCode" className="text-xs font-semibold">{t("checkout.zipCode")}</Label>
                                  <Input id="guest-shippingZipCode" value={guestShippingZipCode} onChange={(e) => setGuestShippingZipCode(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="guest-shippingCountry" className="text-xs font-semibold">{t("checkout.country")}</Label>
                                  <Input id="guest-shippingCountry" value={guestShippingCountry} onChange={(e) => setGuestShippingCountry(e.target.value)} className="h-8 text-sm" />
                                </div>
                              </div>
                            </div>
                          )}

                          <Button type="submit" className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]">
                            {t("checkout.continueAsGuest")}
                          </Button>
                          <p className="text-[10px] text-[#8b9dbf]"><span className="text-red-500">*</span> {t("checkout.requiredFieldsNote")}</p>
                        </form>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </>
        )}
        </DialogContent>
      </Dialog>

      <Dialog open={verificationEmailDialogOpen} onOpenChange={setVerificationEmailDialogOpen}>
        <DialogContent className="max-w-sm rounded-xl border border-[#d8dce6] p-0">
          <div className="border-b border-[#e7eaf1] bg-[#1a2a5e] px-4 py-3 text-white">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <CheckCircle2 className="h-4.5 w-4.5 text-[#8ff0a4]" />
                Verifizierungs-E-Mail gesendet
              </DialogTitle>
              <DialogDescription className="text-xs text-blue-100">
                Bitte bestätigen Sie Ihr Konto, um den Checkout fortzusetzen.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-3 px-4 py-4 text-sm text-[#1a2a5e]">
            <p>
              Wir haben eine Aktivierungs-E-Mail an
              <span className="ml-1 break-all font-semibold">{verificationEmailAddress || email}</span>
              gesendet.
            </p>
            <p className="text-xs text-[#5f6d86]">
              Ein weiterer Klick auf "Konto Erstellen" sendet keine zusätzliche E-Mail.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-8 w-full border-[#b6c3dd] text-xs font-semibold text-[#1a2a5e] hover:bg-[#f2f5fb]"
              onClick={handleResendVerificationEmail}
              disabled={resendVerificationLoading || resendCountdown > 0}
            >
              {resendVerificationLoading
                ? "Wird gesendet..."
                : resendCountdown > 0
                  ? `Erneut senden in ${resendCountdown}s`
                  : "Verifizierungs-E-Mail erneut senden"}
            </Button>
            <Button
              type="button"
              className="h-9 w-full bg-[#f5b800] text-sm font-bold text-[#1a2a5e] hover:bg-[#e5ab00]"
              onClick={() => setVerificationEmailDialogOpen(false)}
            >
              Verstanden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
