import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeCtx { theme: Theme; toggleTheme: () => void }

const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem("retro-theme") as Theme) || "dark"
  )

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("retro-theme", theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === "dark" ? "light" : "dark")
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
