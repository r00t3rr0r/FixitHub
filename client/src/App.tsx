import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/ui/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { AuthProvider } from "./contexts/AuthContext"
import { Home } from "./pages/Home"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { DebugLogin } from "./pages/DebugLogin"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Layout } from "./components/Layout"
import { BlankPage } from "./pages/BlankPage"
import { Dashboard } from "./pages/Dashboard"
import { NewOrder } from "./pages/NewOrder"
import { OrderTracking } from "./pages/OrderTracking"
import { OrderDetails } from "./pages/OrderDetails"
import { Messages } from "./pages/Messages"
import { Notifications } from "./pages/Notifications"
import { WebShop } from "./pages/WebShop"
import { ShoppingCartPage } from "./pages/ShoppingCart"
import { Profile } from "./pages/Profile"
import { Blog } from "./pages/Blog"
import { BlogPostPage } from "./pages/BlogPost"
import { StaffDashboard } from "./pages/staff/StaffDashboard"
import { StaffOrders } from "./pages/staff/StaffOrders"
import { KnowledgeBase } from "./pages/staff/KnowledgeBase"
import { TimeTracking } from "./pages/staff/TimeTracking"
import { Schedule } from "./pages/staff/Schedule"
import { TeamChat } from "./pages/staff/TeamChat"
import { Performance } from "./pages/staff/Performance"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { UserManagement } from "./pages/admin/UserManagement"
import { OrderManagement } from "./pages/admin/OrderManagement"
import { WebShopManagement } from "./pages/admin/WebShopManagement"
import { ServiceManagement } from "./pages/admin/ServiceManagement"
import { AddOnServiceManagement } from "./pages/admin/AddOnServiceManagement"
import { Analytics } from "./pages/admin/Analytics"
import { BlogManagement } from "./pages/admin/BlogManagement"
import { FAQManagement } from "./pages/admin/FAQManagement"
import { HomepageManagement } from "./pages/admin/HomepageManagement"
import { SEOManagement } from "./pages/admin/SEOManagement"
import { SystemConfiguration } from "./pages/admin/SystemConfiguration"
import { DatabaseManagement } from "./pages/admin/DatabaseManagement"
import { SecuritySettings } from "./pages/admin/SecuritySettings"
import { WorkflowManagement } from "./pages/admin/WorkflowManagement"
import { DiagnosticTools } from "./pages/admin/DiagnosticTools"
import { PartsManagement } from "./pages/admin/PartsManagement"
import { QualityControl } from "./pages/admin/QualityControl"
import { StaffManagement } from "./pages/admin/StaffManagement"
import { FinancialManagement } from "./pages/admin/FinancialManagement"
import { DeviceBrandsManagement } from "./pages/admin/DeviceBrandsManagement"
import EPartOrderManagement from "./pages/admin/EPartOrderManagement"
import { InspectionWorkflow } from "./pages/inspection/InspectionWorkflow"

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="light" storageKey="ui-theme">
        <Router>
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/debug" element={<DebugLogin />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="new-order" element={<NewOrder />} />
              <Route path="orders" element={<OrderTracking />} />
              <Route path="orders/:id" element={<OrderDetails />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="shop" element={<WebShop />} />
              <Route path="cart" element={<ShoppingCartPage />} />
              <Route path="profile" element={<Profile />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:id" element={<BlogPostPage />} />
              <Route path="staff" element={<StaffDashboard />} />
              <Route path="staff/orders" element={<StaffOrders />} />
              <Route path="staff/knowledge-base" element={<KnowledgeBase />} />
              <Route path="staff/time-tracking" element={<TimeTracking />} />
              <Route path="staff/schedule" element={<Schedule />} />
              <Route path="staff/chat" element={<TeamChat />} />
              <Route path="staff/performance" element={<Performance />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/users" element={<UserManagement />} />
              <Route path="admin/orders" element={<OrderManagement />} />
              <Route path="admin/shop" element={<WebShopManagement />} />
              <Route path="admin/services" element={<ServiceManagement />} />
              <Route path="admin/addons" element={<AddOnServiceManagement />} />
              <Route path="admin/devices" element={<DeviceBrandsManagement />} />
              <Route path="admin/analytics" element={<Analytics />} />
              <Route path="admin/blog" element={<BlogManagement />} />
              <Route path="admin/faq" element={<FAQManagement />} />
              <Route path="admin/homepage" element={<HomepageManagement />} />
              <Route path="admin/seo" element={<SEOManagement />} />
              <Route path="admin/system" element={<SystemConfiguration />} />
              <Route path="admin/database" element={<DatabaseManagement />} />
              <Route path="admin/security" element={<SecuritySettings />} />
              <Route path="admin/workflow" element={<WorkflowManagement />} />
              <Route path="admin/diagnostics" element={<DiagnosticTools />} />
              <Route path="admin/parts" element={<PartsManagement />} />
              <Route path="admin/quality" element={<QualityControl />} />
              <Route path="admin/staff" element={<StaffManagement />} />
              <Route path="admin/financial" element={<FinancialManagement />} />
              <Route path="admin/epart-orders" element={<EPartOrderManagement />} />
              <Route path="inspection/:orderId" element={<InspectionWorkflow />} />
            </Route>
            <Route path="*" element={<BlankPage />} />
          </Routes>
        </Router>
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App