import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/ui/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { AuthProvider } from "./contexts/AuthContext"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Layout } from "./components/Layout"
import { BlankPage } from "./pages/BlankPage"
import { Dashboard } from "./pages/Dashboard"
import { NewOrder } from "./pages/NewOrder"
import { OrderTracking } from "./pages/OrderTracking"
import { WebShop } from "./pages/WebShop"
import { ShoppingCartPage } from "./pages/ShoppingCart"
import { Profile } from "./pages/Profile"
import { Blog } from "./pages/Blog"
import { BlogPostPage } from "./pages/BlogPost"
import { StaffDashboard } from "./pages/staff/StaffDashboard"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { UserManagement } from "./pages/admin/UserManagement"
import { OrderManagement } from "./pages/admin/OrderManagement"
import { WebShopManagement } from "./pages/admin/WebShopManagement"
import { Analytics } from "./pages/admin/Analytics"
import { BlogManagement } from "./pages/admin/BlogManagement"
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

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="light" storageKey="ui-theme">
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="new-order" element={<NewOrder />} />
              <Route path="orders" element={<OrderTracking />} />
              <Route path="shop" element={<WebShop />} />
              <Route path="cart" element={<ShoppingCartPage />} />
              <Route path="profile" element={<Profile />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:id" element={<BlogPostPage />} />
              <Route path="staff" element={<StaffDashboard />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/users" element={<UserManagement />} />
              <Route path="admin/orders" element={<OrderManagement />} />
              <Route path="admin/shop" element={<WebShopManagement />} />
              <Route path="admin/analytics" element={<Analytics />} />
              <Route path="admin/blog" element={<BlogManagement />} />
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