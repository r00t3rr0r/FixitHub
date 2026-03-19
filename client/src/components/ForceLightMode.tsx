import { useEffect, useRef } from "react"
import { useTheme } from "@/components/ui/theme-provider"

/**
 * Forces light mode while mounted. Restores the user's saved theme on unmount.
 * Used on public/homepage pages where dark mode should not apply.
 */
export function ForceLightMode() {
  const { theme } = useTheme()
  const themeRef = useRef(theme)

  // Keep ref in sync with latest theme value
  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    const root = document.documentElement

    // Force light mode
    root.classList.remove("dark")
    root.classList.add("light")

    return () => {
      // Restore the user's actual theme preference when leaving
      const saved = themeRef.current
      root.classList.remove("light", "dark")
      if (saved === "dark") {
        root.classList.add("dark")
      } else if (saved === "system") {
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        root.classList.add(systemDark ? "dark" : "light")
      } else {
        root.classList.add("light")
      }
    }
  }, [])

  return null
}
