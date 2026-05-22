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
  Mail,
  Activity,
  Megaphone
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
  const [orderManagementOpen, setOrderManagementOpen] = useState(false)
  const [contentManagementOpen, setContentManagementOpen] = useState(false)
  const [marketingPromoOpen, setMarketingPromoOpen] = useState(false)
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
        Dashboard
      </NavItem>

      <CollapsibleSection
        title="Auftragsverwaltung"
        icon={Package}
        isOpen={orderManagementOpen}
        onToggle={() => setOrderManagementOpen(!orderManagementOpen)}
      >
        <NavItem to="/admin/bookings" icon={BookMarked}>
          Buchungen
        </NavItem>
        <NavItem to="/admin/repair-requests" icon={FileText}>
          Repair Requests
        </NavItem>
        <NavItem to="/admin/contact-requests" icon={MessageSquare}>
          Kontaktanfragen
        </NavItem>
        <NavItem to="/admin/complaints" icon={AlertCircle}>
          Reklamationen
        </NavItem>
        <NavItem to="/admin/parts" icon={Package2}>
          Teileverwaltung
        </NavItem>
        <NavItem to="/admin/epart-orders" icon={Boxes}>
          Epart-Bestellungen
        </NavItem>
        <NavItem to="/admin/financial" icon={DollarSign}>
          Finanzverwaltung
        </NavItem>
        <NavItem to="/admin/users" icon={Users}>
          Benutzerverwaltung
        </NavItem>
        <NavItem to="/admin/staff" icon={UserCheck}>
          Personalverwaltung
        </NavItem>
        <NavItem to="/admin/analytics" icon={BarChart3}>
          Analysen
        </NavItem>
      </CollapsibleSection>

      <CollapsibleSection
        title="Sytem Management"
        icon={Settings}
        isOpen={systemManagementOpen}
        onToggle={() => setSystemManagementOpen(!systemManagementOpen)}
      >
        <NavItem to="/admin/customer-groups" icon={Layers}>
          {t('admin.menu.customerGroups')}
        </NavItem>
        <NavItem to="/admin/services" icon={Wrench}>
          Dienstverwaltung
        </NavItem>
        <NavItem to="/admin/service-categories" icon={FolderTree}>
          Service Categories
        </NavItem>
        <NavItem to="/admin/addons" icon={Plus}>
          Zusatzdienste
        </NavItem>
        <NavItem to="/admin/devices" icon={Smartphone}>
          Gerätemarken
        </NavItem>
        <NavItem to="/admin/workflow" icon={GitBranch}>
          Workflowverwaltung
        </NavItem>

        <CollapsibleSection
          title="Content Management"
          icon={FileText}
          isOpen={contentManagementOpen}
          onToggle={() => setContentManagementOpen(!contentManagementOpen)}
        >
          <NavItem to="/admin/shop" icon={ShoppingBag}>
            Webshop-Verwaltung
          </NavItem>
          <NavItem to="/admin/blog" icon={FileText}>
            Blog-Verwaltung
          </NavItem>
          <NavItem to="/admin/faq" icon={HelpCircle}>
            FAQ-Verwaltung
          </NavItem>
          <NavItem to="/admin/homepage" icon={Layout}>
            Homepage-Verwaltung
          </NavItem>
          <NavItem to="/admin/website-builder" icon={Layout}>
            Website Builder
          </NavItem>
          <NavItem to="/admin/seo" icon={Search}>
            SEO-Verwaltung
          </NavItem>
        </CollapsibleSection>

        <CollapsibleSection
          title="Marketing/Promo"
          icon={Megaphone}
          isOpen={marketingPromoOpen}
          onToggle={() => setMarketingPromoOpen(!marketingPromoOpen)}
        >
          <NavItem to="/admin/marketing-promo" icon={Megaphone}>
            Uebersicht
          </NavItem>
          <NavItem to="/admin/marketing-promo/newsletters" icon={Mail}>
            Newsletter
          </NavItem>
          <NavItem to="/admin/marketing-promo/promo-codes" icon={DollarSign}>
            Promo Codes
          </NavItem>
          <NavItem to="/admin/marketing-promo/segments" icon={Layers}>
            Segmente
          </NavItem>
          <NavItem to="/admin/marketing-promo/reports" icon={BarChart3}>
            Reports
          </NavItem>
          <NavItem to="/admin/marketing-promo/settings" icon={Settings}>
            Einstellungen
          </NavItem>
        </CollapsibleSection>

        <NavItem to="/admin/system" icon={Settings}>
          Systemkonfiguration
        </NavItem>
        <NavItem to="/admin/database" icon={Database}>
          Datenbankverwaltung
        </NavItem>
        <NavItem to="/admin/security" icon={Shield}>
          Sicherheitseinstellungen
        </NavItem>
        <NavItem to="/admin/email" icon={Mail}>
          Email-Verwaltung
        </NavItem>
        <NavItem to="/admin/live-tracking" icon={Activity}>
          Live Tracking
        </NavItem>
      </CollapsibleSection>

      <NavItem to="/messages" icon={MessageSquare}>
        Nachrichten
      </NavItem>

      <NavItem to="/notifications" icon={Bell} badge={unreadNotifications}>
        Benachrichttigungen
      </NavItem>

      <NavItem to="/profile" icon={User}>
        Profil
      </NavItem>
    </nav>
  )
}