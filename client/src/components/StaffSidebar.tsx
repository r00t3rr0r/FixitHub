import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
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
  ChevronRight,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getNotifications } from "@/api/notifications"
import "./StaffSidebar.css"

interface StaffSidebarProps {
  isCollapsed: boolean
}

export function StaffSidebar({ isCollapsed }: StaffSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await getNotifications()
        const data = response as any
        const notifications = data.notifications || []
        const unreadFromApi = typeof data.unreadCount === 'number'
          ? data.unreadCount
          : notifications.filter((n: any) => !(n?.isRead ?? n?.read ?? false)).length
        setUnreadNotifications(unreadFromApi)
      } catch (error) {
        console.error("Error fetching notifications:", error)
      }
    }

    fetchNotifications()

    const pollInterval = setInterval(() => {
      fetchNotifications()
    }, 15000)

    return () => clearInterval(pollInterval)
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
    const active = Boolean(to && isActive(to))
    const label = typeof children === "string" ? children : undefined

    const content = (
      <div className={`staff-nav-item ${active ? "active" : ""}`} title={isCollapsed ? label : undefined}>
        <div className="staff-nav-item__content">
          <Icon className="staff-nav-item__icon" />
          {!isCollapsed && <span className="staff-nav-item__text">{children}</span>}
        </div>
        {!isCollapsed && badge && badge > 0 && (
          <Badge variant="secondary" className="staff-nav-badge border-0 bg-transparent px-0 py-0 shadow-none">
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
      </div>
    )

    if (to) {
      return (
        <Link to={to} className="block" aria-label={label}>
          {content}
        </Link>
      )
    }

    return (
      <button onClick={onClick} className="w-full text-left" aria-label={label}>
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
          className="staff-collapsible-trigger h-auto"
          title={isCollapsed ? title : undefined}
          aria-label={title}
        >
          <div className="staff-collapsible-trigger__content">
            <Icon className="staff-collapsible-trigger__icon" />
            {!isCollapsed && <span className="staff-collapsible-trigger__text">{title}</span>}
          </div>
          {!isCollapsed && (isOpen ? <ChevronDown className="staff-collapsible-trigger__chevron" /> : <ChevronRight className="staff-collapsible-trigger__chevron" />)}
        </Button>
      </CollapsibleTrigger>
      {!isCollapsed && (
        <CollapsibleContent className="staff-collapsible-content space-y-1">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  )

  return (
    <nav className={`staff-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* Main Dashboard */}
      <NavItem to="/staff" icon={Home}>
        {t('staff.menu.dashboard')}
      </NavItem>

      <div className="staff-sidebar__separator" />

      {/* Repair Work Section */}
      <CollapsibleSection
        title={t('staff.menu.ordersAndWork')}
        icon={Package}
        isOpen={ordersOpen}
        onToggle={() => setOrdersOpen(!ordersOpen)}
      >
        <NavItem to="/staff/orders" icon={Package}>
          {t('staff.menu.myOrders')}
        </NavItem>
        <NavItem to="/staff/repair-requests" icon={FileText}>
          {t('staff.menu.repairRequests')}
        </NavItem>
        <NavItem to="/staff/bookings" icon={Package}>
          {t('navigation.bookings')}
        </NavItem>
      </CollapsibleSection>

      {/* Time & Schedule Management */}
      <NavItem to="/staff/time-tracking" icon={Clock}>
        {t('staff.menu.timeTracking')}
      </NavItem>

      <NavItem to="/staff/schedule" icon={Calendar}>
        {t('staff.menu.schedule')}
      </NavItem>

      <div className="staff-sidebar__separator" />

      {/* Tools & Resources Section */}
      <CollapsibleSection
        title={t('staff.menu.toolsAndResources')}
        icon={BookOpen}
        isOpen={toolsOpen}
        onToggle={() => setToolsOpen(!toolsOpen)}
      >
        <NavItem to="/staff/knowledge-base" icon={BookOpen}>
          {t('staff.menu.knowledgeBase')}
        </NavItem>
        <NavItem to="/staff/chat" icon={Users}>
          {t('staff.menu.teamChat')}
        </NavItem>
        <NavItem to="/staff/performance" icon={TrendingUp}>
          {t('staff.menu.performance')}
        </NavItem>
      </CollapsibleSection>

      <div className="staff-sidebar__separator" />

      {/* Communication & Profile */}
      <NavItem to="/messages" icon={MessageSquare}>
        {t('navigation.messages')}
      </NavItem>

      <NavItem to="/notifications" icon={Bell} badge={unreadNotifications}>
        {t('navigation.notifications')}
      </NavItem>

      <NavItem to="/profile" icon={User}>
        {t('navigation.profile')}
      </NavItem>
    </nav>
  )
}