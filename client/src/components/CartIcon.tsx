import React, { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCart, Cart } from '@/api/shop';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function CartIcon() {
  const { isAuthenticated } = useAuth();
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
      `}</style>

      <Button variant="ghost" size="icon" asChild className="relative group">
        <Link to="/cart" className="relative">
          <div
            className={`transition-all duration-300 ${
              shouldBounce ? 'animate-bounce-custom' : ''
            } group-hover:scale-110`}
          >
            <ShoppingCart className="h-5 w-5 text-gray-700 group-hover:text-yellow-600 transition-colors duration-200" />
          </div>

          {itemCount > 0 && (
            <Badge
              className={`absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold border-2 border-white shadow-md ${
                shouldBounce ? 'animate-pulse' : ''
              }`}
            >
              {itemCount > 99 ? '99+' : itemCount}
            </Badge>
          )}

          {/* Subtle hover effect ring */}
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ring-2 ring-yellow-400 ring-offset-2" />

          <span className="sr-only">Shopping Cart ({itemCount} items)</span>
        </Link>
      </Button>
    </>
  );
}
