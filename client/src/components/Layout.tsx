import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { Sidebar } from "./Sidebar"
import { useIsMobile } from "@/hooks/useMobile"

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useIsMobile()

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const shouldShowSidebar = sidebarOpen

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="flex h-[calc(100vh-4rem)] pt-16">
        <Sidebar 
          isOpen={shouldShowSidebar}
          onRequestClose={() => setSidebarOpen(false)}
          isCollapsed={!sidebarOpen}
        />
        <main 
          className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ease-in-out ${
            isMobile ? 'ml-0' : (shouldShowSidebar ? 'ml-64' : 'ml-16')
          }`}
        >
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}