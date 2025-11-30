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
import { CustomerLayout } from "./components/CustomerLayout"
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
import { CustomerBookings } from "./pages/CustomerBookings"
import { CustomerInvoices } from "./pages/CustomerInvoices"
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
import { BookingsManagement } from "./pages/admin/BookingsManagement"
import { WebShopManagement } from "./pages/admin/WebShopManagement"
import { ServiceManagement } from "./pages/admin/ServiceManagement"
import { AddOnServiceManagement } from "./pages/admin/AddOnServiceManagement"
import { Analytics } from "./pages/admin/Analytics"
import { BlogManagement } from "./pages/admin/BlogManagement"
import { FAQManagement } from "./pages/admin/FAQManagement"
import { HomepageManagement } from "./pages/admin/HomepageManagement"
import { WebsiteBuilder } from "./pages/admin/WebsiteBuilder"
import { VisualPageBuilder } from "./pages/admin/VisualPageBuilder"
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
          {/* Public routes - accessible to all users */}
          <Routes>
            {/* Home page as default landing page for all users */}
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/debug" element={<DebugLogin />} />

            {/* Protected routes - accessible only to authenticated users */}
            <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
            </Route>

            {/* Customer routes */}
            <Route path="/new-order" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<NewOrder />} />
            </Route>
            <Route path="/orders" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<OrderTracking />} />
            </Route>
            <Route path="/orders/:id" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<OrderDetails />} />
            </Route>
            <Route path="/messages" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Messages />} />
            </Route>
            <Route path="/notifications" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Notifications />} />
            </Route>
            <Route path="/shop" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<WebShop />} />
            </Route>
            <Route path="/cart" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<ShoppingCartPage />} />
            </Route>
            <Route path="/profile" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Profile />} />
            </Route>
            <Route path="/bookings" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<CustomerBookings />} />
            </Route>
            <Route path="/invoices" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<CustomerInvoices />} />
            </Route>
            <Route path="/blog" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Blog />} />
            </Route>
            <Route path="/blog/:id" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<BlogPostPage />} />
            </Route>

            {/* Staff routes */}
            <Route path="/staff" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<StaffDashboard />} />
            </Route>
            <Route path="/staff/orders" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<StaffOrders />} />
            </Route>
            <Route path="/staff/knowledge-base" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<KnowledgeBase />} />
            </Route>
            <Route path="/staff/time-tracking" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<TimeTracking />} />
            </Route>
            <Route path="/staff/schedule" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Schedule />} />
            </Route>
            <Route path="/staff/chat" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<TeamChat />} />
            </Route>
            <Route path="/staff/performance" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Performance />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
            </Route>
            <Route path="/admin/users" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<UserManagement />} />
            </Route>
            <Route path="/admin/orders" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<OrderManagement />} />
            </Route>
            <Route path="/admin/bookings" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<BookingsManagement />} />
            </Route>
            <Route path="/admin/shop" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<WebShopManagement />} />
            </Route>
            <Route path="/admin/services" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<ServiceManagement />} />
            </Route>
            <Route path="/admin/addons" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<AddOnServiceManagement />} />
            </Route>
            <Route path="/admin/devices" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DeviceBrandsManagement />} />
            </Route>
            <Route path="/admin/analytics" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Analytics />} />
            </Route>
            <Route path="/admin/blog" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<BlogManagement />} />
            </Route>
            <Route path="/admin/faq" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<FAQManagement />} />
            </Route>
            <Route path="/admin/homepage" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<HomepageManagement />} />
            </Route>
            <Route path="/admin/website-builder" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<WebsiteBuilder />} />
            </Route>
            <Route path="/admin/visual-builder/:pageId" element={<ProtectedRoute><VisualPageBuilder /></ProtectedRoute>} />
            <Route path="/admin/seo" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<SEOManagement />} />
            </Route>
            <Route path="/admin/system" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<SystemConfiguration />} />
            </Route>
            <Route path="/admin/database" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DatabaseManagement />} />
            </Route>
            <Route path="/admin/security" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<SecuritySettings />} />
            </Route>
            <Route path="/admin/workflow" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<WorkflowManagement />} />
            </Route>
            <Route path="/admin/diagnostics" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DiagnosticTools />} />
            </Route>
            <Route path="/admin/parts" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<PartsManagement />} />
            </Route>
            <Route path="/admin/quality" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<QualityControl />} />
            </Route>
            <Route path="/admin/staff" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<StaffManagement />} />
            </Route>
            <Route path="/admin/financial" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<FinancialManagement />} />
            </Route>
            <Route path="/admin/epart-orders" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<EPartOrderManagement />} />
            </Route>

            {/* Inspection route */}
            <Route path="/inspection/:orderId" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<InspectionWorkflow />} />
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<BlankPage />} />
          </Routes>
        </Router>
        <Toaster />
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App