import { Smartphone, Tablet, Laptop, Watch, Headphones } from "lucide-react"

interface DeviceImageProps {
  deviceType?: string
  deviceBrand?: string
  deviceModel?: string
  photos?: string[]
  className?: string
  size?: "sm" | "md" | "lg"
}

export function DeviceImage({ 
  deviceType = "Smartphone", 
  deviceBrand, 
  deviceModel, 
  photos, 
  className = "",
  size = "md"
}: DeviceImageProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-24 h-24"
  }

  const iconSizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }

  const getDeviceIcon = (type: string) => {
    const iconClass = iconSizeClasses[size]
    
    switch (type.toLowerCase()) {
      case 'tablet':
        return <Tablet className={`${iconClass} text-primary`} />
      case 'laptop':
        return <Laptop className={`${iconClass} text-primary`} />
      case 'watch':
        return <Watch className={`${iconClass} text-primary`} />
      case 'headphones':
        return <Headphones className={`${iconClass} text-primary`} />
      default:
        return <Smartphone className={`${iconClass} text-primary`} />
    }
  }

  // If we have photos, try to display the first one
  if (photos && photos.length > 0) {
    return (
      <div className={`${sizeClasses[size]} ${className} relative`}>
        <img
          src={photos[0]}
          alt={`${deviceBrand} ${deviceModel}`}
          className="w-full h-full rounded object-cover border-2 border-primary/20"
          onError={(e) => {
            // Hide broken image and show fallback
            const target = e.currentTarget
            const parent = target.parentElement
            if (parent) {
              target.style.display = 'none'
              const fallback = parent.querySelector('.fallback-icon') as HTMLElement
              if (fallback) {
                fallback.style.display = 'flex'
              }
            }
          }}
        />
        <div 
          className={`fallback-icon ${sizeClasses[size]} rounded border-2 border-primary/20 bg-primary/10 flex items-center justify-center absolute inset-0`}
          style={{ display: 'none' }}
        >
          {getDeviceIcon(deviceType)}
        </div>
      </div>
    )
  }

  // Fallback to icon-based display
  return (
    <div className={`${sizeClasses[size]} ${className} rounded border-2 border-primary/20 bg-primary/10 flex items-center justify-center`}>
      {getDeviceIcon(deviceType)}
    </div>
  )
}