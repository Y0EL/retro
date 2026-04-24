import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/", { replace: true })
  }, [isAuthenticated, loading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    const result = await login(username, password)
    setBusy(false)
    if (result.ok) navigate("/", { replace: true })
    else setError(result.error ?? "Username atau password salah")
  }

  if (loading) return null

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06090f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial, Helvetica, sans-serif",
      cursor: "none",
    }}>
      <style>{`
        .lf-input {
          width: 100%;
          box-sizing: border-box;
          background: #0d1520;
          border: 1px solid #1e2d3d;
          color: #e8f0f8;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 15px;
          padding: 12px 14px;
          outline: none;
          transition: border-color 0.15s;
          border-radius: 0;
        }
        .lf-input:focus {
          border-color: #5b9bd5;
        }
        .lf-input::placeholder {
          color: #2a3a4a;
        }
        .lf-btn {
          width: 100%;
          padding: 13px;
          background: #5b9bd5;
          border: none;
          color: #06090f;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: none;
          transition: background 0.15s, opacity 0.15s;
          border-radius: 0;
        }
        .lf-btn:hover:not(:disabled) {
          background: #7ab5e5;
        }
        .lf-btn:disabled {
          opacity: 0.45;
          cursor: none;
        }
      `}</style>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        padding: "0 24px",
      }}>
        {/* Brand */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#e8f0f8",
            letterSpacing: "-0.01em",
            lineHeight: 1,
            marginBottom: 8,
          }}>
            belum ada namanya
          </div>
          <div style={{
            fontSize: 13,
            color: "#4a6880",
            letterSpacing: "0.01em",
          }}>
            PT Gemilang Satria Perkasa | B2B Intelligence Platform
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #1e2d3d", marginBottom: 32 }} />

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#8aaac8",
              marginBottom: 8,
              letterSpacing: "0.04em",
            }}>
              USERNAME
            </label>
            <input
              className="lf-input"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Masukkan username"
            />
          </div>

          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#8aaac8",
              marginBottom: 8,
              letterSpacing: "0.04em",
            }}>
              PASSWORD
            </label>
            <input
              className="lf-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Masukkan password"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 13,
              color: "#c8604a",
              padding: "10px 14px",
              background: "#1a0a08",
              border: "1px solid #3a1a14",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="lf-btn"
          >
            {busy ? "Memverifikasi..." : "Masuk"}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 32,
          borderTop: "1px solid #1e2d3d",
          paddingTop: 20,
          fontSize: 11,
          color: "#253040",
          textAlign: "center",
        }}>
          ini footernya
        </div>
      </div>
    </div>
  )
}
