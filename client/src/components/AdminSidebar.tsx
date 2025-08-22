import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  Package,
  ShoppingCart,
  Settings,
  BarChart3,
  Database,
  Shield,
  FileText,
  Globe,
  ChevronDown,
  ChevronRight,
  Wrench,
  Stethoscope,
  Cog,
  CheckSquare,
  UserCog,
  DollarSign
} from "lucide-react"
import { Button } from "./ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"

const adminNavigation = [
  {
    name: "Admin Dashboard",
    href: "/admin",
    icon: Home,
    current: false
  },
  {
    name: "User Management",
    href: "/admin/users",
    icon: Users,
    current: false
  },
  {
    name: "Staff Management",
    href: "/admin/staff",
    icon: UserCog,
    current: false
  },
  {
    name: "Order Management",
    href: "/admin/orders",
    icon: Package,
    current: false
  },
  {
    name: "Web Shop Management",
    href: "/admin/shop",
    icon: ShoppingCart,
    current: false
  },
  {
    name: "Financial Management",
    href: "/admin/financial",
    icon: DollarSign,
    current: false
  },
  {
    name: "Analytics & Reports",
    href: "/admin/analytics",
    icon: BarChart3,
    current: false
  }
]

const repairProcessManagement = [
  {
    name: "Workflow Management",
    href: "/admin/workflow",
    icon: Wrench,
    current: false
  },
  {
    name: "Diagnostic Tools",
    href: "/admin/diagnostics",
    icon: Stethoscope,
    current: false
  },
  {
    name: "Parts Management",
    href: "/admin/parts",
    icon: Cog,
    current: false
  },
  {
    name: "Quality Control",
    href: "/admin/quality",
    icon: CheckSquare,
    current: false
  }
]

const contentManagement = [
  {
    name: "Blog Management",
    href: "/admin/blog",
    icon: FileText,
    current: false
  },
  {
    name: "Homepage Management",
    href: "/admin/homepage",
    icon: Globe,
    current: false
  },
  {
    name: "SEO Management",
    href: "/admin/seo",
    icon: Globe,
    current: false
  }
]

const systemSettings = [
  {
    name: "System Configuration",
    href: "/admin/system",
    icon: Settings,
    current: false
  },
  {
    name: "Database Management",
    href: "/admin/database",
    icon: Database,
    current: false
  },
  {
    name: "Security Settings",
    href: "/admin/security",
    icon: Shield,
    current: false
  }
]

export function AdminSidebar() {
  const location = useLocation()
  const [isRepairOpen, setIsRepairOpen] = useState(false)
  const [isContentOpen, setIsContentOpen] = useState(false)
  const [isSystemOpen, setIsSystemOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {/* Main Navigation */}
        <nav className="space-y-1">
          {adminNavigation.map((item) => {
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

        {/* Repair Process Management Section */}
        <div className="pt-4">
          <Collapsible open={isRepairOpen} onOpenChange={setIsRepairOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <div className="flex items-center">
                  <Wrench className="mr-3 h-5 w-5" />
                  Repair Process
                </div>
                {isRepairOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {repairProcessManagement.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "group flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-4 w-4 transition-colors",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Content Management Section */}
        <div className="pt-2">
          <Collapsible open={isContentOpen} onOpenChange={setIsContentOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <div className="flex items-center">
                  <FileText className="mr-3 h-5 w-5" />
                  Content Management
                </div>
                {isContentOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {contentManagement.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "group flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-4 w-4 transition-colors",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* System Settings Section */}
        <div className="pt-2">
          <Collapsible open={isSystemOpen} onOpenChange={setIsSystemOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <div className="flex items-center">
                  <Settings className="mr-3 h-5 w-5" />
                  System Settings
                </div>
                {isSystemOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              {systemSettings.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "group flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-accent hover:text-accent-foreground",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-4 w-4 transition-colors",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          Device Repair Pro
          <br />
          Admin Portal
        </div>
      </div>
    </div>
  )
}