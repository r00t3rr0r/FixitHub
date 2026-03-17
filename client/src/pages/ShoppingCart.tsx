import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getCart, updateCartItem, removeFromCart, removeRepairOrderFromCart, applyPromoCode, Cart, CartItem } from "@/api/shop"
import { initializeCheckout, completeCheckout } from "@/api/checkout"
import { useAuth } from "@/contexts/AuthContext"
import { CheckoutDialog } from "@/components/checkout/CheckoutDialog"
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

export function ShoppingCartPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState("")
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchCart = async () => {
      try {
        console.log("Fetching cart...")
        const response = await getCart()
        setCart((response as any).cart)
      } catch (error) {
        console.error("Error fetching cart:", error)
        toast({
          title: t('common.error'),
          description: t('cart.failedToLoad'),
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCart()
  }, [toast, t])

  const handleUpdateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 0) return

    try {
      setUpdating(productId)
      console.log("Updating cart item:", productId, newQuantity)

      if (newQuantity === 0) {
        await removeFromCart(productId)
        toast({
          title: t('cart.itemRemoved'),
          description: t('cart.itemRemovedDesc')
        })
      } else {
        await updateCartItem(productId, newQuantity)
        toast({
          title: t('cart.cartUpdated'),
          description: t('cart.cartUpdatedDesc')
        })
      }

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
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

  const handleRemoveRepairOrder = async (repairOrderId: string) => {
    try {
      setUpdating(repairOrderId)
      console.log("Removing repair order:", repairOrderId)

      await removeRepairOrderFromCart(repairOrderId)
      toast({
        title: t('cart.itemRemoved'),
        description: t('cart.itemRemovedDesc')
      })

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
    } catch (error: any) {
      console.error("Error removing repair order:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('cart.failedToUpdate'),
        variant: "destructive"
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleProceedToCheckout = async () => {
    console.log("Proceed to checkout clicked. Is authenticated:", isAuthenticated)

    // Check if user is logged in
    if (!isAuthenticated) {
      console.log("User not authenticated, opening checkout dialog")
      setCheckoutDialogOpen(true)
      return
    }

    // User is logged in, proceed with checkout
    try {
      setCheckoutLoading(true)
      console.log("User authenticated, initializing checkout...")

      const response = await initializeCheckout()

      console.log("Checkout initialized successfully:", response)

      // Complete the checkout - create orders from cart repair orders
      console.log("Completing checkout and creating orders...")
      const checkoutResult = await completeCheckout()

      console.log("Checkout completed successfully:", checkoutResult)

      toast({
        title: t('common.success'),
        description: checkoutResult.message || `Successfully created ${checkoutResult.orderIds?.length || 0} order(s)`
      })

      // Navigate to bookings page to show created orders
      navigate('/bookings')
    } catch (error: any) {
      console.error("Error during checkout:", error)

      // Check if error is about incomplete invoice address
      if (error.message && error.message.includes('invoice address')) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive",
          action: {
            label: "Complete Profile",
            onClick: () => navigate('/profile')
          }
        })
      } else {
        toast({
          title: t('common.error'),
          description: error.message || t('checkout.checkoutFailed'),
          variant: "destructive"
        })
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleCheckoutSuccess = async () => {
    console.log("Checkout authentication successful")

    // User has successfully logged in or registered, now initialize checkout
    try {
      setCheckoutLoading(true)
      const response = await initializeCheckout()

      console.log("Checkout initialized after authentication:", response)

      // Complete the checkout - create orders from cart repair orders
      console.log("Completing checkout and creating orders...")
      const checkoutResult = await completeCheckout()

      console.log("Checkout completed successfully:", checkoutResult)

      toast({
        title: t('common.success'),
        description: checkoutResult.message || `Successfully created ${checkoutResult.orderIds?.length || 0} order(s)`
      })

      // Navigate to bookings page to show created orders
      navigate('/bookings')
    } catch (error: any) {
      console.error("Error during checkout after authentication:", error)

      // Check if error is about incomplete invoice address
      if (error.message && error.message.includes('invoice address')) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive",
          action: {
            label: "Complete Profile",
            onClick: () => navigate('/profile')
          }
        })
      } else {
        toast({
          title: t('common.error'),
          description: error.message || t('checkout.checkoutFailed'),
          variant: "destructive"
        })
      }
    } finally {
      setCheckoutLoading(false)
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
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-white rounded-lg shadow-md" style={{ borderRadius: 'var(--radius-lg, 16px)' }}>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                {t('cart.title')}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)', color: 'var(--primary-blue, #1a2a5e)' }}>
                  <ShoppingCartIcon className="h-4 w-4 mr-1.5" />
                  {cart.totalItems} {cart.totalItems === 1 ? 'Artikel' : 'Artikel'}
                </Badge>
                <span className="text-sm font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>in Ihrem Warenkorb</span>
              </div>
            </div>
            <Button
              variant="outline"
              asChild
              className="transition-all duration-300 group shadow-sm hover:shadow-md"
              style={{ 
                borderWidth: '2px', 
                borderColor: 'var(--primary-blue, #1a2a5e)',
                color: 'var(--primary-blue, #1a2a5e)'
              }}
            >
              <Link to="/shop">
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                {t('cart.continueShopping')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cart Items - Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Product Items */}
            {cart.items.filter((item) => item.productId).map((item, index) => (
              <div
                key={item._id}
                className="group"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
              >
                <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-white overflow-hidden group-hover:scale-[1.01]" style={{ borderRadius: 'var(--radius-md, 10px)' }}>
                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={item.productId.images?.[0] || '/placeholder-product.png'}
                          alt={item.productId.name || 'Product'}
                          className="relative w-24 h-24 object-cover rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-300"
                          style={{ borderRadius: 'var(--radius-md, 10px)' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-3">
                            <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{item.productId.name}</h3>
                            <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--gray-500, #636e85)' }}>
                              <Package className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{item.productId.brand}</span>
                            </p>
                            {!item.productId.inStock && (
                              <Badge variant="destructive" className="mt-2 text-xs">
                                {t('shop.outOfStock')}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUpdateQuantity(item.productId._id, 0)}
                            disabled={updating === item.productId._id}
                            className="hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 transition-all shadow-sm"
                              style={{ 
                                borderColor: 'var(--gray-300, #b0b8c9)'
                              }}
                              onClick={() => handleUpdateQuantity(item.productId._id, item.quantity - 1)}
                              disabled={updating === item.productId._id || item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-12 text-center font-bold text-base" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 transition-all shadow-sm"
                              style={{ 
                                borderColor: 'var(--gray-300, #b0b8c9)'
                              }}
                              onClick={() => handleUpdateQuantity(item.productId._id, item.quantity + 1)}
                              disabled={updating === item.productId._id || !item.productId.inStock}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-lg" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                              {(item.productId.price * item.quantity).toFixed(2)} €
                            </p>
                            <p className="text-xs font-medium" style={{ color: 'var(--gray-500, #636e85)' }}>
                              {item.productId.price.toFixed(2)} € pro Stück
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}

            {/* Repair Orders */}
            {cart.repairOrders && (() => {
              // Group repair orders by identical specifications
              const groupedOrders: { [key: string]: any[] } = {}
              cart.repairOrders.forEach((order: any) => {
                const addOnsKey = Array.isArray(order.addOns)
                  ? order.addOns.map((a: any) => (typeof a === 'object' && a?.name) ? a.name : String(a || '')).join(',')
                  : ''
                const servicesKey = Array.isArray(order.services)
                  ? order.services.map((s: any) => {
                      // Services can be populated objects or IDs
                      if (typeof s === 'object' && s !== null) {
                        return s._id ? String(s._id) : (s.name ? String(s.name) : String(s))
                      }
                      return String(s || '')
                    }).join(',')
                  : String(order.services || '')
                const key = `${String(order.deviceType || '')}-${String(order.deviceBrand || '')}-${String(order.deviceModel || '')}-${servicesKey}-${addOnsKey}-${String(order.totalCost || '')}`
                if (!groupedOrders[key]) {
                  groupedOrders[key] = []
                }
                groupedOrders[key].push(order)
              })

              let displayIndex = 0
              return Object.values(groupedOrders).map((ordersGroup, groupIndex) => {
                const order = ordersGroup[0] // Use first order as representative
                const quantity = ordersGroup.length
                const currentIndex = displayIndex
                displayIndex++

                return (
                  <div
                    key={`group-${groupIndex}`}
                    className="group"
                    style={{
                      animation: `fadeInUp 0.5s ease-out ${(cart.items.length + currentIndex) * 0.1}s both`
                    }}
                  >
                    <Card className="shadow-md hover:shadow-lg transition-all duration-300 bg-white overflow-hidden group-hover:scale-[1.01]" style={{ borderRadius: 'var(--radius-md, 10px)', borderLeft: '4px solid var(--primary-blue, #1a2a5e)' }}>
                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          {/* Device Icon/Image */}
                          <div className="relative flex-shrink-0">
                            <div className="relative w-24 h-24 flex items-center justify-center rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-300" style={{ backgroundColor: 'var(--primary-blue, #1a2a5e)' }}>
                              <Wrench className="h-12 w-12 text-white" />
                            </div>
                            {quantity > 1 && (
                              <div className="absolute -top-2 -right-2 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs shadow-lg" style={{ backgroundColor: 'var(--accent-yellow, #f5b800)', color: 'var(--primary-blue, #1a2a5e)' }}>
                                {quantity}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-bold text-base" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>Reparaturauftrag</h3>
                                  <Badge className="text-white border-0 shadow-sm text-xs py-0.5 px-2.5" style={{ backgroundColor: 'var(--primary-blue, #1a2a5e)' }}>
                                    <Smartphone className="h-3 w-3 mr-1" />
                                    Gerätereparatur
                                  </Badge>
                                  {quantity > 1 && (
                                    <Badge className="border-0 shadow-sm text-xs py-0.5 px-2" style={{ backgroundColor: 'var(--accent-yellow, #f5b800)', color: 'var(--primary-blue, #1a2a5e)' }}>
                                      <Package className="h-3 w-3 mr-1" />
                                      {t('cart.orderQuantityBadge', { quantity })}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium mb-2" style={{ color: 'var(--gray-700, #2d3748)' }}>
                                  {order.deviceType} • {order.deviceBrand} • {order.deviceModel}
                                </p>
                                <div className="flex gap-3 text-xs flex-wrap" style={{ color: 'var(--gray-600, #4a5568)' }}>
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success, #38a169)' }} />
                                    <span className="font-medium"><strong>{order.services?.length || 0}</strong> Service(s)</span>
                                  </div>
                                  {order.addOns && order.addOns.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Zap className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-yellow, #f5b800)' }} />
                                      <span className="font-medium"><strong>{order.addOns.length}</strong> Extra(s)</span>
                                    </div>
                                  )}
                                  {quantity > 1 && (
                                    <div className="flex items-center gap-1">
                                      <Package className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-yellow, #f5b800)' }} />
                                      <span className="font-bold" style={{ color: 'var(--accent-yellow-hover, #e5ab00)' }}>{quantity} Aufträge</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  // Remove all orders in this group
                                  ordersGroup.forEach(o => handleRemoveRepairOrder(o._id))
                                }}
                                disabled={ordersGroup.some(o => updating === o._id)}
                                className="hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--gray-200, #d8dce6)' }}>
                              <div className="text-xs flex items-center gap-1.5 font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>
                                <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--success, #38a169)' }} />
                                Professionelle Reparatur inklusive
                              </div>
                              <div className="text-right">
                                {quantity > 1 && (
                                  <p className="text-xs mb-0.5 font-medium" style={{ color: 'var(--gray-500, #636e85)' }}>
                                    {order.totalCost.toFixed(2)} € pro Stück × {quantity}
                                  </p>
                                )}
                                <p className="font-bold text-xl" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                                  {(order.totalCost * quantity).toFixed(2)} €
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })
            })()}
          </div>

          {/* Order Summary - Right Column (1/3 width) */}
          <div className="space-y-4">
            {/* Promo Code */}
            <Card className="shadow-md bg-white overflow-hidden hover:shadow-lg transition-shadow" style={{ borderRadius: 'var(--radius-md, 10px)', borderTop: '3px solid var(--success, #38a169)' }}>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="flex items-center gap-2 text-base font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                  <Tag className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--success, #38a169)' }} />
                  {t('cart.promoCode')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('cart.promoPlaceholder')}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="transition-colors text-sm h-10 rounded-lg"
                    style={{ borderWidth: '1px', borderColor: 'var(--gray-300, #b0b8c9)' }}
                  />
                  <Button
                    onClick={handleApplyPromoCode}
                    disabled={!promoCode.trim() || applyingPromo}
                    className="text-white shadow-md hover:shadow-lg transition-all text-sm px-5 rounded-lg font-semibold"
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
                      -{cart.discount?.toFixed(2)} €
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="shadow-lg bg-white overflow-hidden sticky top-20" style={{ borderRadius: 'var(--radius-md, 10px)', borderTop: '4px solid var(--primary-blue, #1a2a5e)' }}>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-lg font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{t('cart.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>{t('cart.subtotal')}</span>
                    <span className="font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{cart.subtotal.toFixed(2)} €</span>
                  </div>

                  {cart.discount && cart.discount > 0 && (
                    <div className="flex justify-between items-center p-2.5 rounded-lg" style={{ backgroundColor: '#f0fdf4', border: '1px solid var(--success, #38a169)', color: 'var(--success, #38a169)' }}>
                      <span className="flex items-center gap-1.5 font-medium">
                        <TrendingUp className="h-4 w-4 flex-shrink-0" />
                        {t('cart.discount')}
                      </span>
                      <span className="font-bold">-{cart.discount.toFixed(2)} €</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="font-medium" style={{ color: 'var(--gray-600, #4a5568)' }}>{t('cart.tax')}</span>
                    <span className="font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{cart.tax.toFixed(2)} €</span>
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-center" style={{ borderTop: '2px solid var(--gray-200, #d8dce6)' }}>
                  <span className="text-base font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>{t('cart.grandTotal')}</span>
                  <span className="text-2xl font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>
                    {cart.total.toFixed(2)} €
                  </span>
                </div>

                <Button
                  className="w-full py-6 text-base font-bold text-white shadow-xl hover:shadow-2xl transition-all duration-300 group rounded-lg"
                  style={{ backgroundColor: 'var(--accent-yellow, #f5b800)', color: 'var(--primary-blue, #1a2a5e)' }}
                  onClick={handleProceedToCheckout}
                  disabled={checkoutLoading}
                >
                  <CreditCard className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  {checkoutLoading ? t('common.loading') : t('cart.proceedToCheckout')}
                </Button>

                <p className="text-xs text-center flex items-center justify-center gap-1.5 font-medium" style={{ color: 'var(--gray-500, #636e85)' }}>
                  <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                  Sichere Zahlung durch Stripe
                </p>
              </CardContent>
            </Card>

            {/* Benefits Card */}
            <Card className="shadow-md bg-white overflow-hidden" style={{ borderRadius: 'var(--radius-md, 10px)' }}>
              <CardContent className="pt-5 space-y-3 px-5 pb-5">
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}>
                    <Shield className="h-4 w-4" style={{ color: 'var(--primary-blue, #1a2a5e)' }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>Kostenloser Versand</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600, #4a5568)' }}>Bei Bestellungen über 50 €</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}>
                    <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success, #38a169)' }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>Qualitätsgarantie</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600, #4a5568)' }}>90 Tage Garantie auf alle Reparaturen</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 rounded-lg flex-shrink-0 shadow-sm" style={{ backgroundColor: 'var(--gray-100, #eceef3)' }}>
                    <Zap className="h-4 w-4" style={{ color: 'var(--accent-yellow, #f5b800)' }} />
                  </div>
                  <div>
                    <p className="font-bold" style={{ color: 'var(--primary-blue, #1a2a5e)' }}>Schnelle Bearbeitung</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--gray-600, #4a5568)' }}>Die meisten Reparaturen in 24-48 Stunden</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        onSuccess={handleCheckoutSuccess}
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
