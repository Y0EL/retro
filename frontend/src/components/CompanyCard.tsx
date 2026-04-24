import { useNavigate } from "react-router-dom"

interface Props {
  id?: string
  name: string
  domain?: string
  industry?: string
  meta?: string
  onClick?: () => void
}

export default function CompanyCard({ id, name, domain, industry, meta, onClick }: Props) {
  const navigate = useNavigate()

  function handle() {
    if (onClick) { onClick(); return }
    if (id) navigate(`/profil/${id}`)
  }

  return (
    <div className="cc-company-card" onClick={handle}>
      <div className="cc-company-name">{name}</div>
      {domain   && <div className="cc-company-domain">{domain}</div>}
      <div className="cc-company-meta">
        {industry && <div>{industry}</div>}
        {meta     && <div style={{ color: "var(--cc-data-muted)", fontSize: 10 }}>{meta}</div>}
      </div>
    </div>
  )
}
