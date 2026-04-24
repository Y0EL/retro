import { useEffect, useRef, useState, useMemo } from "react"
import * as d3 from "d3"
import { listJobs, getGraphData } from "../lib/api"
import type { Job, GraphNode, GraphEdge } from "../lib/api"
import DetailDrawer from "../components/DetailDrawer"
import SearchBar from "../components/SearchBar"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useTheme } from "../contexts/ThemeContext"

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  type: "owns" | "found_at" | "has_email" | "context"
  sourceId: string
  targetId: string
}

// ── Visual config ─────────────────────────────────────────────────────────────
const NODE_FILL: Record<string, string> = {
  company: "#1d4ed8",
  domain:  "#15803d",
  email:   "#b45309",
}
const NODE_RING: Record<string, string> = {
  company: "#93c5fd",
  domain:  "#86efac",
  email:   "#fcd34d",
}
const NODE_R: Record<string, number> = {
  company: 34,
  domain:  26,
  email:   26,
}
const NODE_TYPE_LABEL: Record<string, string> = {
  company: "PERUSAHAAN",
  domain:  "DOMAIN",
  email:   "EMAIL",
}
const MAX_JOBS = 5
const JOB_PALETTE = ["#2563eb","#16a34a","#ea580c","#9333ea","#dc2626","#0891b2","#b45309","#65a30d"]

export default function Orkestrasi() {
  const { theme }   = useTheme()
  const svgRef      = useRef<SVGSVGElement>(null)
  const posCache    = useRef<Map<string, { x: number; y: number }>>(new Map())
  const zoomCache   = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const jobColorRef = useRef<Map<string, string>>(new Map())

  const [nodes,     setNodes]     = useState<SimNode[]>([])
  const [edges,     setEdges]     = useState<SimEdge[]>([])
  const [jobs,      setJobs]      = useState<Job[]>([])
  const [search,    setSearch]    = useState("")
  const [jobFilter, setJobFilter] = useState("all")
  const [drawer,    setDrawer]    = useState<SimNode | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [searchParams]            = useSearchParams()
  const navigate    = useNavigate()
  const jobParam    = searchParams.get("job")

  // ── 5 most-recent jobs + per-job color map ────────────────────────────────
  const recentJobs = useMemo(() =>
    [...jobs].sort((a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    ).slice(0, MAX_JOBS)
  , [jobs])

  const jobColorMap = useMemo(() => {
    const m = new Map<string, string>()
    recentJobs.forEach((j, i) => m.set(j.jobId, JOB_PALETTE[i % JOB_PALETTE.length]))
    jobColorRef.current = m
    return m
  }, [recentJobs])

  const recentJobIds = useMemo(() => new Set(recentJobs.map(j => j.jobId)), [recentJobs])

  const visibleNodes = useMemo(() => {
    if (jobFilter === "all") return nodes.filter(n => !n.jobId || recentJobIds.has(n.jobId))
    return nodes.filter(n => n.jobId === jobFilter)
  }, [nodes, jobFilter, recentJobIds])

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map(n => n.id))
    return edges.filter(e => e.type !== "context" && ids.has(e.sourceId) && ids.has(e.targetId))
  }, [edges, visibleNodes])

  // ── Fetch loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let alive = true
    async function load() {
      if (!alive) return
      if (document.visibilityState === "hidden") { timer = setTimeout(load, 10_000); return }
      try {
        const [jd, gd] = await Promise.all([listJobs(), getGraphData()])
        if (!alive) return
        const allJobs = jd.jobs || []
        setJobs(allJobs)
        let gn = (gd.nodes || []) as SimNode[]
        let ge = (gd.edges || []) as SimEdge[]
        if (jobParam) {
          const jIds = new Set(gn.filter(n => n.jobId === jobParam).map(n => n.id))
          const rel  = new Set<string>()
          ge.forEach(e => { if (jIds.has(e.sourceId) || jIds.has(e.targetId)) { rel.add(e.sourceId); rel.add(e.targetId) } })
          gn = gn.filter(n => jIds.has(n.id) || rel.has(n.id))
          ge = ge.filter(e => rel.has(e.sourceId) && rel.has(e.targetId))
        }
        setNodes(gn)
        setEdges(ge)
        const running = allJobs.some(j => j.status === "running" || j.status === "queued")
        timer = setTimeout(load, running ? 5_000 : 30_000)
      } catch {
        if (alive) timer = setTimeout(load, 30_000)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false; clearTimeout(timer) }
  }, [jobParam])

  // ── D3 force graph ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || visibleNodes.length === 0) return

    const el = svgRef.current
    const W  = el.clientWidth  || 900
    const H  = el.clientHeight || 650

    // Save zoom + positions
    try { zoomCache.current = d3.zoomTransform(el) } catch { /* first */ }
    for (const n of visibleNodes) {
      if (n.x != null && n.y != null) posCache.current.set(n.id, { x: n.x, y: n.y })
    }
    const newNodeIds = new Set(visibleNodes.filter(n => !posCache.current.has(n.id)).map(n => n.id))

    // Seed positions
    const cx = W / 2, cy = H / 2
    for (const n of visibleNodes) {
      const pos = posCache.current.get(n.id)
      if (pos) { n.x = pos.x; n.y = pos.y }
      else { n.x = cx + (Math.random() - 0.5) * 200; n.y = cy + (Math.random() - 0.5) * 200 }
    }

    // Pin existing nodes
    for (const n of visibleNodes) {
      if (!newNodeIds.has(n.id) && n.x != null) { n.fx = n.x; n.fy = n.y }
    }

    d3.select(el).selectAll("*").remove()

    const svg = d3.select(el)
    const g   = svg.append("g")

    // Theme-aware colors — read CSS variables from document root
    const cssVars  = getComputedStyle(document.documentElement)
    const canvasBg   = cssVars.getPropertyValue("--cc-abyss").trim()   || (theme === "dark" ? "#090d14" : "#f8fafc")
    const outerText  = cssVars.getPropertyValue("--cc-data-primary").trim() || (theme === "dark" ? "#c8d8e8" : "#1e293b")
    const isDark     = theme === "dark"

    svg.insert("rect", ":first-child")
      .attr("width", "100%").attr("height", "100%")
      .attr("fill", canvasBg)

    // Zoom (user only, no auto)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 6])
      .on("zoom", e => { zoomCache.current = e.transform; g.attr("transform", e.transform) })
    svg.call(zoom)
    svg.call(zoom.transform, zoomCache.current)

    // Arrowhead markers per job color
    const defs = svg.append("defs")
    const colorMap = jobColorRef.current
    const usedColors = new Set<string>()
    for (const n of visibleNodes) {
      if (n.jobId) usedColors.add(colorMap.get(n.jobId) ?? "#64748b")
    }
    usedColors.add("#64748b")
    for (const color of usedColors) {
      const sid = color.replace("#", "mk")
      defs.append("marker")
        .attr("id", `arr-${sid}`)
        .attr("viewBox", "0 -4 8 8").attr("refX", 8)
        .attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto")
        .append("path").attr("d", "M0,-4L8,0L0,4")
        .attr("fill", color).attr("opacity", 0.8)
    }

    function edgeColor(d: SimEdge): string {
      const src = d.source as SimNode
      return colorMap.get(src.jobId ?? "") ?? colorMap.get(src.id) ?? "#64748b"
    }

    // Simulation
    const sim = d3.forceSimulation<SimNode>(visibleNodes)
      .velocityDecay(0.72)          // tinggi = lebih banyak gesekan → gerakan lambat
      .force("link",    d3.forceLink<SimNode, SimEdge>(visibleEdges).id(d => d.id).distance(d => {
        const s = d.source as SimNode, t = d.target as SimNode
        return (NODE_R[s.type] ?? 26) + (NODE_R[t.type] ?? 26) + 80
      }).strength(0.4))             // link lemah → tidak menarik terlalu keras
      .force("charge",  d3.forceManyBody().strength(-280).distanceMax(400))  // repulsion lebih kecil
      .force("center",  newNodeIds.size > 0 ? d3.forceCenter(W / 2, H / 2).strength(0.015) : null)
      .force("collide", d3.forceCollide<SimNode>(n => (NODE_R[n.type] ?? 26) + 22).strength(0.7))

    if (newNodeIds.size === 0) {
      sim.alpha(0).stop()
    } else {
      // alpha rendah + alphaDecay tinggi = animasi pelan lalu cepat berhenti
      sim.alphaDecay(0.04).alpha(0.12).restart()
    }

    // Edges — glow layer (tebal + transparan) di belakang agar jelas
    g.selectAll<SVGLineElement, SimEdge>("line.edge-glow")
      .data(visibleEdges).join("line").attr("class", "edge-glow")
      .attr("stroke", edgeColor)
      .attr("stroke-width", d => d.type === "context" ? 0 : (d.type === "owns" ? 8 : 6))
      .attr("opacity", isDark ? 0.18 : 0.12)
      .attr("stroke-linecap", "round")

    // Edges — garis utama
    const link = g.selectAll<SVGLineElement, SimEdge>("line.edge")
      .data(visibleEdges).join("line").attr("class", "edge")
      .attr("stroke", edgeColor)
      .attr("stroke-width", d => d.type === "owns" ? 3 : d.type === "has_email" ? 2.5 : 2)
      .attr("stroke-dasharray", d => d.type === "found_at" ? "6,4" : "none")
      .attr("stroke-linecap", "round")
      .attr("opacity", d => d.type === "context" ? 0.2 : (isDark ? 0.92 : 0.85))
      .attr("marker-end", d => {
        const c = edgeColor(d).replace("#", "mk")
        return `url(#arr-${c})`
      })

    // Node groups
    const nodeG = g.selectAll<SVGGElement, SimNode>("g.node")
      .data(visibleNodes, d => d.id).join("g").attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y })
          .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y })
          .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = d.x; d.fy = d.y })
      )
      .on("click", (_, d) => setDrawer(d))
      .on("dblclick", (_, d) => { if (d.type === "company") navigate(`/profil/${d.id}`) })

    // Draw circles
    nodeG.each(function(d) {
      const gEl  = d3.select(this)
      const r    = NODE_R[d.type] ?? 26
      const fill = NODE_FILL[d.type] ?? "#475569"
      const ring = NODE_RING[d.type] ?? "#cbd5e1"
      const isPending   = d.pending ?? false
      const strokeColor = isDark ? "#ffffff" : "#ffffff"
      const pendingFill = isDark ? "#334155" : "#94a3b8"
      const ringOpacity = isDark ? 0.28 : 0.18

      // Glow ring
      gEl.append("circle")
        .attr("r", r + 6)
        .attr("fill", ring)
        .attr("opacity", isPending ? 0.08 : ringOpacity)

      // Main circle
      gEl.append("circle")
        .attr("r", r)
        .attr("fill", isPending ? pendingFill : fill)
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2.5)

      // Type badge inside top
      gEl.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", d.type === "company" ? -6 : -4)
        .attr("font-size", d.type === "company" ? 7.5 : 6.5)
        .attr("font-family", "Courier New, monospace")
        .attr("fill", "#ffffff")
        .attr("opacity", 0.7)
        .attr("letter-spacing", "0.06em")
        .text(d.type === "company" ? "PERUS." : d.type === "domain" ? "DOM." : "EMAIL")

      // Name inside circle
      const maxChars = Math.floor((r * 1.6) / 5.5)
      const shortLabel = d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + "…" : d.label
      gEl.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", d.type === "company" ? 7 : 6)
        .attr("font-size", d.type === "company" ? 9.5 : 8)
        .attr("font-family", "Courier New, monospace")
        .attr("fill", "#ffffff")
        .attr("font-weight", "600")
        .text(shortLabel)

      // Label outside (below circle) — uses theme text color
      const outerLabel = d.label.length > 20 ? d.label.slice(0, 19) + "…" : d.label
      gEl.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", r + 17)
        .attr("font-size", 9)
        .attr("font-family", "Courier New, monospace")
        .attr("fill", isPending ? (isDark ? "#4a6080" : "#94a3b8") : outerText)
        .attr("font-weight", d.type === "company" ? "700" : "400")
        .text(outerLabel)
    })

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .style("position", "fixed").style("pointer-events", "none")
      .style("background", "#1e293b").style("border", "1px solid #334155")
      .style("color", "#f1f5f9").style("border-radius", "4px")
      .style("padding", "8px 12px").style("font-size", "11px")
      .style("font-family", "Courier New, monospace")
      .style("opacity", 0).style("z-index", "9999")
      .style("max-width", "220px").style("line-height", "1.6")

    nodeG
      .on("mouseover", (_, d) => {
        const fill = NODE_FILL[d.type] ?? "#475569"
        tooltip.style("border-top", `3px solid ${fill}`).style("opacity", 1)
          .html(`<span style="font-size:8px;opacity:0.6">${NODE_TYPE_LABEL[d.type]}</span><br/><strong>${d.label}</strong>${d.meta?.domain ? `<br/><span style="opacity:0.6;font-size:9px">${d.meta.domain}</span>` : ""}${d.type === "company" ? `<br/><span style="font-size:8px;opacity:0.5">dblclick → profil</span>` : ""}`)
      })
      .on("mousemove", e => tooltip.style("left", (e.clientX + 14) + "px").style("top", (e.clientY - 28) + "px"))
      .on("mouseleave", () => tooltip.style("opacity", 0))

    // Tick
    function circleEdge(n: SimNode, o: SimNode): [number, number] {
      const r  = NODE_R[n.type] ?? 26
      const nx = n.x ?? 0, ny = n.y ?? 0
      const ox = o.x  ?? 0, oy = o.y  ?? 0
      const dx = ox - nx, dy = oy - ny
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      return [nx + (dx / len) * r, ny + (dy / len) * r]
    }

    // Select glow layer for tick updates
    const glowLink = g.selectAll<SVGLineElement, SimEdge>("line.edge-glow")

    function applyTick() {
      for (const n of visibleNodes) {
        if (n.x != null && n.y != null) posCache.current.set(n.id, { x: n.x, y: n.y })
      }
      const x1 = (d: SimEdge) => circleEdge(d.source as SimNode, d.target as SimNode)[0]
      const y1 = (d: SimEdge) => circleEdge(d.source as SimNode, d.target as SimNode)[1]
      const x2 = (d: SimEdge) => circleEdge(d.target as SimNode, d.source as SimNode)[0]
      const y2 = (d: SimEdge) => circleEdge(d.target as SimNode, d.source as SimNode)[1]
      glowLink.attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
      link.attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
      nodeG.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    sim.on("tick", applyTick)
    if (newNodeIds.size === 0) applyTick()

    return () => { tooltip.remove(); sim.stop() }
  }, [visibleNodes, visibleEdges, navigate, theme])

  function handleSearch(q: string) {
    setSearch(q)
    if (!q) return
    const match = visibleNodes.find(n => n.label.toLowerCase().includes(q.toLowerCase()))
    if (match) setDrawer(match)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Toolbar */}
      <div className="cc-graph-toolbar">
        <SearchBar value={search} onChange={handleSearch} placeholder="Cari entitas..." />

        <select className="cc-select" value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
          <option value="all">Semua Job (maks {MAX_JOBS})</option>
          {recentJobs.map(j => (
            <option key={j.jobId} value={j.jobId}>
              {j.jobId.slice(0, 8)}… · {j.intent.slice(0, 26)}
            </option>
          ))}
        </select>

        <span style={{ fontSize: 10, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
          {visibleNodes.length} entitas · {visibleEdges.length} relasi
        </span>

        {/* Legend — entity types only */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginLeft: "auto" }}>
          {(["company", "domain", "email"] as const).map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
              <span style={{
                width: 12, height: 12, borderRadius: "50%",
                background: NODE_FILL[t],
                display: "inline-block", flexShrink: 0,
              }} />
              {NODE_TYPE_LABEL[t]}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas — follows theme via --cc-abyss */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--cc-abyss)" }}>
        {loading ? (
          <div className="cc-loading" style={{ height: "100%", background: "var(--cc-abyss)" }}>
            <span className="cc-spinner" /> Memuat graf entitas...
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="cc-empty" style={{ height: "100%", background: "var(--cc-abyss)" }}>
            <div className="cc-empty-icon">--</div>
            <div>Belum ada entitas. Jalankan agent untuk membangun knowledge graph.</div>
          </div>
        ) : (
          <svg ref={svgRef} style={{ width: "100%", height: "100%", display: "block" }} />
        )}
      </div>

      {/* Detail drawer */}
      <DetailDrawer open={drawer !== null} title={drawer?.label ?? ""} onClose={() => setDrawer(null)}>
        {drawer && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.12em",
                  color: NODE_FILL[drawer.type] ?? "#475569",
                  background: (NODE_FILL[drawer.type] ?? "#475569") + "18",
                  padding: "2px 6px",
                  borderLeft: `2px solid ${NODE_FILL[drawer.type] ?? "#475569"}`,
                }}>
                  {NODE_TYPE_LABEL[drawer.type] ?? drawer.type.toUpperCase()}
                </span>
                {drawer.meta?.sourceTool && (
                  <span style={{ fontSize: 9, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
                    via {drawer.meta.sourceTool}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--cc-data-primary)", lineHeight: 1.3, wordBreak: "break-word" }}>
                {drawer.label}
              </div>
              {drawer.meta?.industri && (
                <div style={{ fontSize: 11, color: "var(--cc-data-tertiary)", marginTop: 3 }}>
                  {drawer.meta.industri}{drawer.meta.lokasi ? ` · ${drawer.meta.lokasi}` : ""}
                </div>
              )}
              {drawer.meta?.domain && drawer.type === "company" && (
                <div style={{ fontSize: 11, color: "var(--cc-signal-medium)", fontFamily: "var(--font-data)", marginTop: 2 }}>
                  {drawer.meta.domain}
                </div>
              )}
            </div>

            {drawer.meta?.deskripsi && (
              <><div className="cc-divider" style={{ margin: "0 0 10px" }} />
              <div style={{ fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.6, marginBottom: 12 }}>{drawer.meta.deskripsi}</div></>
            )}

            {(drawer.meta?.foundVia?.length ?? 0) > 0 && (
              <><div className="cc-divider" style={{ margin: "0 0 10px" }} />
              <div style={{ marginBottom: 12 }}>
                <div className="cc-label" style={{ marginBottom: 6 }}>DITEMUKAN LEWAT QUERY</div>
                {drawer.meta!.foundVia!.map((q, i) => (
                  <div key={i} style={{ fontSize: 10, color: "var(--cc-data-secondary)", marginBottom: 4, background: "var(--cc-elevated)", padding: "4px 8px", borderLeft: "2px solid var(--cc-signal-medium)", fontFamily: "var(--font-data)", lineHeight: 1.4 }}>
                    "{q}"
                  </div>
                ))}
              </div></>
            )}

            {(drawer.meta?.snippets?.length ?? 0) > 0 && (
              <><div className="cc-divider" style={{ margin: "0 0 10px" }} />
              <div style={{ marginBottom: 12 }}>
                <div className="cc-label" style={{ marginBottom: 6 }}>KONTEKS</div>
                {drawer.meta!.snippets!.map((s, i) => (
                  <div key={i} style={{ fontSize: 10, color: "var(--cc-data-muted)", lineHeight: 1.5, padding: "6px 8px", marginBottom: 4, background: "var(--cc-abyss)", borderLeft: "2px solid var(--cc-border-subtle)" }}>{s}</div>
                ))}
              </div></>
            )}

            {(drawer.meta?.articles?.length ?? 0) > 0 && (
              <><div className="cc-divider" style={{ margin: "0 0 10px" }} />
              <div style={{ marginBottom: 12 }}>
                <div className="cc-label" style={{ marginBottom: 6 }}>HALAMAN ({drawer.meta!.articles!.length})</div>
                {drawer.meta!.articles!.map((a, i) => (
                  <div key={i} style={{ padding: "6px 8px", marginBottom: 6, background: "var(--cc-abyss)", borderLeft: "2px solid var(--cc-border-subtle)" }}>
                    <div style={{ fontSize: 10, color: "var(--cc-data-primary)", fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{a.title || a.url}</div>
                    {a.snippet && <div style={{ fontSize: 9, color: "var(--cc-data-muted)", lineHeight: 1.4 }}>{a.snippet.slice(0, 120)}…</div>}
                    <div style={{ fontSize: 9, color: "var(--cc-signal-medium)", fontFamily: "var(--font-data)", marginTop: 3, wordBreak: "break-all" }}>{a.url}</div>
                  </div>
                ))}
              </div></>
            )}

            {drawer.jobId && (
              <><div className="cc-divider" style={{ margin: "0 0 10px" }} />
              <div style={{ fontSize: 9, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)", marginBottom: 12 }}>
                JOB {drawer.jobId.slice(0, 8)}…
              </div></>
            )}

            <div className="cc-divider" style={{ margin: "0 0 10px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {drawer.type === "company" && (
                <button className="btn-cc btn-signal" onClick={() => navigate(`/profil/${drawer.id}`)}>
                  Lihat Profil Lengkap
                </button>
              )}
              <button className="btn-cc btn-standard" onClick={() => navigate(`/command?prefill=${encodeURIComponent(drawer.label)}`)}>
                Run Agent
              </button>
              <button className="btn-cc btn-ghost" onClick={() => setDrawer(null)}>Tutup</button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}
