import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Home,
  Users,
  Package,
  ShoppingBag,
  Wrench,
  Plus,
  Smartphone,
  BarChart3,
  FileText,
  HelpCircle,
  Layout,
  Search,
  Settings,
  Database,
  Shield,
  GitBranch,
  Package2,
  UserCheck,
  DollarSign,
  AlertCircle,
  MessageSquare,
  Bell,
  User,
  Layers,
  ChevronRight,
  FolderTree,
  Boxes,
  BookMarked,
  Mail
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getNotifications } from "@/api/notifications"
import "./AdminSidebar.css"

interface AdminSidebarProps {
  isCollapsed: boolean
}

export function AdminSidebar({ isCollapsed }: AdminSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [userManagementOpen, setUserManagementOpen] = useState(false)
  const [orderManagementOpen, setOrderManagementOpen] = useState(false)
  const [contentManagementOpen, setContentManagementOpen] = useState(false)
  const [systemManagementOpen, setSystemManagementOpen] = useState(false)

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
    const active = to && isActive(to)
    
    const content = (
      <div className={`admin-nav-item ${active ? 'active' : ''}`}>
        <div className="admin-nav-item-content">
          <Icon className="admin-nav-item-icon" />
          {!isCollapsed && <span className="admin-nav-item-text">{children}</span>}
        </div>
        {!isCollapsed && badge && badge > 0 && (
          <span className="admin-nav-badge">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
    )

    if (to) {
      return (
        <Link to={to}>
          {content}
        </Link>
      )
    }

    return (
      <button onClick={onClick} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0 }}>
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
        <button className="admin-collapsible-trigger">
          <div className="admin-collapsible-trigger-content">
            <Icon className="admin-collapsible-icon" />
            {!isCollapsed && <span>{title}</span>}
          </div>
          {!isCollapsed && <ChevronRight className="admin-collapsible-chevron" />}
        </button>
      </CollapsibleTrigger>
      {!isCollapsed && (
        <CollapsibleContent className="admin-collapsible-content">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  )

  return (
    <nav className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <NavItem to="/admin" icon={Home}>
        {t('navigation.dashboard')}
      </NavItem>

      <CollapsibleSection
        title={t('admin.menu.userManagement')}
        icon={Users}
        isOpen={userManagementOpen}
        onToggle={() => setUserManagementOpen(!userManagementOpen)}
      >
        <NavItem to="/admin/users" icon={Users}>
          {t('admin.menu.userManagement')}
        </NavItem>
        <NavItem to="/admin/customer-groups" icon={Layers}>
          {t('admin.menu.customerGroups')}
        </NavItem>
        <NavItem to="/admin/staff" icon={UserCheck}>
          {t('admin.menu.staffManagement')}
        </NavItem>
      </CollapsibleSection>

      <CollapsibleSection
        title={t('admin.menu.orderManagement')}
        icon={Package}
        isOpen={orderManagementOpen}
        onToggle={() => setOrderManagementOpen(!orderManagementOpen)}
      >
        <NavItem to="/admin/bookings" icon={BookMarked}>
          {t('admin.menu.bookings')}
        </NavItem>
        <NavItem to="/admin/services" icon={Wrench}>
          {t('admin.menu.serviceManagement')}
        </NavItem>
        <NavItem to="/admin/addons" icon={Plus}>
          {t('admin.menu.addOnServices')}
        </NavItem>
        <NavItem to="/admin/service-categories" icon={FolderTree}>
          Service Categories
        </NavItem>
        <NavItem to="/admin/devices" icon={Smartphone}>
          {t('admin.menu.deviceBrands')}
        </NavItem>
        <NavItem to="/admin/parts" icon={Package2}>
          {t('admin.menu.partsManagement')}
        </NavItem>
        <NavItem to="/admin/epart-orders" icon={Boxes}>
          {t('admin.menu.epartOrders')}
        </NavItem>
        <NavItem to="/admin/workflow" icon={GitBranch}>
          {t('admin.menu.workflowManagement')}
        </NavItem>
        <NavItem to="/admin/analytics" icon={BarChart3}>
          {t('admin.menu.analytics')}
        </NavItem>
        <NavItem to="/admin/repair-requests" icon={FileText}>
          Repair Requests
        </NavItem>
        <NavItem to="/admin/financial" icon={DollarSign}>
          {t('admin.menu.financialManagement')}
        </NavItem>
        <NavItem to="/admin/complaints" icon={AlertCircle}>
          Reklamationen
        </NavItem>
      </CollapsibleSection>

      <CollapsibleSection
        title="Content Management"
        icon={FileText}
        isOpen={contentManagementOpen}
        onToggle={() => setContentManagementOpen(!contentManagementOpen)}
      >
        <NavItem to="/admin/shop" icon={ShoppingBag}>
          {t('admin.menu.webShopManagement')}
        </NavItem>
        <NavItem to="/admin/blog" icon={FileText}>
          {t('admin.menu.blogManagement')}
        </NavItem>
        <NavItem to="/admin/faq" icon={HelpCircle}>
          {t('admin.menu.faqManagement')}
        </NavItem>
        <NavItem to="/admin/homepage" icon={Layout}>
          {t('admin.menu.homepageManagement')}
        </NavItem>
        <NavItem to="/admin/website-builder" icon={Layout}>
          Website Builder
        </NavItem>
        <NavItem to="/admin/seo" icon={Search}>
          {t('admin.menu.seoManagement')}
        </NavItem>
      </CollapsibleSection>

      <CollapsibleSection
        title="System Management"
        icon={Settings}
        isOpen={systemManagementOpen}
        onToggle={() => setSystemManagementOpen(!systemManagementOpen)}
      >
        <NavItem to="/admin/system" icon={Settings}>
          {t('admin.menu.systemConfiguration')}
        </NavItem>
        <NavItem to="/admin/email" icon={Mail}>
          Email-Verwaltung
        </NavItem>
        <NavItem to="/admin/database" icon={Database}>
          {t('admin.menu.databaseManagement')}
        </NavItem>
        <NavItem to="/admin/security" icon={Shield}>
          {t('admin.menu.securitySettings')}
        </NavItem>
      </CollapsibleSection>

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