import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { Sidebar } from "./Sidebar"
import { useIsMobile } from "@/hooks/useMobile"

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useIsMobile()
  const location = useLocation()
  const hideFooter = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff')
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
      <div className="flex h-[calc(100vh-4rem)] pt-16">
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