import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Home,
  Package,
  Users,
  Clock,
  MessageSquare,
  BookOpen,
  User,
  Wrench,
  Calendar,
  BarChart3
} from "lucide-react"

const staffNavigation = [
  {
    name: "Staff Dashboard",
    href: "/staff",
    icon: Home,
    current: false
  },
  {
    name: "Assigned Orders",
    href: "/staff/orders",
    icon: Package,
    current: false
  },
  {
    name: "Time Tracking",
    href: "/staff/time-tracking",
    icon: Clock,
    current: false
  },
  {
    name: "Schedule",
    href: "/staff/schedule",
    icon: Calendar,
    current: false
  },
  {
    name: "Team Chat",
    href: "/staff/chat",
    icon: MessageSquare,
    current: false
  },
  {
    name: "Knowledge Base",
    href: "/staff/knowledge-base",
    icon: BookOpen,
    current: false
  },
  {
    name: "Performance",
    href: "/staff/performance",
    icon: BarChart3,
    current: false
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    current: false
  }
]

export function StaffSidebar() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <nav className="space-y-1">
          {staffNavigation.map((item) => {
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
          Staff Portal
        </div>
      </div>
    </div>
  )
}