import React, { useEffect, useState } from 'react';
import { ShoppingCart, Package, Wrench, ArrowRight, ChevronRight, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCart, Cart } from '@/api/shop';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const getRepairOrderDeviceImage = (order: Cart['repairOrders'] extends Array<infer T> ? T : never) => {
  if (order?.deviceImage) {
    return order.deviceImage;
  }

  return Array.isArray(order?.photos) && order.photos.length > 0 ? order.photos[0] : null;
};

type CartPreviewImageProps = {
  src: string | null;
  alt: string;
  imageClassName: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
};

function CartPreviewImage({
  src,
  alt,
  imageClassName,
  icon: Icon,
  iconClassName,
}: CartPreviewImageProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [src]);

  if (!src || hasImageError) {
    return (
      <div className="cart-item-placeholder" aria-hidden="true">
        <Icon className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={imageClassName}
      loading="lazy"
      onError={() => setHasImageError(true)}
    />
  );
}

export function CartIcon() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [shouldBounce, setShouldBounce] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        setIsLoading(true);
        console.log('CartIcon: Fetching cart data...');
        const response = await getCart();
        const cartData = (response as any).cart;

        if (cartData) {
          setCart(cartData);
          const newItemCount = cartData.totalItems || 0;

          // Trigger bounce animation when item count increases
          if (newItemCount > itemCount) {
            setShouldBounce(true);
            setTimeout(() => setShouldBounce(false), 500);
          }

          setItemCount(newItemCount);
          console.log('CartIcon: Cart loaded with', newItemCount, 'items');
        }
      } catch (error) {
        console.error('CartIcon: Error fetching cart:', error);
        // Silently fail - don't show error to user in nav
      } finally {
        setIsLoading(false);
      }
    };

    fetchCart();

    // Poll cart every 30 seconds to keep count updated
    const interval = setInterval(fetchCart, 30000);

    return () => clearInterval(interval);
  }, [itemCount]);

  // Listen for cart update events (both authenticated and guest)
  useEffect(() => {
    const handleCartUpdate = () => {
      getCart()
        .then((response) => {
          const cartData = (response as any).cart;
          if (cartData) {
            const newItemCount = cartData.totalItems || 0;

            if (newItemCount > itemCount) {
              setShouldBounce(true);
              setTimeout(() => setShouldBounce(false), 500);
            }

            setCart(cartData);
            setItemCount(newItemCount);
          }
        })
        .catch((error) => {
          console.error('CartIcon: Error fetching cart on update event:', error);
        });
    };

    // Listen for both authenticated and guest cart updates
    window.addEventListener('cartUpdated', handleCartUpdate);
    window.addEventListener('guestCartUpdate', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      window.removeEventListener('guestCartUpdate', handleCartUpdate);
    };
  }, [itemCount]);

  const hasRepairOrders = cart && cart.repairOrders && cart.repairOrders.length > 0;
  const hasProducts = cart && cart.items && cart.items.length > 0;
  const hasBothTypes = hasRepairOrders && hasProducts;

  return (
    <>
      <style>{`
        @keyframes bounce-custom {
          0%, 100% { transform: translateY(0) scale(1); }
          25%       { transform: translateY(-8px) scale(1.05); }
          50%       { transform: translateY(-4px) scale(1.02); }
          75%       { transform: translateY(-2px) scale(1.01); }
        }
        .animate-bounce-custom { animation: bounce-custom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }

        @keyframes cartItemIn {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .cart-item-enter { animation: cartItemIn 0.25s ease-out both; }

        .cart-dropdown-content {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Scrollable area */
        .cart-scroll::-webkit-scrollbar { width: 4px; }
        .cart-scroll::-webkit-scrollbar-track { background: transparent; }
        .cart-scroll::-webkit-scrollbar-thumb { background: #d8dce6; border-radius: 4px; }
        .cart-scroll::-webkit-scrollbar-thumb:hover { background: #b0b8c9; }

        /* Product image */
        .cart-img {
          width: 56px; height: 56px;
          object-fit: cover;
          border-radius: 10px;
          flex-shrink: 0;
          background: #f0f2f7;
          transition: transform 0.2s ease;
        }
        .cart-img-device {
          width: 56px; height: 56px;
          object-fit: contain;
          border-radius: 10px;
          flex-shrink: 0;
          padding: 8px;
          background: linear-gradient(135deg, #eef1f8 0%, #e4e8f4 100%);
          transition: transform 0.2s ease;
        }
        .cart-img-placeholder {
          width: 56px; height: 56px;
          border-radius: 10px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #eef1f8 0%, #e4e8f4 100%);
        }
        .cart-row:hover .cart-img,
        .cart-row:hover .cart-img-device { transform: scale(1.06); }

        /* Row hover */
        .cart-row {
          transition: background 0.15s ease;
          border-radius: 10px;
        }
        .cart-row:hover { background: #f5f7fc; }

        /* Quantity pill */
        .qty-pill {
          display: inline-flex; align-items: center; gap: 3px;
          background: #eef1f8; color: #1a2a5e;
          font-size: 11px; font-weight: 600;
          padding: 2px 7px; border-radius: 20px;
          flex-shrink: 0;
        }
      `}</style>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative group">
            <div
              className={`transition-all duration-300 ${
                shouldBounce ? 'animate-bounce-custom' : ''
              } group-hover:scale-110`}
            >
              <ShoppingCart className="h-5 w-5 text-white group-hover:text-[#f5b800] transition-colors duration-200" />
            </div>
            {itemCount > 0 && (
              <Badge
                className={`absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 bg-[#f5b800] hover:bg-[#f5b800] text-[#1a2a5e] text-[10px] font-bold border-2 border-white shadow-md ${
                  shouldBounce ? 'animate-pulse' : ''
                }`}
              >
                {itemCount > 99 ? '99+' : itemCount}
              </Badge>
            )}
            <span className="sr-only">Warenkorb ({itemCount} Artikel)</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[min(400px,calc(100vw-16px))] p-0 shadow-2xl border border-[#dce1ed] rounded-2xl overflow-hidden cart-dropdown-content"
          align="end"
          sideOffset={14}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1a2a5e] to-[#243578]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#f5b800]/20">
                <ShoppingCart className="h-4 w-4 text-[#f5b800]" />
              </div>
              <span className="font-bold text-sm text-white tracking-wide">Warenkorb</span>
            </div>
            {itemCount > 0 && (
              <span className="text-xs font-semibold bg-white/15 text-white px-2.5 py-0.5 rounded-full">
                {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
              </span>
            )}
          </div>

          {/* ── Content ── */}
          {!cart || itemCount === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center bg-white">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#eef1f8] mb-4">
                <ShoppingCart className="h-8 w-8 text-[#b0b8c9]" />
              </div>
              <p className="font-semibold text-[#1a2a5e] text-sm mb-1">Ihr Warenkorb ist leer</p>
              <p className="text-xs text-[#8491a8] mb-5 max-w-[200px]">
                Produkte und Reparaturservices entdecken
              </p>
              <Button
                asChild
                size="sm"
                className="bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] font-semibold text-xs px-5 rounded-lg shadow-sm"
              >
                <Link to="/shop">
                  Jetzt entdecken
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="bg-white">
              {/* Scrollable item list */}
              <div className="cart-scroll overflow-y-auto max-h-[340px] px-3 py-2.5 space-y-1">

                {/* ── Repair Orders section ── */}
                {hasRepairOrders && (
                  <>
                    {hasBothTypes && (
                      <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
                        <Wrench className="h-3 w-3 text-[#1a2a5e]/50" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8491a8]">
                          Reparaturen
                        </span>
                      </div>
                    )}
                    {cart!.repairOrders!.map((order, index) => {
                      const deviceImage = getRepairOrderDeviceImage(order);
                      return (
                        <div
                          key={order._id || index}
                          className="cart-row cart-item-enter flex items-center gap-3 px-2 py-2.5"
                        >
                          <CartPreviewImage
                            src={deviceImage}
                            alt={`${order.deviceBrand} ${order.deviceModel}`}
                            imageClassName="cart-img-device"
                            icon={Wrench}
                            iconClassName="h-5 w-5 text-[#1a2a5e]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#1a2a5e] truncate leading-snug">
                              {[order.deviceBrand, order.deviceModel].filter(Boolean).join(' ') || order.deviceType || 'Gerät'}
                            </p>
                            <p className="text-[10.5px] text-[#8491a8] mt-0.5 leading-snug">
                              {order.deviceType}
                              {order.services.length > 0 && (
                                <span className="mx-1">·</span>
                              )}
                              {order.services.length} Reparatur{order.services.length !== 1 ? 'en' : ''}
                              {order.addOns && order.addOns.length > 0 && (
                                <span className="ml-1 text-[#f5b800]">+{order.addOns.length} Extra</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-[#1a2a5e]">
                              {order.totalCost.toFixed(2)} €
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* ── Products section ── */}
                {hasProducts && (
                  <>
                    {hasBothTypes && (
                      <div className="flex items-center gap-2 px-1 pt-2.5 pb-0.5">
                        <Package className="h-3 w-3 text-[#1a2a5e]/50" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#8491a8]">
                          Produkte
                        </span>
                      </div>
                    )}
                    {cart!.items.map((item) => {
                      const product = typeof item.productId === 'object' ? item.productId : null;
                      if (!product) return null;
                      const productImage = product.images && product.images.length > 0 ? product.images[0] : null;
                      const lineTotal = (product.price * item.quantity).toFixed(2);
                      return (
                        <div
                          key={item._id}
                          className="cart-row cart-item-enter flex items-center gap-3 px-2 py-2.5"
                        >
                          <CartPreviewImage
                            src={productImage}
                            alt={product.name}
                            imageClassName="cart-img"
                            icon={Package}
                            iconClassName="h-5 w-5 text-[#8491a8]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#1a2a5e] line-clamp-2 leading-snug">
                              {product.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="qty-pill">
                                {item.quantity}×
                              </span>
                              <span className="text-[10.5px] text-[#8491a8]">
                                {product.price.toFixed(2)} €
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-[#1a2a5e]">{lineTotal} €</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* ── Footer / Summary ── */}
              <div className="border-t border-[#edf0f7] px-4 pt-3 pb-4 bg-[#f8f9fc] space-y-3">
                {/* Totals */}
                <div className="space-y-1">
                  {cart!.discount && cart!.discount > 0 ? (
                    <div className="flex items-center justify-between text-xs text-[#8491a8]">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Rabatt
                      </span>
                      <span className="font-medium text-green-600">−{cart!.discount.toFixed(2)} €</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#8491a8]">inkl. MwSt.</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-medium text-[#8491a8]">Gesamt</span>
                      <span className="text-xl font-extrabold text-[#1a2a5e] leading-none">
                        {cart!.total.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <Button
                  asChild
                  className="w-full h-10 bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] font-bold text-sm rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group"
                >
                  <Link to="/checkout" className="flex items-center justify-center gap-2">
                    Zur Kasse
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>

                {/* Secondary link */}
                <Link
                  to="/cart"
                  className="flex items-center justify-center gap-1 text-xs font-medium text-[#1a2a5e]/60 hover:text-[#1a2a5e] transition-colors duration-150"
                >
                  Warenkorb ansehen
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
