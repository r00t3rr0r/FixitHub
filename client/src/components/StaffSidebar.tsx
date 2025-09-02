import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { 
  Home, 
  Package, 
  MessageSquare, 
  Bell, 
  User, 
  BookOpen,
  Clock,
  Calendar,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getNotifications } from "@/api/notifications"

interface StaffSidebarProps {
  isCollapsed: boolean
}

export function StaffSidebar({ isCollapsed }: StaffSidebarProps) {
  const location = useLocation()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await getNotifications()
        const notifications = (response as any).notifications || []
        setUnreadNotifications(notifications.filter((n: any) => !n.read).length)
      } catch (error) {
        console.error("Error fetching notifications:", error)
      }
    }

    fetchNotifications()
  }, [])

  const isActive = (path: string) => location.pathname === path

  const NavItem = ({ 
    to, 
    icon: Icon, 
    children, 
    badge, 
    onClick 
  }: { 
    to?: string
    icon: any
    children: React.ReactNode
    badge?: number
    onClick?: () => void
  }) => {
    const content = (
      <div className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors ${
        to && isActive(to) 
          ? 'bg-primary text-primary-foreground' 
          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
      }`}>
        <div className="flex items-center space-x-3">
          <Icon className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">{children}</span>}
        </div>
        {!isCollapsed && badge && badge > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </div>
    )

    if (to) {
      return (
        <Link to={to} className="block">
          {content}
        </Link>
      )
    }

    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    )
  }

  const CollapsibleSection = ({ 
    title, 
    icon: Icon, 
    isOpen, 
    onToggle, 
    children 
  }: {
    title: string
    icon: any
    isOpen: boolean
    onToggle: () => void
    children: React.ReactNode
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className={`w-full justify-between px-3 py-2 h-auto font-medium ${
            isCollapsed ? 'px-2' : ''
          }`}
        >
          <div className="flex items-center space-x-3">
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm">{title}</span>}
          </div>
          {!isCollapsed && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
        </Button>
      </CollapsibleTrigger>
      {!isCollapsed && (
        <CollapsibleContent className="space-y-1 ml-6">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  )

  return (
    <nav className="flex flex-col h-full p-4 space-y-1">
      <NavItem to="/staff" icon={Home}>
        Dashboard
      </NavItem>

      <CollapsibleSection
        title="Orders & Work"
        icon={Package}
        isOpen={ordersOpen}
        onToggle={() => setOrdersOpen(!ordersOpen)}
      >
        <NavItem to="/staff/orders" icon={Package}>
          My Orders
        </NavItem>
        <NavItem to="/staff/time-tracking" icon={Clock}>
          Time Tracking
        </NavItem>
        <NavItem to="/staff/schedule" icon={Calendar}>
          Schedule
        </NavItem>
      </CollapsibleSection>

      <CollapsibleSection
        title="Tools & Resources"
        icon={BookOpen}
        isOpen={toolsOpen}
        onToggle={() => setToolsOpen(!toolsOpen)}
      >
        <NavItem to="/staff/knowledge-base" icon={BookOpen}>
          Knowledge Base
        </NavItem>
        <NavItem to="/staff/chat" icon={Users}>
          Team Chat
        </NavItem>
        <NavItem to="/staff/performance" icon={TrendingUp}>
          Performance
        </NavItem>
      </CollapsibleSection>

      <NavItem to="/messages" icon={MessageSquare}>
        Messages
      </NavItem>

      <NavItem to="/notifications" icon={Bell} badge={unreadNotifications}>
        Notifications
      </NavItem>

      <NavItem to="/profile" icon={User}>
        Profile
      </NavItem>
    </nav>
  )
}