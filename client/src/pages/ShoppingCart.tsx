import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/useToast"
import { getCart, updateCartItem, removeFromCart, applyPromoCode, Cart, CartItem } from "@/api/shop"
import {
  ShoppingCart as ShoppingCartIcon,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowLeft,
  CreditCard
} from "lucide-react"

export function ShoppingCartPage() {
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
          title: "Error",
          description: "Failed to load cart",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchCart()
  }, [toast])

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return

    try {
      setUpdating(itemId)
      console.log("Updating cart item:", itemId, newQuantity)

      if (newQuantity === 0) {
        await removeFromCart(itemId)
        toast({
          title: "Item removed",
          description: "Item has been removed from your cart"
        })
      } else {
        await updateCartItem(itemId, newQuantity)
        toast({
          title: "Cart updated",
          description: "Item quantity has been updated"
        })
      }

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
    } catch (error: any) {
      console.error("Error updating cart:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update cart",
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
      await applyPromoCode(promoCode)

      toast({
        title: "Promo code applied!",
        description: "Your discount has been applied to the cart"
      })

      // Refresh cart
      const response = await getCart()
      setCart((response as any).cart)
      setPromoCode("")
    } catch (error: any) {
      console.error("Error applying promo code:", error)
      toast({
        title: "Invalid promo code",
        description: error.message || "The promo code you entered is not valid",
        variant: "destructive"
      })
    } finally {
      setApplyingPromo(false)
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

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="text-center py-12">
            <ShoppingCartIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-4">
              Add some products to get started
            </p>
            <Button asChild>
              <Link to="/shop">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Continue Shopping
              </Link>
            </Button>
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
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <p className="text-muted-foreground">
            {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/shop">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continue Shopping
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <Card key={item._id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{item.product.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.product.brand}
                        </p>
                        {!item.product.inStock && (
                          <Badge variant="destructive" className="mt-1">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdateQuantity(item._id, 0)}
                        disabled={updating === item._id}
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
                          onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                          disabled={updating === item._id || item.quantity <= 1}
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
                          onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                          disabled={updating === item._id || !item.product.inStock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${item.product.price.toFixed(2)} each
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
                Promo Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
                <Button
                  onClick={handleApplyPromoCode}
                  disabled={!promoCode.trim() || applyingPromo}
                >
                  {applyingPromo ? "Applying..." : "Apply"}
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
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${cart.subtotal.toFixed(2)}</span>
              </div>
              
              {cart.discount && cart.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${cart.discount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${cart.tax.toFixed(2)}</span>
              </div>
              
              <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${cart.total.toFixed(2)}</span>
              </div>

              <Button className="w-full" size="lg">
                <CreditCard className="h-4 w-4 mr-2" />
                Proceed to Checkout
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