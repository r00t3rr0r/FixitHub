import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Home,
  Plus,
  Package,
  ShoppingCart,
  User,
  BookOpen
} from "lucide-react"

const customerNavigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: Home,
    current: false
  },
  {
    name: "New Order",
    href: "/new-order",
    icon: Plus,
    current: false
  },
  {
    name: "My Orders",
    href: "/orders",
    icon: Package,
    current: false
  },
  {
    name: "Web Shop",
    href: "/shop",
    icon: ShoppingCart,
    current: false
  },
  {
    name: "Shopping Cart",
    href: "/cart",
    icon: ShoppingCart,
    current: false
  },
  {
    name: "Blog",
    href: "/blog",
    icon: BookOpen,
    current: false
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    current: false
  }
]

export function CustomerSidebar() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <nav className="space-y-1">
          {customerNavigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-accent hover:text-accent-foreground",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 transition-colors",
                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          Device Repair Pro
          <br />
          Customer Portal
        </div>
      </div>
    </div>
  )
}