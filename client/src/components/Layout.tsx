import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { Sidebar } from "./Sidebar"

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarHovered, setSidebarHovered] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const shouldShowSidebar = sidebarOpen || sidebarHovered

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <Header onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="flex h-[calc(100vh-4rem)] pt-16">
        <Sidebar 
          isOpen={shouldShowSidebar}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
          isCollapsed={!sidebarOpen && !sidebarHovered}
        />
        <main 
          className={`flex-1 overflow-y-auto p-6 transition-all duration-300 ease-in-out ${
            shouldShowSidebar ? 'ml-64' : 'ml-16'
          } lg:ml-64`}
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