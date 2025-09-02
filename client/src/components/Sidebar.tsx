import { useState, useEffect } from "react"
import { useToast } from "@/hooks/useToast"
import { getUserProfile, UserProfile } from "@/api/user"
import { CustomerSidebar } from "./CustomerSidebar"
import { StaffSidebar } from "./StaffSidebar"
import { AdminSidebar } from "./AdminSidebar"

interface SidebarProps {
  isOpen: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  isCollapsed: boolean
}

export function Sidebar({ isOpen, onMouseEnter, onMouseLeave, isCollapsed }: SidebarProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

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
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [toast])

  if (loading) {
    return (
      <div 
        className={`fixed inset-y-0 left-0 z-40 bg-background/95 backdrop-blur-sm border-r border-border pt-16 transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64' : 'w-16'
        } lg:w-64`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  const renderSidebar = () => {
    switch (userProfile?.role) {
      case 'admin':
        return <AdminSidebar isCollapsed={isCollapsed} />
      case 'staff':
        return <StaffSidebar isCollapsed={isCollapsed} />
      case 'customer':
      default:
        return <CustomerSidebar isCollapsed={isCollapsed} />
    }
  }

  return (
    <div 
      className={`fixed inset-y-0 left-0 z-40 bg-background/95 backdrop-blur-sm border-r border-border pt-16 transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen ? 'w-64' : 'w-16'
      } lg:w-64`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {renderSidebar()}
      </div>
    </div>
  )
}