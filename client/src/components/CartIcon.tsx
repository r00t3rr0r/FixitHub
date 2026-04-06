import React, { useEffect, useState } from 'react';
import { ShoppingCart, Package, Wrench, ArrowRight } from 'lucide-react';
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

  return (
    <>
      <style>{`
        @keyframes bounce-custom {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          25% {
            transform: translateY(-8px) scale(1.05);
          }
          50% {
            transform: translateY(-4px) scale(1.02);
          }
          75% {
            transform: translateY(-2px) scale(1.01);
          }
        }

        .animate-bounce-custom {
          animation: bounce-custom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .cart-item-enter {
          animation: fadeIn 0.3s ease-out;
        }

        /* McRepair Homepage Matching Styles */
        .cart-dropdown-content {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .cart-item-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 8px;
          background: #f5f6f8;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .cart-item-image:hover {
          transform: scale(1.05);
        }

        .cart-device-image {
          width: 60px;
          height: 60px;
          object-fit: contain;
          border-radius: 8px;
          background: linear-gradient(135deg, #f5f6f8 0%, #eceef3 100%);
          flex-shrink: 0;
          padding: 8px;
          transition: transform 0.2s ease;
        }

        .cart-device-image:hover {
          transform: scale(1.05);
        }

        .cart-item-placeholder {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          background: linear-gradient(135deg, #f5f6f8 0%, #eceef3 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .cart-item-image,
          .cart-device-image,
          .cart-item-placeholder {
            width: 44px;
            height: 44px;
          }
          .cart-device-image {
            padding: 5px;
          }
        }

        .cart-item-card {
          transition: all 0.2s ease;
        }

        .cart-item-card:hover {
          transform: translateY(-2px);
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
                className={`absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] text-xs font-bold border-2 border-white shadow-md ${
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
          className="w-[min(420px,calc(100vw-12px))] p-0 shadow-xl border border-[#d8dce6] cart-dropdown-content" 
          align="end"
          sideOffset={12}
        >
          <div className="bg-white">
            {/* Header with McRepair styling */}
            <div className="px-3 py-3 sm:px-5 sm:py-4 border-b border-[#eceef3] bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2 text-white">
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-[#f5b800] flex-shrink-0" />
                  Warenkorb
                </h3>
                {itemCount > 0 && (
                  <Badge className="bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] font-semibold text-xs px-2 py-0.5 flex-shrink-0">
                    {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Cart Content */}
            <div className="max-h-[450px] overflow-y-auto">
              {!cart || itemCount === 0 ? (
                <div className="p-6 sm:p-10 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#f5f6f8] mb-3 sm:mb-4">
                    <ShoppingCart className="h-7 w-7 sm:h-10 sm:w-10 text-[#b0b8c9]" />
                  </div>
                  <p className="font-semibold text-[#2d3748] text-sm sm:text-base mb-1">Ihr Warenkorb ist leer</p>
                  <p className="text-xs sm:text-sm text-[#636e85]">Entdecken Sie unsere Produkte und Reparaturservices</p>
                </div>
              ) : (
                <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  {/* Repair Orders */}
                  {cart.repairOrders && cart.repairOrders.length > 0 && (
                    <div className="space-y-3">
                      {cart.repairOrders.map((order, index) => {
                        const deviceImage = getRepairOrderDeviceImage(order);
                        
                        return (
                          <div 
                            key={order._id || index}
                            className="cart-item-card cart-item-enter bg-white rounded-lg p-2 sm:p-3 border border-[#d8dce6] hover:border-[#1a2a5e] hover:shadow-md"
                          >
                            <div className="flex items-start gap-2 sm:gap-3">
                              {/* Device Image or Icon */}
                              <CartPreviewImage
                                src={deviceImage}
                                alt={`${order.deviceBrand} ${order.deviceModel}`}
                                imageClassName="cart-device-image"
                                icon={Wrench}
                                iconClassName="h-6 w-6 text-[#1a2a5e]"
                              />

                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-xs sm:text-sm text-[#1a2a5e] truncate leading-tight">
                                  {order.deviceBrand} {order.deviceModel}
                                </h4>
                                <div className="mt-0.5 sm:mt-1">
                                  <p className="text-[11px] sm:text-xs text-[#636e85]">
                                    {order.services.length} Reparatur{order.services.length !== 1 ? 'en' : ''}
                                    {order.addOns && order.addOns.length > 0 && ` + ${order.addOns.length} Extra${order.addOns.length !== 1 ? 's' : ''}`}
                                  </p>
                                </div>
                                <p className="font-bold text-[#1a2a5e] text-sm sm:text-base mt-1">
                                  {order.totalCost.toFixed(2)} €
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Shop Products */}
                  {cart.items && cart.items.length > 0 && (
                    <div className="space-y-3">
                      {cart.items.map((item) => {
                        const product = typeof item.productId === 'object' ? item.productId : null;
                        if (!product) return null;

                        // Get product image
                        const productImage = product.images && product.images.length > 0 ? product.images[0] : null;

                        return (
                          <div 
                            key={item._id}
                            className="cart-item-card cart-item-enter bg-white rounded-lg p-2 sm:p-3 border border-[#d8dce6] hover:border-[#f5b800] hover:shadow-md"
                          >
                            <div className="flex items-start gap-2 sm:gap-3">
                              {/* Product Image or Icon */}
                              <CartPreviewImage
                                src={productImage}
                                alt={product.name}
                                imageClassName="cart-item-image"
                                icon={Package}
                                iconClassName="h-6 w-6 text-[#636e85]"
                              />

                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-xs sm:text-sm text-[#1a2a5e] leading-tight line-clamp-2">
                                  {product.name}
                                </h4>
                                <p className="text-[11px] sm:text-xs text-[#636e85] mt-0.5 sm:mt-1">
                                  Menge: {item.quantity} × {product.price.toFixed(2)} €
                                </p>
                                <p className="font-bold text-[#1a2a5e] text-sm sm:text-base mt-1">
                                  {(product.price * item.quantity).toFixed(2)} €
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {cart && itemCount > 0 && (
              <div className="px-3 py-3 sm:px-5 sm:py-4 border-t border-[#eceef3] bg-[#f8f9fc] space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#2d3748] text-sm">Gesamt:</span>
                  <span className="font-bold text-lg sm:text-2xl text-[#1a2a5e]">
                    {cart.total.toFixed(2)} €
                  </span>
                </div>
                <Button 
                  asChild 
                  className="w-full bg-[#f5b800] hover:bg-[#e5ab00] text-[#1a2a5e] font-bold shadow-md hover:shadow-lg transition-all duration-200 h-9 sm:h-11 text-xs sm:text-sm"
                >
                  <Link to="/cart" className="flex items-center justify-center gap-2">
                    Zum Warenkorb
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
