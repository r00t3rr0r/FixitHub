import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Users,
  ShoppingCart,
  Package,
  Wrench,
  Plus,
  BarChart3,
  FileText,
  Home,
  Search,
  Settings,
  Database,
  Shield,
  GitBranch,
  Stethoscope,
  Boxes,
  CheckCircle,
  UserCheck,
  DollarSign,
  ChevronDown,
  ChevronRight
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from "react"

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: Home,
  },
  {
    title: "User Management",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Order Management",
    href: "/admin/orders",
    icon: ShoppingCart,
  },
  {
    title: "Services",
    icon: Wrench,
    items: [
      {
        title: "Repair Services",
        href: "/admin/services",
        icon: Wrench,
      },
      {
        title: "Add-On Services",
        href: "/admin/addons",
        icon: Plus,
      },
    ]
  },
  {
    title: "Web Shop",
    href: "/admin/shop",
    icon: Package,
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Content Management",
    icon: FileText,
    items: [
      {
        title: "Blog Management",
        href: "/admin/blog",
        icon: FileText,
      },
      {
        title: "Homepage",
        href: "/admin/homepage",
        icon: Home,
      },
      {
        title: "SEO Management",
        href: "/admin/seo",
        icon: Search,
      },
    ]
  },
  {
    title: "Operations",
    icon: Settings,
    items: [
      {
        title: "Workflow Management",
        href: "/admin/workflow",
        icon: GitBranch,
      },
      {
        title: "Diagnostic Tools",
        href: "/admin/diagnostics",
        icon: Stethoscope,
      },
      {
        title: "Parts Management",
        href: "/admin/parts",
        icon: Boxes,
      },
      {
        title: "Quality Control",
        href: "/admin/quality",
        icon: CheckCircle,
      },
      {
        title: "Staff Management",
        href: "/admin/staff",
        icon: UserCheck,
      },
    ]
  },
  {
    title: "Financial",
    href: "/admin/financial",
    icon: DollarSign,
  },
  {
    title: "System",
    icon: Settings,
    items: [
      {
        title: "Configuration",
        href: "/admin/system",
        icon: Settings,
      },
      {
        title: "Database",
        href: "/admin/database",
        icon: Database,
      },
      {
        title: "Security",
        href: "/admin/security",
        icon: Shield,
      },
    ]
  },
]

export function AdminSidebar() {
  const location = useLocation()
  const [openSections, setOpenSections] = useState<string[]>([
    "Services",
    "Content Management", 
    "Operations",
    "System"
  ])

  const toggleSection = (title: string) => {
    setOpenSections(prev => 
      prev.includes(title) 
        ? prev.filter(section => section !== title)
        : [...prev, title]
    )
  }

  const isActive = (href: string) => {
    return location.pathname === href
  }

  const isSectionActive = (items: any[]) => {
    return items.some(item => isActive(item.href))
  }

  return (
    <nav className="space-y-2">
      {adminNavItems.map((item) => {
        if (item.items) {
          const isOpen = openSections.includes(item.title)
          const hasActiveChild = isSectionActive(item.items)
          
          return (
            <Collapsible key={item.title} open={isOpen} onOpenChange={() => toggleSection(item.title)}>
              <CollapsibleTrigger className={cn(
                "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                hasActiveChild && "bg-accent text-accent-foreground"
              )}>
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </div>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pl-6">
                {item.items.map((subItem) => (
                  <Link
                    key={subItem.href}
                    to={subItem.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive(subItem.href) && "bg-accent text-accent-foreground"
                    )}
                  >
                    <subItem.icon className="h-4 w-4" />
                    {subItem.title}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )
        }

        return (
          <Link
            key={item.href}
            to={item.href!}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive(item.href!) && "bg-accent text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}