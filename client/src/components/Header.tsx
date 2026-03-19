import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { NotificationBell } from "@/components/NotificationBell"
import { LanguageSelector } from "@/components/LanguageSelector"
import { useAuth } from "@/contexts/AuthContext"
import { getUserProfile, UserProfile } from "@/api/user"
import { useToast } from "@/hooks/useToast"
import { Menu, X } from "lucide-react"

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const isAdminHeader = userProfile?.role === "admin"

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await getUserProfile()
        setUserProfile((response as any).user)
      } catch (error) {
        console.error("Error fetching user profile:", error)
        toast({
          title: "Error",
          description: "Failed to load user profile",
          variant: "destructive"
        })
      }
    }

    fetchUserProfile()
  }, [toast])

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 border-b ${
        isAdminHeader
          ? "bg-gradient-to-r from-[#1a2a5e] to-[#2a3f7e] border-[#2a3f7e]"
          : "bg-background/95 backdrop-blur-sm border-border"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className={`h-9 w-9 rounded-lg transition-colors ${isAdminHeader ? "text-white hover:bg-white/10 hover:text-white" : ""}`}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link to="/" className="flex items-center space-x-2">
            <div className={`font-extrabold text-lg sm:text-xl leading-none ${isAdminHeader ? "text-white" : "text-[#1a2a5e] dark:text-foreground"}`}>
              Mc<span className="text-[#f5b800]">Repair</span>.de
            </div>
          </Link>
        </div>

        <div className={`flex items-center gap-1 ${isAdminHeader ? "[&_button]:text-white [&_button]:hover:bg-white/10 [&_button]:hover:text-white" : ""}`}>
          <NotificationBell />
          <LanguageSelector />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={`relative h-9 w-9 rounded-lg transition-colors ${isAdminHeader ? "text-white hover:bg-white/10" : ""}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={userProfile?.avatar} alt={userProfile?.name} />
                  <AvatarFallback>
                    {userProfile?.name ? getInitials(userProfile.name) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {userProfile?.name || "User"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {userProfile?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">{t('navigation.profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                {t('navigation.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}