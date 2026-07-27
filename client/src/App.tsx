import { BrowserRouter as Router, Routes, Route, useLocation, matchPath } from "react-router-dom"
import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { ThemeProvider } from "./components/ui/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { AuthProvider } from "./contexts/AuthContext"
import { Home } from "./pages/Home"
import { RepairCatalogPage } from "./pages/public/RepairCatalogPage"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { VerifyEmail } from "./pages/VerifyEmail"
import { ForgotPassword } from "./pages/ForgotPassword"
import { ResetPassword } from "./pages/ResetPassword"
import { DebugLogin } from "./pages/DebugLogin"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Layout } from "./components/Layout"
import { CustomerLayout } from "./components/CustomerLayout"
import { BlankPage } from "./pages/BlankPage"
import { NewOrder } from "./pages/NewOrder"
import { OrderTracking } from "./pages/OrderTracking"
import { OrderDetails } from "./pages/OrderDetails"
import { Messages } from "./pages/Messages"
import { Notifications } from "./pages/Notifications"
import { WebShop } from "./pages/WebShop"
import { ProductDetail } from "./pages/ProductDetail"
import { ShoppingCartPage } from "./pages/ShoppingCart"
import { Profile } from "./pages/Profile"
import { Blog } from "./pages/Blog"
import { BlogPostPage } from "./pages/BlogPost"
import { CustomerBookings } from "./pages/CustomerBookings"
import { CustomerInvoices } from "./pages/CustomerInvoices"
import { CustomerRepairRequests } from "./pages/CustomerRepairRequests"
import { CustomerComplaints } from "./pages/CustomerComplaints"
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
import ServiceCategoryManagement from "./pages/admin/ServiceCategoryManagement"
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
import { PartsManagement } from "./pages/admin/PartsManagement"
import { StaffManagement } from "./pages/admin/StaffManagement"
import { FinancialManagement } from "./pages/admin/FinancialManagement"
import { CustomerGroupsManagement } from "./pages/admin/CustomerGroupsManagement"
import { DeviceManagement } from "./pages/admin/DeviceManagement"
import { ComplaintsManagement } from "./pages/admin/ComplaintsManagement"
import { EmailAdministration } from "./pages/admin/EmailAdministration"
import EPartOrderManagement from "./pages/admin/EPartOrderManagement"
import TrackingLive from "./pages/admin/TrackingLive"
import { MarketingPromoOverview } from "./pages/admin/marketing-promo/MarketingPromoOverview"
import { MarketingPromoNewsletters } from "./pages/admin/marketing-promo/MarketingPromoNewsletters"
import { MarketingPromoPromoCodes } from "./pages/admin/marketing-promo/MarketingPromoPromoCodes"
import { MarketingPromoSegments } from "./pages/admin/marketing-promo/MarketingPromoSegments"
import { MarketingPromoReports } from "./pages/admin/marketing-promo/MarketingPromoReports"
import { MarketingPromoSettingsPage } from "./pages/admin/marketing-promo/MarketingPromoSettings"
import { AdcellTrackingPage } from "./pages/admin/marketing-promo/AdcellTracking"
import { InspectionWorkflow } from "./pages/inspection/InspectionWorkflow"
import { RepairWorkflowPage } from "./pages/repair/RepairWorkflowPage"
import { RepairRequestQuestionnaire } from "./pages/RepairRequestQuestionnaire"
import { RepairRequestsManagement } from "./pages/admin/RepairRequestsManagement"
import { Widerrufsrecht } from "./pages/Widerrufsrecht"
import { Privacy } from "./pages/Privacy"
import { Imprint } from "./pages/Imprint"
import { Terms } from "./pages/Terms"
import { About } from "./pages/About"
import { FAQ } from "./pages/FAQ"
import { GuestOrderTracking } from "./pages/GuestOrderTracking"
import { GuestBookingTracking } from "./pages/GuestBookingTracking"
import { GuestRepairRequestTracking } from "./pages/GuestRepairRequestTracking"
import { Vorabdiagnose } from "./pages/Vorabdiagnose"
import { Annahmestellen } from "./pages/Annahmestellen"
import { Contact } from "./pages/Contact"
import { PartnerWerden } from "./pages/PartnerWerden"
import Newsletter from "./pages/Newsletter"
import { Sitemap } from "./pages/Sitemap"
import { ShippingAndPayment } from "./pages/ShippingAndPayment"
import { BatteryDisposal } from "./pages/BatteryDisposal"
import { OrderSuccessPage } from "./pages/OrderSuccess"
import { PageTracker } from "./components/PageTracker"
import { GlobalScrollToTopButton } from "./components/GlobalScrollToTopButton"

function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    // Some very small mobile viewports can keep the previous scroll offset on route transitions.
    // Reset immediately and once more on the next frame/tick to ensure we land at the top.
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    scrollToTop()

    const frameId = window.requestAnimationFrame(scrollToTop)
    const timeoutId = window.setTimeout(scrollToTop, 0)
    const lateTimeoutId = window.setTimeout(scrollToTop, 220)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
      window.clearTimeout(lateTimeoutId)
    }
  }, [pathname, search, hash])

  return null
}

function getCustomerSeoTopic(pathname: string): string {
  if (pathname === "/" || pathname === "/home") return "Smartphone-, Tablet- und Laptop-Reparatur"
  if (pathname.startsWith("/shop") || pathname === "/cart") return "Ersatzteile und Zubehoer"
  if (pathname.startsWith("/blog")) return "Reparaturtipps und Servicewissen"
  if (pathname.startsWith("/track-order") || pathname.startsWith("/orders")) return "Auftragsverfolgung"
  if (pathname.startsWith("/repair-request") || pathname.startsWith("/new-order")) return "Reparaturanfrage"
  if (pathname.startsWith("/contact") || pathname.startsWith("/kontakt")) return "Kundenservice"
  if (pathname.startsWith("/faq")) return "Hilfe und haeufige Fragen"
  if (pathname.startsWith("/privacy") || pathname.startsWith("/datenschutz")) return "Datenschutzinformationen"
  if (pathname.startsWith("/terms") || pathname.startsWith("/agb")) return "AGB und Vertragsbedingungen"
  if (pathname.startsWith("/reparatur")) return "Reparaturkatalog – Geraete, Hersteller und Services"
  return "Reparaturservice"
}

function getCustomerSeoFeatures(pathname: string): string[] {
  if (pathname === "/" || pathname === "/home") {
    return [
      "Reparaturkonfigurator mit Auswahl fuer Geraetemodell und Reparaturservice",
      "Online-Preisuebersicht fuer Reparaturen und Zusatzleistungen",
      "Express-Reparaturservice fuer Smartphones, Tablets und Laptops",
    ]
  }
  if (pathname.startsWith("/shop") || pathname === "/cart") {
    return [
      "Webshop fuer Ersatzteile und Zubehoer",
      "Warenkorb und Checkout fuer Service- und Produktbestellungen",
      "Kombinierte Buchung von Reparaturservice und Zusatzoptionen",
    ]
  }
  if (pathname.startsWith("/track-order") || pathname.startsWith("/orders") || pathname.startsWith("/bookings")) {
    return [
      "Auftragsverfolgung fuer Reparaturen und Buchungen",
      "Statusupdates mit nachvollziehbaren Reparaturschritten",
      "Digitale Einsicht in Buchungs- und Auftragsdetails",
    ]
  }
  if (pathname.startsWith("/repair-request") || pathname.startsWith("/new-order") || pathname.startsWith("/my-repair-requests")) {
    return [
      "Online-Reparaturanfrage fuer individuelle Defekte",
      "Geratemodell- und Serviceauswahl im mehrstufigen Prozess",
      "Erfassung von Fehlerbeschreibung und Zusatzinformationen",
    ]
  }
  if (pathname.startsWith("/messages") || pathname.startsWith("/notifications") || pathname.startsWith("/my-complaints")) {
    return [
      "Kundenkommunikation zu Reparaturauftraegen",
      "Benachrichtigungen zu Status und Rueckmeldungen",
      "Digitale Bearbeitung von Rueckfragen und Beschwerden",
    ]
  }
  if (pathname.startsWith("/profile") || pathname.startsWith("/invoices")) {
    return [
      "Kundenprofilverwaltung",
      "Rechnungs- und Dokumentenansicht",
      "Selbstservice fuer persönliche Auftragsdaten",
    ]
  }
  if (pathname.startsWith("/reparatur")) {
    return [
      "Reparaturkatalog mit Geraetetypen, Herstellern und Modellen",
      "Preisübersicht fuer alle angebotenen Reparaturservices",
      "Add-on Zusatzleistungen wie Datensicherung und Displayschutz",
      "Direkte Buchung des gewuenschten Reparaturservices",
    ]
  }
  return [
    "Digitale Geraetereparatur mit transparenten Prozessen",
    "Online-Kundenservice fuer Reparaturauftraege",
    "Informationsseiten zu Serviceablauf, Versand und Support",
  ]
}

const CUSTOMER_SEMANTIC_ROUTE_PATTERNS = [
  "/",
  "/home",
  "/newsletter",
  "/sitemap",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/debug",
  "/track-order",
  "/track-order/booking",
  "/guest-repair-tracking",
  "/new-order",
  "/repair-request",
  "/shop",
  "/cart",
  "/order-success",
  "/blog",
  "/blog/:id",
  "/vorabdiagnose",
  "/annahmestellen",
  "/faq",
  "/contact",
  "/kontakt",
  "/partner-werden",
  "/partner",
  "/widerrufsrecht",
  "/privacy",
  "/datenschutz",
  "/imprint",
  "/impressum",
  "/hinweise-zur-batterieentsorgung",
  "/battery-disposal-notice",
  "/terms",
  "/agb",
  "/zahlung-und-versand",
  "/shipping-and-payment",
  "/about",
  "/ueber-uns",
  "/orders",
  "/orders/:id",
  "/messages",
  "/notifications",
  "/profile",
  "/bookings",
  "/invoices",
  "/my-repair-requests",
  "/my-complaints",
  "/my-complaints/:complaintId",
  // Repair catalog landing pages
  "/reparatur/:deviceType",
  "/reparatur/:deviceType/:manufacturer",
  "/reparatur/:deviceType/:manufacturer/:model",
]

function isKnownCustomerSemanticRoute(pathname: string): boolean {
  return CUSTOMER_SEMANTIC_ROUTE_PATTERNS.some((pattern) =>
    Boolean(matchPath({ path: pattern, end: true }, pathname))
  )
}

function CustomerSemanticSeoBlock() {
  const { pathname } = useLocation()
  const baseUrl = "https://www.mcrepair.de"

  const isBackofficeRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/inspection") ||
    pathname.startsWith("/repair/workflow")

  if (isBackofficeRoute) {
    return null
  }

  if (!isKnownCustomerSemanticRoute(pathname)) {
    return null
  }

  const seoTopic = getCustomerSeoTopic(pathname)
  const seoFeatures = getCustomerSeoFeatures(pathname)
  const canonicalUrl = `${baseUrl}${pathname || "/"}`
  const seoPageName = `McRepair.de - ${seoTopic}`
  const customerPageStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: seoPageName,
    url: canonicalUrl,
    inLanguage: "de-DE",
    isPartOf: {
      "@type": "WebSite",
      name: "McRepair.de",
      url: baseUrl,
    },
    description: `McRepair.de bietet ${seoTopic} inklusive digitaler Prozesse fuer Modellauswahl, Serviceauswahl und Auftragsabwicklung.`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: seoFeatures.map((feature, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: feature,
      })),
    },
  }

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(customerPageStructuredData)}</script>
      </Helmet>
      <aside className="sr-only" aria-label="Semantische SEO-Inhalte fuer Kundenseiten">
        <p>McRepair.de bietet professionelle {seoTopic} mit transparenten Preisen und klaren Prozessen.</p>
        <p><strong>Express-Service mit Garantie:</strong> Reparaturen werden schnell, sicher und nachvollziehbar umgesetzt.</p>
        <ul>
          {seoFeatures.map((feature) => (
            <li key={feature}>{feature}.</li>
          ))}
        </ul>
        <ol>
          <li>Defekt melden oder Auftrag starten.</li>
          <li>Geraet einsenden oder vor Ort abgeben.</li>
          <li>Reparaturstatus verfolgen und Ergebnis erhalten.</li>
        </ol>
        <blockquote>
          "Wir reparieren Geraete so, wie wir unsere eigenen reparieren lassen wollen: transparent, fair und verlaesslich."
          <cite> McRepair.de Service Team</cite>
        </blockquote>
        <p><em>Hinweis:</em> Je nach Defekt werden <b>qualitativ gepruefte Ersatzteile</b> verwendet, damit die <i>Service-Qualitaet</i> langfristig erhalten bleibt.</p>
      </aside>
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="light" storageKey="ui-theme">
        <Router>
          <ScrollToTop />
          <PageTracker />
          <GlobalScrollToTopButton />
          <CustomerSemanticSeoBlock />
          {/* Public routes - accessible to all users */}
          <Routes>
            {/* Home page as default landing page for all users */}
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            {/* Repair catalog SEO landing pages – public, no auth */}
            <Route path="/reparatur/:deviceType" element={<CustomerLayout />}>
              <Route index element={<RepairCatalogPage />} />
            </Route>
            <Route path="/reparatur/:deviceType/:manufacturer" element={<CustomerLayout />}>
              <Route index element={<RepairCatalogPage />} />
            </Route>
            <Route path="/reparatur/:deviceType/:manufacturer/:model" element={<CustomerLayout />}>
              <Route index element={<RepairCatalogPage />} />
            </Route>
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/sitemap" element={<Sitemap />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/debug" element={<DebugLogin />} />

            {/* Guest tracking routes - public access with CustomerLayout */}
            <Route path="/track-order" element={<CustomerLayout />}>
              <Route index element={<GuestOrderTracking />} />
            </Route>
            <Route path="/track-order/booking" element={<CustomerLayout />}>
              <Route index element={<GuestBookingTracking />} />
            </Route>
            <Route path="/guest-repair-tracking" element={<CustomerLayout />}>
              <Route index element={<GuestRepairRequestTracking />} />
            </Route>

            {/* Customer routes */}
            {/* Public access routes - no authentication required */}
            <Route path="/new-order" element={<CustomerLayout />}>
              <Route index element={<NewOrder />} />
            </Route>
            <Route path="/repair-request" element={<CustomerLayout />}>
              <Route index element={<RepairRequestQuestionnaire />} />
            </Route>
            <Route path="/shop" element={<CustomerLayout />}>
              <Route index element={<WebShop />} />
              <Route path="product/:id" element={<ProductDetail />} />
            </Route>
            <Route path="/cart" element={<CustomerLayout />}>
              <Route index element={<ShoppingCartPage />} />
            </Route>
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/blog" element={<CustomerLayout />}>
              <Route index element={<Blog />} />
            </Route>
            <Route path="/blog/:id" element={<CustomerLayout />}>
              <Route index element={<BlogPostPage />} />
            </Route>
            <Route path="/vorabdiagnose" element={<Vorabdiagnose />} />
            <Route path="/annahmestellen" element={<Annahmestellen />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/kontakt" element={<Contact />} />
            <Route path="/partner-werden" element={<PartnerWerden />} />
            <Route path="/partner" element={<PartnerWerden />} />
            <Route path="/widerrufsrecht" element={<Widerrufsrecht />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/datenschutz" element={<Privacy />} />
            <Route path="/imprint" element={<Imprint />} />
            <Route path="/impressum" element={<Imprint />} />
            <Route path="/hinweise-zur-batterieentsorgung" element={<BatteryDisposal />} />
            <Route path="/battery-disposal-notice" element={<BatteryDisposal />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/agb" element={<Terms />} />
            <Route path="/zahlung-und-versand" element={<ShippingAndPayment />} />
            <Route path="/shipping-and-payment" element={<ShippingAndPayment />} />
            <Route path="/about" element={<About />} />
            <Route path="/ueber-uns" element={<About />} />

            {/* Protected customer routes - authentication required */}
            <Route path="/orders" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<OrderTracking />} />
            </Route>
            <Route path="/orders/:id" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<OrderDetails />} />
            </Route>
            <Route path="/messages" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<Messages />} />
            </Route>
            <Route path="/notifications" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<Notifications />} />
            </Route>
            <Route path="/profile" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<Profile />} />
            </Route>
            <Route path="/bookings" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<CustomerBookings />} />
            </Route>
            <Route path="/invoices" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<CustomerInvoices />} />
            </Route>
            <Route path="/my-repair-requests" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<CustomerRepairRequests />} />
            </Route>
            <Route path="/my-complaints" element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
              <Route index element={<CustomerComplaints />} />
              <Route path=":complaintId" element={<CustomerComplaints />} />
            </Route>

            {/* Staff routes */}
            <Route path="/staff" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<StaffDashboard />} />
            </Route>
            <Route path="/staff/orders" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<StaffOrders />} />
            </Route>
            <Route path="/staff/knowledge-base" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<KnowledgeBase />} />
            </Route>
            <Route path="/staff/time-tracking" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<TimeTracking />} />
            </Route>
            <Route path="/staff/schedule" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<Schedule />} />
            </Route>
            <Route path="/staff/chat" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<TeamChat />} />
            </Route>
            <Route path="/staff/performance" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<Performance />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
            </Route>
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<UserManagement />} />
            </Route>
            <Route path="/admin/customer-groups" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<CustomerGroupsManagement />} />
            </Route>
            <Route path="/admin/orders" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<OrderManagement />} />
            </Route>
            <Route path="/admin/bookings" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<BookingsManagement />} />
            </Route>
            <Route path="/staff/bookings" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<BookingsManagement />} />
            </Route>
            <Route path="/staff/repair-requests" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<RepairRequestsManagement />} />
            </Route>
            <Route path="/admin/shop" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<WebShopManagement />} />
            </Route>
            <Route path="/admin/services" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<ServiceManagement />} />
            </Route>
            <Route path="/admin/addons" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<AddOnServiceManagement />} />
            </Route>
            <Route path="/admin/service-categories" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<ServiceCategoryManagement />} />
            </Route>
            <Route path="/admin/devices" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<DeviceManagement />} />
            </Route>
            <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<Analytics />} />
            </Route>
            <Route path="/admin/blog" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<BlogManagement />} />
            </Route>
            <Route path="/admin/faq" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<FAQManagement />} />
            </Route>
            <Route path="/admin/homepage" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<HomepageManagement />} />
            </Route>
            <Route path="/admin/website-builder" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<WebsiteBuilder />} />
            </Route>
            <Route path="/admin/visual-builder/:pageId" element={<ProtectedRoute requiredRole="admin"><VisualPageBuilder /></ProtectedRoute>} />
            <Route path="/admin/seo" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<SEOManagement />} />
            </Route>
            <Route path="/admin/system" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<SystemConfiguration />} />
            </Route>
            <Route path="/admin/email" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<EmailAdministration />} />
            </Route>
            <Route path="/admin/live-tracking" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<TrackingLive />} />
            </Route>
            <Route path="/admin/marketing-promo" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<MarketingPromoOverview />} />
            </Route>
            <Route path="/admin/marketing-promo/newsletters" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<MarketingPromoNewsletters />} />
            </Route>
            <Route path="/admin/marketing-promo/promo-codes" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<MarketingPromoPromoCodes />} />
            </Route>
            <Route path="/admin/marketing-promo/segments" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<MarketingPromoSegments />} />
            </Route>
            <Route path="/admin/marketing-promo/reports" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<MarketingPromoReports />} />
            </Route>
            <Route path="/admin/marketing-promo/settings" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<MarketingPromoSettingsPage />} />
            </Route>
            <Route path="/admin/marketing-promo/adcell" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<AdcellTrackingPage />} />
            </Route>
            <Route path="/admin/database" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<DatabaseManagement />} />
            </Route>
            <Route path="/admin/security" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<SecuritySettings />} />
            </Route>
            <Route path="/admin/workflow" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<WorkflowManagement />} />
            </Route>
            <Route path="/admin/parts" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<PartsManagement />} />
            </Route>
            <Route path="/admin/staff" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<StaffManagement />} />
            </Route>
            <Route path="/admin/financial" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<FinancialManagement />} />
            </Route>
            <Route path="/admin/complaints" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<ComplaintsManagement />} />
            </Route>
            <Route path="/admin/epart-orders" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<EPartOrderManagement />} />
            </Route>
            <Route path="/admin/repair-requests" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<RepairRequestsManagement />} />
            </Route>
            <Route path="/admin/contact-requests" element={<ProtectedRoute requiredRole="admin"><Layout /></ProtectedRoute>}>
              <Route index element={<RepairRequestsManagement view="contact-messages" />} />
            </Route>

            {/* Inspection route */}
            <Route path="/inspection/:orderId" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<InspectionWorkflow />} />
            </Route>

            {/* Repair Workflow route */}
            <Route path="/repair/workflow/:orderNumber" element={<ProtectedRoute requiredRole={["staff", "admin"]}><Layout /></ProtectedRoute>}>
              <Route index element={<RepairWorkflowPage />} />
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