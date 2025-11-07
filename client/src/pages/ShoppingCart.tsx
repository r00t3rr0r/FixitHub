import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getCart, updateCartItem, removeFromCart, removeRepairOrderFromCart, applyPromoCode, Cart, CartItem } from "@/api/shop"
import {
  ShoppingCart as ShoppingCartIcon,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowLeft,
  CreditCard,
  Wrench,
  Smartphone
} from "lucide-react"
import { useTranslation } from 'react-i18next'

export function ShoppingCartPage() {
  const { t } = useTranslation()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState("")
  const [applyingPromo, setApplyingPromo] = useState(false)
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-20 h-20 bg-muted rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasItems = cart && (cart.items.length > 0 || (cart.repairOrders && cart.repairOrders.length > 0))

  if (!cart || !hasItems) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <ShoppingCartIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">{t('cart.emptyCart')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('cart.emptyCartDesc')}
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline">
                <Link to="/shop">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('cart.continueShopping')}
                </Link>
              </Button>
              <Button asChild>
                <Link to="/new-order">
                  <Wrench className="h-4 w-4 mr-2" />
                  {t('orders.newOrder')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('cart.title')}</h1>
          <p className="text-muted-foreground">
            {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/shop">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('cart.continueShopping')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Product Items */}
          {cart.items.map((item) => (
            <Card key={item._id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <img
                    src={item.productId.images[0]}
                    alt={item.productId.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{item.productId.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.productId.brand}
                        </p>
                        {!item.productId.inStock && (
                          <Badge variant="destructive" className="mt-1">
                            {t('shop.outOfStock')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdateQuantity(item.productId._id, 0)}
                        disabled={updating === item.productId._id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.productId._id, item.quantity - 1)}
                          disabled={updating === item.productId._id || item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantity(item.productId._id, item.quantity + 1)}
                          disabled={updating === item.productId._id || !item.productId.inStock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold">
                          ${(item.productId.price * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${item.productId.price.toFixed(2)} each
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Repair Orders */}
          {cart.repairOrders && cart.repairOrders.map((order: any) => (
            <Card key={order._id} className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-20 h-20 flex items-center justify-center bg-primary/10 rounded-lg">
                    <Wrench className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">Repair Order</h3>
                          <Badge variant="secondary">
                            <Smartphone className="h-3 w-3 mr-1" />
                            Device Repair
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.deviceType} • {order.deviceBrand} • {order.deviceModel}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p><strong>Services:</strong> {order.services?.length || 0} service(s)</p>
                          {order.addOns && order.addOns.length > 0 && (
                            <p><strong>Add-ons:</strong> {order.addOns.length} add-on(s)</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRepairOrder(order._id)}
                        disabled={updating === order._id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Repair services included
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          ${order.totalCost.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          {/* Promo Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t('cart.promoCode')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder={t('cart.promoPlaceholder')}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
                <Button
                  onClick={handleApplyPromoCode}
                  disabled={!promoCode.trim() || applyingPromo}
                >
                  {applyingPromo ? t('common.loading') : t('cart.apply')}
                </Button>
              </div>
              {cart.promoCode && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">
                    Code "{cart.promoCode}" applied
                  </span>
                  <span className="text-green-600 font-medium">
                    -${cart.discount?.toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>{t('cart.orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>{t('cart.subtotal')}</span>
                <span>${cart.subtotal.toFixed(2)}</span>
              </div>

              {cart.discount && cart.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{t('cart.discount')}</span>
                  <span>-${cart.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>{t('cart.tax')}</span>
                <span>${cart.tax.toFixed(2)}</span>
              </div>

              <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                <span>{t('cart.grandTotal')}</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>

              <Button className="w-full" size="lg">
                <CreditCard className="h-4 w-4 mr-2" />
                {t('cart.proceedToCheckout')}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Secure checkout powered by Stripe
              </p>
            </CardContent>
          </Card>

          {/* Shipping Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Free shipping</span>
                  <span className="text-green-600">$0.00</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  On orders over $50
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}