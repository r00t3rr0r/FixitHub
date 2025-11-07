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
  Stethoscope,
  Package2,
  Award,
  UserCheck,
  DollarSign,
  MessageSquare,
  Bell,
  User,
  ChevronDown,
  ChevronRight,
  Boxes
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { getNotifications } from "@/api/notifications"

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
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

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
        <NavItem to="/admin/orders" icon={Package}>
          {t('navigation.orders')}
        </NavItem>
        <NavItem to="/admin/services" icon={Wrench}>
          {t('admin.menu.serviceManagement')}
        </NavItem>
        <NavItem to="/admin/addons" icon={Plus}>
          {t('admin.menu.addOnServices')}
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
        <NavItem to="/admin/quality" icon={Award}>
          {t('admin.menu.qualityControl')}
        </NavItem>
        <NavItem to="/admin/workflow" icon={GitBranch}>
          {t('admin.menu.workflowManagement')}
        </NavItem>
        <NavItem to="/admin/diagnostics" icon={Stethoscope}>
          {t('admin.menu.diagnosticTools')}
        </NavItem>
      </CollapsibleSection>

      <NavItem to="/admin/shop" icon={ShoppingBag}>
        {t('admin.menu.webShopManagement')}
      </NavItem>

      <NavItem to="/admin/financial" icon={DollarSign}>
        {t('admin.menu.financialManagement')}
      </NavItem>

      <CollapsibleSection
        title={t('admin.menu.analytics')}
        icon={BarChart3}
        isOpen={analyticsOpen}
        onToggle={() => setAnalyticsOpen(!analyticsOpen)}
      >
        <NavItem to="/admin/analytics" icon={BarChart3}>
          {t('admin.menu.analytics')}
        </NavItem>
      </CollapsibleSection>

      <CollapsibleSection
        title="Content Management"
        icon={FileText}
        isOpen={contentManagementOpen}
        onToggle={() => setContentManagementOpen(!contentManagementOpen)}
      >
        <NavItem to="/admin/blog" icon={FileText}>
          {t('admin.menu.blogManagement')}
        </NavItem>
        <NavItem to="/admin/faq" icon={HelpCircle}>
          {t('admin.menu.faqManagement')}
        </NavItem>
        <NavItem to="/admin/homepage" icon={Layout}>
          {t('admin.menu.homepageManagement')}
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