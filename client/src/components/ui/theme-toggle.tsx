"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/ui/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 rounded-lg transition-colors"
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px] transition-transform duration-200" />
      ) : (
        <Moon className="h-[18px] w-[18px] transition-transform duration-200" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}