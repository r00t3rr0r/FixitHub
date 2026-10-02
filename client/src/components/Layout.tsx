import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { Sidebar } from "./Sidebar"
import { useIsMobile } from "@/hooks/useMobile"

export function Layout() {
  // Schmale Viewports (Tablet, 200 % Zoom): die Seitenleiste liegt als Overlay ueber dem Inhalt und
  // muss deshalb geschlossen starten und sich nach jeder Navigation schliessen - sonst verdeckt sie
  // bei jedem Seitenaufruf Tabs und Schaltflaechen. Desktop (>= 768 px) bleibt unveraendert offen.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768)
  const isMobile = useIsMobile()
  const location = useLocation()
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile, location.pathname])
  // ADMUX-8: Das Backoffice hat genau EINEN Scrollbereich (main). Der Marketing-Footer liegt
  // unterhalb der vollen Viewport-Hoehe und erzeugte auf /inspection, /repair/workflow und
  // /messages (Personal) einen zweiten Fenster-Scroll. Er bleibt nur auf der Kunden-Auftragsliste
  // /orders, die ebenfalls diese Shell nutzt.
  const hideFooter = !/^\/orders\/?$/.test(location.pathname)
  const isAdminAnalyticsPage = location.pathname.startsWith('/admin/analytics')

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const shouldShowSidebar = sidebarOpen

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, var(--off-white, #f8f9fc) 0%, var(--white, #ffffff) 24%, var(--gray-50, #f5f6f8) 100%)',
        fontFamily: 'var(--font-main, Inter, sans-serif)'
      }}
    >
      <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      {/* ADMUX-8: Die Header-Hoehe (4rem) wird nur EINMAL abgezogen (pt-16 bei border-box);
          vorher h-[calc(100vh-4rem)] + pt-16 = 64px ungenutzte Flaeche unter main. */}
      <div className="flex h-screen pt-16" style={{ height: '100dvh' }}>
        <Sidebar 
          isOpen={shouldShowSidebar}
          onRequestClose={() => setSidebarOpen(false)}
          isCollapsed={!sidebarOpen}
        />
        <main 
          className={`flex-1 overflow-y-scroll px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6 ${
            isMobile ? 'ml-0' : (shouldShowSidebar ? 'ml-64' : 'ml-16')
          }`}
          style={{ scrollbarGutter: 'stable both-edges' }}
        >
          <div className={isAdminAnalyticsPage ? "w-full max-w-none" : "mx-auto w-full max-w-7xl"}>
            <Outlet />
          </div>
        </main>
      </div>
      {!hideFooter && <Footer />}
    </div>
  )
}