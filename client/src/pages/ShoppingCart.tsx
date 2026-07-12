import { useEffect, useRef, useState } from "react"
import { SEO } from '@/components/SEO'
import { Link, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/useToast"
import { getCart, updateCartItem, removeFromCart, removeRepairOrderFromCart, applyPromoCode, Cart, Product } from "@/api/shop"
import { CheckoutDialog } from "@/components/checkout/CheckoutDialog"
import { CartProductDetailsDialog } from "@/components/cart/CartProductDetailsDialog"
import { RepairOrderDetailsDialog } from "@/components/cart/RepairOrderDetailsDialog"
import {
  ShoppingCart as ShoppingCartIcon,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowLeft,
  CreditCard,
  Wrench,
  Smartphone,
  Package,
  TrendingUp,
  Shield,
  Zap,
  CheckCircle2
} from "lucide-react"
import { useTranslation } from 'react-i18next'
import { formatEUR } from '@/lib/utils'

const PRIMARY_BLUE = 'var(--primary-blue, #1a2a5e)'
const ACCENT_YELLOW = 'var(--accent-yellow, #f5b800)'

const getRepairOrderDeviceImage = (order: any) => {
  if (order?.deviceImage) return order.deviceImage
  return Array.isArray(order?.photos) && order.photos.length > 0 ? order.photos[0] : null
}

const getRepairOrderServiceLabels = (services?: any[]) => {
  if (!Array.isArray(services)) return []

  return services
    .map((service) => {
      if (typeof service === 'string') return service
      if (service?.name) return service.name
      if (service?.title) return service.title
      if (service?.label) return service.label
      return null
    })
    .filter(Boolean)
}

const getRepairOrderDisplayServiceLabels = (order: any) => {
  if (Array.isArray(order?.serviceNames) && order.serviceNames.length > 0) {
    return order.serviceNames.filter(Boolean)
  }

  return getRepairOrderServiceLabels(order?.services)
}

const getRepairOrderAddOnLabels = (addOns?: any[]) => {
  if (!Array.isArray(addOns)) return []

  return addOns
    .map((addOn) => {
      if (typeof addOn === 'string') return addOn
      if (addOn?.name) return addOn.name
      if (addOn?.title) return addOn.title
      return null
    })
    .filter(Boolean)
}

const getRepairOrderGroupingKey = (order: any) => {
  const servicesKey = getRepairOrderServiceLabels(order.services).join('|')
  const addOnsKey = getRepairOrderAddOnLabels(order.addOns).join('|')
  const photosKey = Array.isArray(order.photos) ? order.photos.join('|') : ''
  const patternKey = Array.isArray(order.unlockPattern) ? order.unlockPattern.join('|') : ''

  return [
    String(order.deviceType || ''),
    String(order.deviceBrand || ''),
    String(order.deviceModel || ''),
    servicesKey,
    addOnsKey,
    String(order.customerNotes || ''),
    photosKey,
    String(order.unlockCode || ''),
    patternKey,
    String(Boolean(order.noLock)),
    String(order.totalCost || ''),
  ].join('::')
}

const groupRepairOrders = (repairOrders?: any[]) => {
  const groupedOrders: Record<string, any[]> = {}

  ;(repairOrders || []).forEach((order: any) => {
    const key = getRepairOrderGroupingKey(order)
    if (!groupedOrders[key]) {
      groupedOrders[key] = []
    }
    groupedOrders[key].push(order)
  })

  return Object.values(groupedOrders).map((ordersGroup) => ({
    order: ordersGroup[0],
    ordersGroup,
    quantity: ordersGroup.length,
  }))
}

export function ShoppingCartPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState("")
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [cartFetchVersion, setCartFetchVersion] = useState(0)
  const [selectedProductItem, setSelectedProductItem] = useState<{ product: Product; quantity: number } | null>(null)
  const [selectedRepairOrderGroup, setSelectedRepairOrderGroup] = useState<{ order: any; quantity: number } | null>(null)
  const [confirmRepairDeleteOpen, setConfirmRepairDeleteOpen] = useState(false)
  const [pendingRepairOrderIds, setPendingRepairOrderIds] = useState<string[]>([])
  const { toast } = useToast()
  const checkoutFlowRef = useRef(
    searchParams.get('checkout') === '1' || sessionStorage.getItem('checkoutFlowPending') === '1'
  )

  const notifyCartUpdated = () => {
    window.dispatchEvent(new Event('cartUpdated'))
    window.dispatchEvent(new Event('guestCartUpdate'))
  }

  const hasCartContent = (nextCart: Cart | null | undefined) => {
    if (!nextCart) return false
    const itemCount = Array.isArray(nextCart.items) ? nextCart.items.length : 0
    const repairCount = Array.isArray(nextCart.repairOrders) ? nextCart.repairOrders.length : 0
    return itemCount > 0 || repairCount > 0
  }

  const fetchServerCartWithSession = async (): Promise<Cart | null> => {
    try {
      const response = await fetch('/api/cart', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return (data as any)?.cart || null
    } catch (error) {
      console.warn('Session cart fetch failed:', error)
      return null
    }
  }

  useEffect(() => {
    let cancelled = false

    const fetchCart = async () => {
      try {
        console.log("Fetching cart...")
        let currentCart: Cart | null = null

        const shouldRetryForCheckoutFlow = checkoutFlowRef.current
        if (shouldRetryForCheckoutFlow) {
          currentCart = await fetchServerCartWithSession()
        }

        if (!currentCart) {
          const response = await getCart()
          currentCart = (response as any).cart || null
        }

        if (!cancelled) {
          setCart(currentCart)
        }

        // After email verification we can hit a short race where cart updates are not
        // immediately visible on the first request. Retry briefly so users don't need reload.
        if (shouldRetryForCheckoutFlow && !hasCartContent(currentCart)) {
          const retryDelaysMs = [300, 800, 1500, 2500, 4000]

          for (const delay of retryDelaysMs) {
            await new Promise((resolve) => window.setTimeout(resolve, delay))
            if (cancelled) return

            try {
              const cookieCart = await fetchServerCartWithSession()
              let nextCart: Cart | null = cookieCart
              if (!nextCart) {
                const retryResponse = await getCart()
                nextCart = (retryResponse as any).cart || null
              }

              if (cancelled) return
              setCart(nextCart)

              if (hasCartContent(nextCart)) {
                checkoutFlowRef.current = false
                sessionStorage.removeItem('checkoutFlowPending')
                break
              }
            } catch (retryError) {
              console.warn('Retry cart fetch failed after verification flow:', retryError)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching cart:", error)
        if (!cancelled) {
          toast({
            title: t('common.error'),
            description: t('cart.failedToLoad'),
            variant: "destructive"
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchCart()

    return () => {
      cancelled = true
    }
  }, [toast, t, cartFetchVersion])

  useEffect(() => {
    if (searchParams.get('checkout') !== '1') {
      return
    }

    checkoutFlowRef.current = true
    sessionStorage.setItem('checkoutFlowPending', '1')
    setLoading(true)
    setCartFetchVersion((prev) => prev + 1)

    setCheckoutDialogOpen(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('checkout')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const isUserAuthenticated = () => Boolean(localStorage.getItem("accessToken"))

  const handleUpdateQuantity = async (itemId: string, productId: string, newQuantity: number) => {
    if (newQuantity < 0) return

    const currentItem = cart?.items.find(
      (item) => item._id === itemId || item.productId?._id === productId
    )
    const rawStockCount = (currentItem?.productId as any)?.stockCount
    const parsedStockCount = Number(rawStockCount)
    const hasStockCount =
      rawStockCount !== null &&
      rawStockCount !== undefined &&
      rawStockCount !== '' &&
      Number.isFinite(parsedStockCount)
    const maxStock = hasStockCount ? Math.max(0, parsedStockCount) : undefined
    const hasInStockFlag = typeof currentItem?.productId?.inStock === 'boolean'
    const currentInStock = hasInStockFlag ? Boolean(currentItem?.productId?.inStock) : true
    const shouldEnforceMaxStock = typeof maxStock === 'number' && (maxStock > 0 || !currentInStock)
    let targetQuantity = newQuantity

    if (shouldEnforceMaxStock && targetQuantity > (maxStock as number)) {
      targetQuantity = maxStock
      toast({
        title: 'Lagerbestand erreicht',
        description: `Maximal ${maxStock} Stück verfügbar.`,
      })
    }

    if (shouldEnforceMaxStock && currentItem && targetQuantity === currentItem.quantity) {
      return
    }

    try {
      const cartItemIdentifier = isUserAuthenticated() ? productId : itemId
      const updatingKey = targetQuantity === 0 ? itemId : cartItemIdentifier

      setUpdating(updatingKey)
      console.log("Updating cart item:", { itemId, productId, targetQuantity, cartItemIdentifier })

      if (targetQuantity === 0) {
        await removeFromCart(itemId)
        toast({
          title: t('cart.itemRemoved'),
          description: t('cart.itemRemovedDesc')
        })
      } else {
        await updateCartItem(cartItemIdentifier, targetQuantity)
        toast({
          title: t('cart.cartUpdated'),
          description: t('cart.cartUpdatedDesc')
        })
      }

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
      notifyCartUpdated()
    } catch (error: any) {
      console.error("Error updating cart:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('cart.failedToUpdate'),
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) return

    try {
      setApplyingPromo(true)
      console.log("Applying promo code:", promoCode)
      await applyPromoCode({ promoCode })

      toast({
        title: t('cart.promoApplied'),
        description: t('cart.promoAppliedDesc')
      })

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
      notifyCartUpdated()
      setPromoCode("")
    } catch (error: any) {
      console.error("Error applying promo code:", error)
      toast({
        title: t('cart.failedToApplyPromo'),
        description: error.message || t('cart.failedToApplyPromo'),
        variant: "destructive"
      })
    } finally {
      setApplyingPromo(false)
    }
  }

  const requestRemoveRepairOrders = (repairOrderIds: string[]) => {
    if (!repairOrderIds.length) return
    setPendingRepairOrderIds(repairOrderIds)
    setConfirmRepairDeleteOpen(true)
  }

  const handleConfirmRemoveRepairOrders = async () => {
    if (!pendingRepairOrderIds.length) {
      setConfirmRepairDeleteOpen(false)
      return
    }

    try {
      setUpdating(pendingRepairOrderIds[0])
      console.log("Removing repair orders:", pendingRepairOrderIds)

      for (const repairOrderId of pendingRepairOrderIds) {
        await removeRepairOrderFromCart(repairOrderId)
      }

      toast({
        title: t('cart.itemRemoved'),
        description: t('cart.itemRemovedDesc')
      })

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
      notifyCartUpdated()
    } catch (error: any) {
      console.error("Error removing repair order:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('cart.failedToUpdate'),
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
      setConfirmRepairDeleteOpen(false)
      setPendingRepairOrderIds([])
    }
  }

  const handleProceedToCheckout = () => {
    setCheckoutDialogOpen(true)
  }

  const handleCheckoutDialogSuccess = async () => {
    try {
      const response = await getCart()
      setCart((response as any).cart)
    } catch (error) {
      console.error("Error refreshing cart after checkout action:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--off-white, #f8f9fc)' }}>
        <div className="container mx-auto px-4 py-8">
          <Card className="animate-pulse border-0 shadow-lg bg-white">
            <CardHeader>
              <div className="h-7 rounded-lg w-1/3" style={{ backgroundColor: 'var(--gray-200, #d8dce6)' }}></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--gray-50, #f5f6f8)' }}>
                    <div className="w-24 h-24 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--gray-200, #d8dce6)' }}></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 rounded w-2/3" style={{ backgroundColor: 'var(--gray-200, #d8dce6)' }}></div>
                      <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const hasItems = cart && (cart.items.length > 0 || (cart.repairOrders && cart.repairOrders.length > 0))
  const groupedRepairOrders = groupRepairOrders(cart?.repairOrders)

  if (!cart || !hasItems) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12" style={{ backgroundColor: 'var(--off-white, #f8f9fc)' }}>
        <div className="container mx-auto px-4">
          <Card className="max-w-2xl mx-auto shadow-xl bg-white overflow-hidden" style={{ borderRadius: 'var(--radius-lg, 16px)' }}>
            <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--primary-blue, #1a2a5e)' }}></div>
            <CardContent className="text-center py-12 px-6">
              <div className="relative inline-block mb-6">
                <div className="relative p-8 rounded-full" style={{ backgroundColor: 'var(--gray-50, #f5f6f8)' }}>
                  <ShoppingCartIcon className="h-16 w-16" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-3" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                {t('cart.emptyCart')}
              </h3>
              <p className="mb-8 text-base max-w-md mx-auto" style={{ color: 'var(--gray-600, #4a5568)' }}>
                {t('cart.emptyCartDesc')}
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button
                  asChild
                  variant="outline"
                  className="transition-all duration-300 group shadow-sm hover:shadow-md"
                  style={{ 
                    borderWidth: '2px', 
                    borderColor: 'var(--primary-blue, #1a2a5e)',
                    color: 'var(--primary-blue, #1a2a5e)'
                  }}
                >
                  <Link to="/shop">
                    <Package className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                    {t('cart.continueShopping')}
                  </Link>
                </Button>
                <Button
                  asChild
                  className="text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
                  style={{ 
                    backgroundColor: 'var(--accent-yellow, #f5b800)',
                    color: 'var(--primary-blue, #1a2a5e)'
                  }}
                >
                  <Link to="/new-order">
                    <Wrench className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
                    {t('orders.newOrder')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--off-white, #f8f9fc)' }}>
      <SEO
        title="Warenkorb – FixitHub Shop"
        description="Ihr FixitHub Warenkorb auf einen Blick. Produkte prüfen, Menge anpassen und sicher zur Kasse gehen."
        canonical="/cart"
        noindex={true}
      />
      <div className="container mx-auto px-2.5 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-5">
          <div
            className="flex flex-col gap-3 rounded-2xl px-4 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-5"
            style={{ backgroundColor: PRIMARY_BLUE }}
          >
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.9rem]">
                {t('cart.title')}
              </h1>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="secondary" className="px-2.5 py-1 text-xs font-semibold shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.14)', color: '#ffffff' }}>
                  <ShoppingCartIcon className="mr-1.5 h-3.5 w-3.5" />
                  {cart.totalItems} {cart.totalItems === 1 ? 'Artikel' : 'Artikel'}
                </Badge>
                <span className="text-xs font-medium text-blue-100 sm:text-sm">in Ihrem Warenkorb</span>
              </div>
            </div>
            <Button
              variant="outline"
              asChild
              className="group h-9 border-white/30 bg-white/10 px-3 text-xs font-semibold text-white transition-all duration-300 hover:bg-white hover:text-[#1a2a5e] sm:text-sm"
              style={{ 
                borderWidth: '1px',
                borderColor: 'rgba(255,255,255,0.3)'
              }}
            >
              <Link to="/shop">
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                {t('cart.continueShopping')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          {/* Cart Items - Left Column (2/3 width) */}
          <div className="space-y-3 lg:col-span-2">
            {/* Product Items */}
            {cart.items.filter((item) => item.productId).map((item, index) => {
              const rawStockCount = (item.productId as any)?.stockCount
              const parsedStockCount = Number(rawStockCount)
              const hasStockCount =
                rawStockCount !== null &&
                rawStockCount !== undefined &&
                rawStockCount !== '' &&
                Number.isFinite(parsedStockCount)
              const effectiveStockCount = hasStockCount ? Math.max(0, parsedStockCount) : 0
              const hasInStockFlag = typeof item.productId.inStock === 'boolean'
              const fallbackInStock = hasInStockFlag ? item.productId.inStock : true
              const effectiveInStock = hasStockCount
                ? (effectiveStockCount > 0 || fallbackInStock)
                : fallbackInStock
              const isAtStockLimit = hasStockCount && effectiveStockCount > 0
                ? item.quantity >= effectiveStockCount
                : false

              return (
              <div
                key={item._id}
                className="group"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
              >
                <Card className="overflow-hidden bg-white shadow-sm transition-all duration-300 hover:shadow-md group-hover:scale-[1.005]" style={{ borderRadius: 'var(--radius-md, 10px)' }}>
                  <CardContent className="p-3 sm:p-3.5">
                    <div
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedProductItem({ product: item.productId, quantity: item.quantity })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedProductItem({ product: item.productId, quantity: item.quantity })
                        }
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-[#1a2a5e] px-3 py-2.5 sm:px-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="border-0 bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white shadow-none">
                              <Package className="mr-1 h-3 w-3" />
                              Shopping-Artikel
                            </Badge>
                            {!effectiveInStock && (
                              <Badge variant="destructive" className="border-0 text-[11px] shadow-none">
                                {t('shop.outOfStock')}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] font-medium text-blue-100 sm:text-xs">
                            Tippen fuer Detailansicht
                          </p>
                        </div>
                        <span className="hidden text-[11px] font-semibold text-white sm:inline sm:text-xs">Details ansehen</span>
                      </div>

                      <div className="flex gap-2 sm:gap-3">
                      {/* Product Image */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={item.productId.images?.[0] || '/placeholder-product.png'}
                            alt={item.productId.name || 'Product'}
                            className="relative h-16 w-16 rounded-lg object-cover shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-[88px] sm:w-[88px]"
                            style={{ borderRadius: 'var(--radius-md, 10px)' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-2 flex items-start justify-between">
                            <div className="flex-1 min-w-0 pr-3">
                              <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-5 sm:text-[0.95rem]" style={{ color: PRIMARY_BLUE }}>{item.productId.name}</h3>
                              <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--gray-500, #636e85)' }}>
                                <Package className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{item.productId.brand}</span>
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge className="border-0 bg-[#eef6f1] px-2 py-0.5 text-[11px] font-semibold text-[#2f855a] shadow-none">
                                  {item.productId.category}
                                </Badge>
                                {item.productId.features?.[0] && (
                                  <Badge className="border-0 bg-[#fff7db] px-2 py-0.5 text-[11px] font-semibold text-[#a16207] shadow-none">
                                    {item.productId.features[0]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <p className="line-clamp-2 text-[11px] leading-5 sm:text-xs" style={{ color: 'var(--gray-600, #4a5568)' }}>
                            {item.productId.description}
                          </p>

                          <div className="mt-2.5 flex items-center justify-between border-t border-[#e7eaf1] pt-2 text-[11px] sm:text-xs">
                            <div className="flex items-center gap-1.5 font-medium text-[#4a5568]">
                              <Shield className="h-3.5 w-3.5 text-[#38a169]" />
                              {effectiveInStock
                                ? (hasStockCount && effectiveStockCount > 0 ? `${effectiveStockCount} verfuegbar` : 'Verfuegbar')
                                : t('shop.outOfStock')}
                            </div>
                            <span className="font-semibold text-[#1a2a5e]">Zum Produktdialog</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7eaf1] pt-3">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shadow-sm transition-all sm:h-8 sm:w-8"
                          style={{ 
                            borderColor: 'var(--gray-300, #b0b8c9)'
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleUpdateQuantity(item._id, item.productId._id, item.quantity - 1)
                          }}
                          disabled={(updating === item.productId._id || updating === item._id) || item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-xs font-bold sm:w-10 sm:text-sm" style={{ color: PRIMARY_BLUE }}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 shadow-sm transition-all sm:h-8 sm:w-8"
                          style={{ 
                            borderColor: 'var(--gray-300, #b0b8c9)'
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleUpdateQuantity(item._id, item.productId._id, item.quantity + 1)
                          }}
                          disabled={(updating === item.productId._id || updating === item._id) || !effectiveInStock || isAtStockLimit}
                        >
                          <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                      </div>

                      <div className="ml-auto flex items-center gap-2 sm:gap-3">
                        <div className="text-right">
                          <p className="text-base font-bold sm:text-lg" style={{ color: PRIMARY_BLUE }}>
                            {formatEUR(item.productId.price * item.quantity)}
                          </p>
                          <p className="text-[11px] font-medium" style={{ color: 'var(--gray-500, #636e85)' }}>
                            {formatEUR(item.productId.price)} pro Stück
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleUpdateQuantity(item._id, item.productId._id, 0)
                          }}
                          disabled={updating === item.productId._id || updating === item._id}
                          className="h-6 w-6 shrink-0 transition-colors hover:bg-red-50 hover:text-red-600 sm:h-7 sm:w-7"
                        >
                          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )})}

            {/* Repair Orders */}
            {groupedRepairOrders.map(({ order, ordersGroup, quantity }, groupIndex) => {
              const deviceImage = getRepairOrderDeviceImage(order)
              const serviceLabels = getRepairOrderDisplayServiceLabels(order)
              const addOnLabels = getRepairOrderAddOnLabels(order.addOns)

              return (
                <div
                  key={`group-${groupIndex}`}
                  className="group"
                  style={{
                    animation: `fadeInUp 0.5s ease-out ${(cart.items.length + groupIndex) * 0.1}s both`
                  }}
                >
                  <Card
                    className="overflow-hidden border-0 bg-white shadow-sm transition-all duration-300 hover:shadow-md group-hover:scale-[1.005]"
                    style={{ borderRadius: 'var(--radius-md, 10px)' }}
                  >
                    <CardContent className="p-0">
                      <div
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedRepairOrderGroup({ order, quantity })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedRepairOrderGroup({ order, quantity })
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 bg-[#1a2a5e] px-3 py-2.5 sm:px-3.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-white sm:text-[0.95rem]">Reparaturauftrag</h3>
                              <Badge className="border-0 bg-white/15 px-2 py-0.5 text-[11px] text-white shadow-none">
                                <Smartphone className="mr-1 h-3 w-3" />
                                {order.deviceType || 'Gerät'}
                              </Badge>
                              {quantity > 1 && (
                                <Badge className="border-0 bg-[#f5b800] px-2 py-0.5 text-[11px] font-bold text-[#1a2a5e] shadow-none">
                                  <Package className="mr-1 h-3 w-3" />
                                  {quantity}x
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-blue-100 sm:text-xs">Tippen für Detailansicht</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation()
                              requestRemoveRepairOrders(ordersGroup.map((groupedOrder) => groupedOrder._id))
                            }}
                            disabled={ordersGroup.some((groupedOrder) => updating === groupedOrder._id)}
                            className="h-7 w-7 shrink-0 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="p-3 sm:p-3.5">
                          <div className="flex gap-2 sm:gap-3">
                            <div className="relative flex-shrink-0">
                              {deviceImage ? (
                                <img
                                  src={deviceImage}
                                  alt={`${order.deviceBrand} ${order.deviceModel}`}
                                  className="h-16 w-16 rounded-lg object-cover shadow-sm sm:h-[88px] sm:w-[88px]"
                                  onError={(event) => {
                                    event.currentTarget.style.display = 'none'
                                    const placeholder = event.currentTarget.nextElementSibling as HTMLElement | null
                                    placeholder?.classList.remove('hidden')
                                  }}
                                />
                              ) : null}
                              <div className={`${deviceImage ? 'hidden' : 'flex'} h-16 w-16 items-center justify-center rounded-lg bg-[#eef3fb] shadow-sm sm:h-[88px] sm:w-[88px]`}>
                                <Wrench className="h-8 w-8 text-[#1a2a5e]" />
                              </div>
                              {quantity > 1 && (
                                <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#f5b800] text-[11px] font-bold text-[#1a2a5e] shadow-md">
                                  {quantity}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#1a2a5e] sm:text-[0.95rem]">
                                    {[order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') || order.deviceType || 'Gerät'}
                                  </p>
                                  <p className="mt-1 text-[11px] text-[#636e85] sm:text-xs">
                                    {[order.deviceType, order.deviceBrand, order.deviceModel].filter(Boolean).join(' • ')}
                                  </p>
                                </div>
                                <div className="text-right sm:ml-auto">
                                  {quantity > 1 && (
                                    <p className="text-[10px] font-medium text-[#636e85] sm:text-[11px]">
                                      {formatEUR(order.totalCost || 0)} × {quantity}
                                    </p>
                                  )}
                                  <p className="text-sm font-bold text-[#1a2a5e] sm:text-lg">
                                    {formatEUR((order.totalCost || 0) * quantity)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Badge className="border-0 bg-[#eef6f1] px-2 py-0.5 text-[11px] font-semibold text-[#2f855a] shadow-none">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  {serviceLabels.length} Service{serviceLabels.length === 1 ? '' : 's'}
                                </Badge>
                                {addOnLabels.length > 0 && (
                                  <Badge className="border-0 bg-[#fff7db] px-2 py-0.5 text-[11px] font-semibold text-[#a16207] shadow-none">
                                    <Zap className="mr-1 h-3 w-3" />
                                    {addOnLabels.length} Extra{addOnLabels.length === 1 ? '' : 's'}
                                  </Badge>
                                )}
                                {order.customerNotes?.trim() && (
                                  <Badge className="border-0 bg-[#eef3fb] px-2 py-0.5 text-[11px] font-semibold text-[#1a2a5e] shadow-none">
                                    Hinweis vorhanden
                                  </Badge>
                                )}
                              </div>

                              {(serviceLabels.length > 0 || addOnLabels.length > 0) && (
                                <div className="mt-2 space-y-1.5 text-[11px] text-[#4a5568] sm:text-xs">
                                  {serviceLabels.length > 0 && (
                                    <p className="line-clamp-2">
                                      <span className="font-semibold text-[#1a2a5e]">Services:</span> {serviceLabels.slice(0, 3).join(', ')}{serviceLabels.length > 3 ? ` +${serviceLabels.length - 3}` : ''}
                                    </p>
                                  )}
                                  {addOnLabels.length > 0 && (
                                    <p className="line-clamp-2">
                                      <span className="font-semibold text-[#1a2a5e]">Extras:</span> {addOnLabels.slice(0, 2).join(', ')}{addOnLabels.length > 2 ? ` +${addOnLabels.length - 2}` : ''}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7eaf1] pt-2 text-[11px] sm:text-xs">
                                <div className="flex items-center gap-1.5 font-medium text-[#4a5568]">
                                  <Shield className="h-3.5 w-3.5 text-[#38a169]" />
                                  Professionelle Reparatur inklusive
                                </div>
                                <span className="font-semibold text-[#1a2a5e]">Details ansehen</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>

          {/* Order Summary - Right Column (1/3 width) */}
          <div className="space-y-4">
            {/* Promo Code */}
            <Card className="overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-md" style={{ borderRadius: 'var(--radius-md, 10px)' }}>
              <CardHeader className="px-4 py-3" style={{ backgroundColor: PRIMARY_BLUE }}>
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-white sm:text-base">
                  <Tag className="h-4 w-4 flex-shrink-0 text-white" />
                  {t('cart.promoCode')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('cart.promoPlaceholder')}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="h-9 rounded-lg text-sm transition-colors"
                    style={{ borderWidth: '1px', borderColor: 'var(--gray-300, #b0b8c9)' }}
                  />
                  <Button
                    onClick={handleApplyPromoCode}
                    disabled={!promoCode.trim() || applyingPromo}
                    className="rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md sm:text-sm"
                    style={{ backgroundColor: 'var(--success, #38a169)' }}
                  >
                    {applyingPromo ? t('common.loading') : t('cart.apply')}
                  </Button>
                </div>
                {cart.promoCode && (
                  <div className="flex items-center justify-between text-sm p-3 rounded-lg shadow-sm" style={{ backgroundColor: '#f0fdf4', border: '1px solid var(--success, #38a169)' }}>
                    <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--success, #38a169)' }}>
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      Code "{cart.promoCode}" angewendet
                    </span>
                    <span className="font-bold text-base" style={{ color: 'var(--success, #38a169)' }}>
                      -{formatEUR(cart.discount ?? 0)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="sticky top-20 overflow-hidden bg-white shadow-md" style={{ borderRadius: 'var(--radius-md, 10px)' }}>
              <CardHeader className="px-4 py-3" style={{ backgroundColor: PRIMARY_BLUE }}>
                <CardTitle className="text-base font-bold text-white sm:text-lg">{t('cart.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 py-4">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>{t('cart.subtotal')}</span>
                    <span className="font-bold" style={{ color: PRIMARY_BLUE }}>{formatEUR(cart.subtotal)}</span>
                  </div>

                  {cart.discount && cart.discount > 0 && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid var(--success, #38a169)', color: 'var(--success, #38a169)' }}>
                      <span className="flex items-center gap-1.5 font-medium">
                        <TrendingUp className="h-4 w-4 flex-shrink-0" />
                        {t('cart.discount')}
                      </span>
                      <span className="font-bold">-{formatEUR(cart.discount)}</span>
                    </div>
                  )}

                  <div className="border-t pt-2.5 space-y-2" style={{ borderColor: 'var(--gray-200, #d8dce6)' }}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>{t('cart.netto')}</span>
                      <span className="font-bold" style={{ color: PRIMARY_BLUE }}>{formatEUR(cart.total - cart.tax)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>{t('cart.tax')}</span>
                      <span className="font-bold" style={{ color: PRIMARY_BLUE }}>{formatEUR(cart.tax)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-center" style={{ borderTop: '2px solid var(--gray-200, #d8dce6)' }}>
                  <span className="text-sm font-bold sm:text-base" style={{ color: PRIMARY_BLUE }}>{t('cart.grandTotal')}</span>
                  <span className="text-xl font-bold sm:text-2xl" style={{ color: PRIMARY_BLUE }}>
                    {formatEUR(cart.total)}
                  </span>
                </div>

                <Button
                  className="group w-full rounded-lg py-5 text-sm font-bold shadow-lg transition-all duration-300 hover:shadow-xl sm:text-base"
                  style={{ backgroundColor: ACCENT_YELLOW, color: PRIMARY_BLUE }}
                  onClick={handleProceedToCheckout}
                >
                  <CreditCard className="mr-2 h-4 w-4 transition-transform group-hover:scale-110 sm:h-5 sm:w-5" />
                  {t('cart.proceedToCheckout')}
                </Button>

                <p className="text-xs text-center flex items-center justify-center gap-1.5 font-medium" style={{ color: 'var(--gray-500, #636e85)' }}>
                  <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                  Sichere Zahlung durch Stripe
                </p>
              </CardContent>
            </Card>

            {/* Benefits Card */}
            <Card className="overflow-hidden bg-white shadow-sm" style={{ borderRadius: 'var(--radius-md, 10px)' }}>
              <CardHeader className="px-4 py-3" style={{ backgroundColor: PRIMARY_BLUE }}>
                <CardTitle className="text-sm font-bold text-white">Vorteile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 py-4">
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}>
                    <Shield className="h-4 w-4" style={{ color: PRIMARY_BLUE }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: PRIMARY_BLUE }}>Kostenloser Versand</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600, #4a5568)' }}>Bei Bestellungen über 50 €</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success, #38a169)' }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: PRIMARY_BLUE }}>Qualitätsgarantie</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600, #4a5568)' }}>90 Tage Garantie auf alle Reparaturen</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}>
                    <Zap className="h-4 w-4" style={{ color: ACCENT_YELLOW }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: PRIMARY_BLUE }}>Schnelle Bearbeitung</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600, #4a5568)' }}>Die meisten Reparaturen in 24-48 Stunden</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmRepairDeleteOpen}
        onOpenChange={(open) => {
          setConfirmRepairDeleteOpen(open)
          if (!open) {
            setPendingRepairOrderIds([])
          }
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden border-[#d8dce6] p-0">
          <AlertDialogHeader className="space-y-1 border-b border-[#2a3f7e] bg-[#1a2a5e] px-4 py-3 text-left">
            <AlertDialogTitle className="text-base font-semibold text-[#f5b800]">
              Reparaturauftrag entfernen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#d8dce6] sm:text-sm">
              {pendingRepairOrderIds.length > 1
                ? 'Die ausgewaehlten Reparaturauftraege werden aus dem Warenkorb entfernt.'
                : 'Der ausgewaehlte Reparaturauftrag wird aus dem Warenkorb entfernt.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-4 py-4">
            <AlertDialogCancel className="border-[#d8dce6] text-[#1a2a5e]">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveRepairOrders}
              className="bg-[#c53030] text-white hover:bg-[#9b2c2c]"
            >
              {pendingRepairOrderIds.length > 1 ? 'Auftraege entfernen' : 'Auftrag entfernen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        onSuccess={handleCheckoutDialogSuccess}
        cart={cart}
      />

      <RepairOrderDetailsDialog
        open={Boolean(selectedRepairOrderGroup)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRepairOrderGroup(null)
          }
        }}
        order={selectedRepairOrderGroup?.order || null}
        quantity={selectedRepairOrderGroup?.quantity || 1}
      />

      <CartProductDetailsDialog
        open={Boolean(selectedProductItem)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProductItem(null)
          }
        }}
        product={selectedProductItem?.product || null}
        quantity={selectedProductItem?.quantity || 1}
      />

      {/* Custom animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
