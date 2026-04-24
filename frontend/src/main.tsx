import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "./styles/index.css"
import "./styles/shell.css"
import App from "./App"
import { ThemeProvider } from "./contexts/ThemeContext"

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </BrowserRouter>
)
