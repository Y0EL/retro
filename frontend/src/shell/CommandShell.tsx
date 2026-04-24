import { useState } from "react"
import { useGlobalKeyboard } from "../hooks/useGlobalKeyboard"
import GlobalCursor from "./GlobalCursor"
import GlobalContextMenu from "./GlobalContextMenu"
import GlobalHeader from "./GlobalHeader"
import GlobalLeftRail from "./GlobalLeftRail"
import GlobalFooter from "./GlobalFooter"

export default function CommandShell({ children }: { children: React.ReactNode }) {
  const [railOpen, setRailOpen] = useState(false)

  useGlobalKeyboard()

  function toggleRail() { setRailOpen(v => !v) }

  return (
    <div className="cc-shell">
      <GlobalCursor />
      <GlobalContextMenu />
      <GlobalHeader onToggleRail={toggleRail} railOpen={railOpen} />
      <GlobalLeftRail open={railOpen} onClose={toggleRail} />
      <main className={`cc-canvas${railOpen ? " cc-canvas--rail-open" : ""}`}>
        {children}
      </main>
      <GlobalFooter />
    </div>
  )
}
