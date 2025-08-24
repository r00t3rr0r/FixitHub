import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Wrench,
  BarChart3,
  FileText,
  Globe,
  Search,
  Settings,
  Database,
  Shield,
  GitBranch,
  Stethoscope,
  Boxes,
  CheckCircle,
  UserCheck,
  DollarSign
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function AdminSidebar() {
  const location = useLocation()
  const [isManagementOpen, setIsManagementOpen] = useState(true)
  const [isSystemOpen, setIsSystemOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="w-64 bg-background border-r h-full overflow-y-auto">
      <div className="p-4 space-y-2">
        <Link to="/admin">
          <Button
            variant={isActive("/admin") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </Link>

        <Collapsible open={isManagementOpen} onOpenChange={setIsManagementOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Package className="h-4 w-4 mr-2" />
              Management
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 ml-4">
            <Link to="/admin/users">
              <Button
                variant={isActive("/admin/users") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Users className="h-4 w-4 mr-2" />
                Users
              </Button>
            </Link>
            <Link to="/admin/orders">
              <Button
                variant={isActive("/admin/orders") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Package className="h-4 w-4 mr-2" />
                Orders
              </Button>
            </Link>
            <Link to="/admin/services">
              <Button
                variant={isActive("/admin/services") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Wrench className="h-4 w-4 mr-2" />
                Services
              </Button>
            </Link>
            <Link to="/admin/shop">
              <Button
                variant={isActive("/admin/shop") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Web Shop
              </Button>
            </Link>
            <Link to="/admin/staff">
              <Button
                variant={isActive("/admin/staff") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Staff
              </Button>
            </Link>
            <Link to="/admin/parts">
              <Button
                variant={isActive("/admin/parts") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Boxes className="h-4 w-4 mr-2" />
                Parts & Inventory
              </Button>
            </Link>
            <Link to="/admin/quality">
              <Button
                variant={isActive("/admin/quality") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Quality Control
              </Button>
            </Link>
            <Link to="/admin/workflow">
              <Button
                variant={isActive("/admin/workflow") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Workflows
              </Button>
            </Link>
          </CollapsibleContent>
        </Collapsible>

        <Link to="/admin/analytics">
          <Button
            variant={isActive("/admin/analytics") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </Link>

        <Link to="/admin/financial">
          <Button
            variant={isActive("/admin/financial") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Financial
          </Button>
        </Link>

        <Link to="/admin/blog">
          <Button
            variant={isActive("/admin/blog") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <FileText className="h-4 w-4 mr-2" />
            Blog
          </Button>
        </Link>

        <Link to="/admin/homepage">
          <Button
            variant={isActive("/admin/homepage") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <Globe className="h-4 w-4 mr-2" />
            Homepage
          </Button>
        </Link>

        <Link to="/admin/seo">
          <Button
            variant={isActive("/admin/seo") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <Search className="h-4 w-4 mr-2" />
            SEO
          </Button>
        </Link>

        <Link to="/admin/diagnostics">
          <Button
            variant={isActive("/admin/diagnostics") ? "secondary" : "ghost"}
            className="w-full justify-start"
          >
            <Stethoscope className="h-4 w-4 mr-2" />
            Diagnostics
          </Button>
        </Link>

        <Collapsible open={isSystemOpen} onOpenChange={setIsSystemOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              System
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 ml-4">
            <Link to="/admin/system">
              <Button
                variant={isActive("/admin/system") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuration
              </Button>
            </Link>
            <Link to="/admin/database">
              <Button
                variant={isActive("/admin/database") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Database className="h-4 w-4 mr-2" />
                Database
              </Button>
            </Link>
            <Link to="/admin/security">
              <Button
                variant={isActive("/admin/security") ? "secondary" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <Shield className="h-4 w-4 mr-2" />
                Security
              </Button>
            </Link>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}