import { useState, useEffect } from "react"
import { useToast } from "@/hooks/useToast"
import { getUserProfile, UserProfile } from "@/api/user"
import { useIsMobile } from "@/hooks/useMobile"
import { CustomerSidebar } from "./CustomerSidebar"
import { StaffSidebar } from "./StaffSidebar"
import { AdminSidebar } from "./AdminSidebar"

interface SidebarProps {
  isOpen: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onRequestClose?: () => void
  isCollapsed: boolean
}

export function Sidebar({ isOpen, onMouseEnter, onMouseLeave, onRequestClose, isCollapsed }: SidebarProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const usesBrandedSidebar = userProfile?.role === 'admin' || userProfile?.role === 'staff'

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
        className={`fixed inset-y-0 left-0 z-40 bg-background/95 backdrop-blur-sm border-r border-border pt-16 transition-all duration-300 ease-in-out overflow-hidden ${
          isMobile
            ? (isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72')
            : (isOpen ? 'w-64' : 'w-16')
        }`}
        onMouseEnter={isMobile ? undefined : onMouseEnter}
        onMouseLeave={isMobile ? undefined : onMouseLeave}
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
    <>
      {isMobile && isOpen && (
        <button
          type="button"
          aria-label="Sidebar schließen"
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] md:hidden"
          onClick={onRequestClose}
        />
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-40 border-r pt-16 transition-all duration-300 ease-in-out overflow-hidden ${
          isMobile
            ? (isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72')
            : (isOpen ? 'w-64' : 'w-16')
        } ${
          usesBrandedSidebar 
            ? '' 
            : 'bg-background/95 backdrop-blur-sm border-border'
        }`}
        style={usesBrandedSidebar
          ? {
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%), var(--primary-blue, #1a2a5e)',
              borderColor: 'var(--primary-blue-light, #2a3f7e)',
              boxShadow: 'var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.12))'
            }
          : undefined
        }
        onMouseEnter={isMobile ? undefined : onMouseEnter}
        onMouseLeave={isMobile ? undefined : onMouseLeave}
      >
        <div className={`h-full overflow-y-auto ${
          usesBrandedSidebar 
            ? '' 
            : 'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent'
        }`}>
          {renderSidebar()}
        </div>
      </div>
    </>
  )
}