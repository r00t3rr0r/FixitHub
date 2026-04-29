import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { ChevronUp } from "lucide-react"

const SMALL_DISPLAY_QUERY = "(max-width: 1024px)"
const SHOW_AFTER_SCROLL_PX = 220

export function GlobalScrollToTopButton() {
  const { pathname } = useLocation()
  const [isSmallDisplay, setIsSmallDisplay] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(SMALL_DISPLAY_QUERY)

    const handleMediaChange = () => {
      const small = mediaQuery.matches
      setIsSmallDisplay(small)
      if (!small) {
        setIsVisible(false)
      }
    }

    handleMediaChange()
    mediaQuery.addEventListener("change", handleMediaChange)

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange)
    }
  }, [])

  useEffect(() => {
    if (!isSmallDisplay) {
      return
    }

    let ticking = false

    const updateVisibility = () => {
      setIsVisible(window.scrollY > SHOW_AFTER_SCROLL_PX)
      ticking = false
    }

    const handleScroll = () => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(updateVisibility)
      }
    }

    updateVisibility()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [isSmallDisplay, pathname])

  if (!isSmallDisplay || !isVisible) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[calc(env(safe-area-inset-right)+0.75rem)] z-[998] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#1a2a5e] text-white shadow-lg transition-opacity duration-200 hover:bg-[#f5b800] hover:text-[#1a2a5e]"
      aria-label="Nach oben scrollen"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  )
}