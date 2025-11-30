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

      // Navigate to orders page to show created orders
      navigate('/orders')
    } catch (error: any) {
      console.error("Error during checkout:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('checkout.checkoutFailed'),
        variant: "destructive"
      })
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

      // Navigate to orders page to show created orders
      navigate('/orders')
    } catch (error: any) {
      console.error("Error during checkout after authentication:", error)
      toast({
        title: t('common.error'),
        description: error.message || t('checkout.checkoutFailed'),
        variant: "destructive"
      })
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50/30">
        <div className="container mx-auto px-4 py-12">
          <Card className="animate-pulse border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-6 p-6 rounded-xl bg-gradient-to-r from-gray-100 to-gray-50">
                    <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-100 rounded-xl"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-3/4"></div>
                      <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-1/2"></div>
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50/30 flex items-center justify-center py-12">
        <div className="container mx-auto px-4">
          <Card className="max-w-2xl mx-auto border-0 shadow-2xl bg-white/90 backdrop-blur-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
            <CardContent className="text-center py-16 px-8">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-yellow-50 to-yellow-100 p-8 rounded-full">
                  <ShoppingCartIcon className="h-20 w-20 text-yellow-600" />
                </div>
              </div>
              <h3 className="text-3xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {t('cart.emptyCart')}
              </h3>
              <p className="text-gray-600 mb-8 text-lg max-w-md mx-auto">
                {t('cart.emptyCartDesc')}
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-2 border-gray-300 hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-300 group"
                >
                  <Link to="/shop">
                    <Package className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                    {t('cart.continueShopping')}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <Link to="/new-order">
                    <Wrench className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header with gradient background */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-yellow-500/5 to-transparent rounded-2xl blur-3xl"></div>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                {t('cart.title')}
              </h1>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-800 border-yellow-300 px-3 py-1">
                  <ShoppingCartIcon className="h-3 w-3 mr-1" />
                  {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'}
                </Badge>
                <span className="text-sm text-gray-500">in your cart</span>
              </div>
            </div>
            <Button
              variant="outline"
              asChild
              className="border-2 border-gray-300 hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-300 group shadow-sm hover:shadow-md"
            >
              <Link to="/shop">
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                {t('cart.continueShopping')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items - Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Product Items */}
            {cart.items.map((item, index) => (
              <div
                key={item._id}
                className="group"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
                }}
              >
                <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white/90 backdrop-blur-sm overflow-hidden group-hover:scale-[1.02]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <img
                          src={item.productId.images[0]}
                          alt={item.productId.name}
                          className="relative w-24 h-24 object-cover rounded-xl shadow-md group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <h3 className="font-semibold text-lg text-gray-900 truncate">{item.productId.name}</h3>
                            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              <Package className="h-3 w-3" />
                              {item.productId.brand}
                            </p>
                            {!item.productId.inStock && (
                              <Badge variant="destructive" className="mt-2 animate-pulse">
                                {t('shop.outOfStock')}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUpdateQuantity(item.productId._id, 0)}
                            disabled={updating === item.productId._id}
                            className="hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-2 hover:border-yellow-400 hover:bg-yellow-50 transition-all"
                              onClick={() => handleUpdateQuantity(item.productId._id, item.quantity - 1)}
                              disabled={updating === item.productId._id || item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-12 text-center font-semibold text-gray-900">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-2 hover:border-yellow-400 hover:bg-yellow-50 transition-all"
                              onClick={() => handleUpdateQuantity(item.productId._id, item.quantity + 1)}
                              disabled={updating === item.productId._id || !item.productId.inStock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-xl text-gray-900">
                              ${(item.productId.price * item.quantity).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">
                              ${item.productId.price.toFixed(2)} each
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
            {cart.repairOrders && cart.repairOrders.map((order: any, index: number) => (
              <div
                key={order._id}
                className="group"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${(cart.items.length + index) * 0.1}s both`
                }}
              >
                <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-yellow-50/50 via-white to-white backdrop-blur-sm overflow-hidden group-hover:scale-[1.02]">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600"></div>
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 to-yellow-500/20 rounded-xl blur-xl animate-pulse"></div>
                        <div className="relative w-24 h-24 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300">
                          <Wrench className="h-12 w-12 text-white drop-shadow-md" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-bold text-lg text-gray-900">Repair Order</h3>
                              <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 border-0 shadow-sm">
                                <Smartphone className="h-3 w-3 mr-1" />
                                Device Repair
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">
                              {order.deviceType} • {order.deviceBrand} • {order.deviceModel}
                            </p>
                            <div className="mt-3 flex gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-yellow-600" />
                                <span><strong>{order.services?.length || 0}</strong> service(s)</span>
                              </div>
                              {order.addOns && order.addOns.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Zap className="h-3 w-3 text-yellow-600" />
                                  <span><strong>{order.addOns.length}</strong> add-on(s)</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRepairOrder(order._id)}
                            disabled={updating === order._id}
                            className="hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-yellow-200">
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Shield className="h-3 w-3 text-yellow-600" />
                            Professional repair services included
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-2xl bg-gradient-to-r from-yellow-600 to-yellow-700 bg-clip-text text-transparent">
                              ${order.totalCost.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Order Summary - Right Column (1/3 width) */}
          <div className="space-y-5">
            {/* Promo Code */}
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-shadow">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-400"></div>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="h-5 w-5 text-green-600" />
                  {t('cart.promoCode')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={t('cart.promoPlaceholder')}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="border-2 focus:border-green-400 transition-colors"
                  />
                  <Button
                    onClick={handleApplyPromoCode}
                    disabled={!promoCode.trim() || applyingPromo}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all"
                  >
                    {applyingPromo ? t('common.loading') : t('cart.apply')}
                  </Button>
                </div>
                {cart.promoCode && (
                  <div className="flex items-center justify-between text-sm bg-green-50 p-3 rounded-lg border border-green-200 animate-fadeIn">
                    <span className="text-green-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Code "{cart.promoCode}" applied
                    </span>
                    <span className="text-green-700 font-bold">
                      -${cart.discount?.toFixed(2)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-yellow-50/30 backdrop-blur-sm overflow-hidden sticky top-20">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400"></div>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{t('cart.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{t('cart.subtotal')}</span>
                    <span className="font-semibold text-gray-900">${cart.subtotal.toFixed(2)}</span>
                  </div>

                  {cart.discount && cart.discount > 0 && (
                    <div className="flex justify-between items-center text-green-600 bg-green-50 p-2 rounded-lg">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {t('cart.discount')}
                      </span>
                      <span className="font-bold">-${cart.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">{t('cart.tax')}</span>
                    <span className="font-semibold text-gray-900">${cart.tax.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t-2 border-yellow-200 pt-4 flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">{t('cart.grandTotal')}</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-700 bg-clip-text text-transparent">
                    ${cart.total.toFixed(2)}
                  </span>
                </div>

                <Button
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 shadow-lg hover:shadow-xl transition-all duration-300 group"
                  onClick={handleProceedToCheckout}
                  disabled={checkoutLoading}
                >
                  <CreditCard className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  {checkoutLoading ? t('common.loading') : t('cart.proceedToCheckout')}
                </Button>

                <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                  <Shield className="h-3 w-3" />
                  Secure checkout powered by Stripe
                </p>
              </CardContent>
            </Card>

            {/* Benefits Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white backdrop-blur-sm overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400"></div>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Free shipping</p>
                    <p className="text-xs text-gray-500">On orders over $50</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Quality guarantee</p>
                    <p className="text-xs text-gray-500">90-day warranty on all repairs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Zap className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Fast turnaround</p>
                    <p className="text-xs text-gray-500">Most repairs done in 24-48 hours</p>
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
