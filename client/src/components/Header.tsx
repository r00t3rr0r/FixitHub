import { LogOut } from "lucide-react"
import { Button } from "./ui/button"
import { ThemeToggle } from "./ui/theme-toggle"
import { NotificationBell } from "./NotificationBell"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"

export function Header() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  
  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const handleHomeClick = () => {
    navigate("/")
  }

  return (
    <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div
          className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
          onClick={handleHomeClick}
        >
          FixitHub
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}