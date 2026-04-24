import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { listJobs, getGraphData } from "../lib/api"
import type { Job, GraphNode, GraphEdge } from "../lib/api"
import DetailDrawer from "../components/DetailDrawer"
import SearchBar from "../components/SearchBar"
import { useNavigate, useSearchParams } from "react-router-dom"

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  type: "owns" | "found_at" | "has_email" | "context"
  sourceId: string
  targetId: string
}

// ── Ki-node visual config (mirrors GUIV1 ki-node card style) ─────────────────
const NODE_ACCENT: Record<string, string> = {
  company: "#5b9bd5",
  domain:  "#7898b0",
  email:   "#d4845a",
}
const NODE_HEADER_BG: Record<string, string> = {
  company: "#5b9bd518",
  domain:  "#7898b010",
  email:   "#d4845a18",
}
const NODE_LABEL: Record<string, string> = {
  company: "PERUSAHAAN",
  domain:  "DOMAIN",
  email:   "EMAIL",
}
// Card width/height
const CW: Record<string, number> = { company: 148, domain: 130, email: 140 }
const CH: Record<string, number> = { company: 52,  domain: 40,  email: 40  }

export default function Orkestrasi() {
  const svgRef                    = useRef<SVGSVGElement>(null)
  const posCache                  = useRef<Map<string, { x: number; y: number }>>(new Map())
  const zoomCache                 = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const [nodes,   setNodes]       = useState<SimNode[]>([])
  const [edges,   setEdges]       = useState<SimEdge[]>([])
  const [jobs,    setJobs]        = useState<Job[]>([])
  const [search,  setSearch]      = useState("")
  const [jobFilter, setJobFilter] = useState("all")
  const [drawer,  setDrawer]      = useState<SimNode | null>(null)
  const [loading, setLoading]     = useState(true)
  const [searchParams]            = useSearchParams()
  const navigate                  = useNavigate()
  const jobParam                  = searchParams.get("job")

  // ── Load data — single loop, visibility-aware ─────────────────────────────
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>
    let alive = true

    async function load() {
      if (!alive) return
      // Skip fetch when tab is hidden (saves requests when user switches tabs)
      if (document.visibilityState === "hidden") {
        timerId = setTimeout(load, 10_000)
        return
      }
      try {
        const [jobsData, graphData] = await Promise.all([listJobs(), getGraphData()])
        if (!alive) return

        const allJobs = jobsData.jobs || []
        setJobs(allJobs)

        let gn = (graphData.nodes || []) as SimNode[]
        let ge = (graphData.edges || []) as SimEdge[]

        if (jobParam) {
          const jobNodeIds = new Set(gn.filter(n => n.jobId === jobParam).map(n => n.id))
          const relatedIds = new Set<string>()
          ge.forEach(e => {
            if (jobNodeIds.has(e.sourceId) || jobNodeIds.has(e.targetId)) {
              relatedIds.add(e.sourceId); relatedIds.add(e.targetId)
            }
          })
          gn = gn.filter(n => jobNodeIds.has(n.id) || relatedIds.has(n.id))
          ge = ge.filter(e => relatedIds.has(e.sourceId) && relatedIds.has(e.targetId))
        }

        setNodes(gn)
        setEdges(ge)

        const hasRunning = allJobs.some(j => j.status === "running" || j.status === "queued")
        timerId = setTimeout(load, hasRunning ? 5_000 : 30_000)
      } catch {
        if (alive) timerId = setTimeout(load, 30_000)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false; clearTimeout(timerId) }
  }, [jobParam])

  // ── D3 force simulation — ki-node entity cards ───────────────────────────
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const el = svgRef.current
    const W  = el.clientWidth  || 800
    const H  = el.clientHeight || 600

    // ── Save current zoom + node positions before clearing ──────────────────
    try { zoomCache.current = d3.zoomTransform(el) } catch { /* first render */ }
    for (const n of nodes) {
      if (n.x != null && n.y != null) posCache.current.set(n.id, { x: n.x, y: n.y })
    }
    const newNodeIds = new Set(nodes.filter(n => !posCache.current.has(n.id)).map(n => n.id))

    // Seed positions: restore cached, place new nodes near cluster centre
    const cx = W / 2, cy = H / 2
    for (const n of nodes) {
      const pos = posCache.current.get(n.id)
      if (pos) { n.x = pos.x; n.y = pos.y }
      else { n.x = cx + (Math.random() - 0.5) * 300; n.y = cy + (Math.random() - 0.5) * 300 }
    }

    // Pin existing nodes so they don't move — only new nodes get animated
    for (const n of nodes) {
      if (!newNodeIds.has(n.id) && n.x != null) { n.fx = n.x; n.fy = n.y }
    }

    d3.select(el).selectAll("*").remove()

    const svg = d3.select(el)
    const g   = svg.append("g")

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", e => { zoomCache.current = e.transform; g.attr("transform", e.transform) })
    svg.call(zoom)
    // Restore camera — never auto-move user's view
    svg.call(zoom.transform, zoomCache.current)

    // Arrowhead defs per edge type
    const defs = svg.append("defs")
    const ARROW_COLORS: Record<string, string> = {
      owns:      "#5b9bd5",
      has_email: "#d4845a",
      found_at:  "#7898b0",
      context:   "#4a7090",
    }
    for (const [type, color] of Object.entries(ARROW_COLORS)) {
      defs.append("marker")
        .attr("id", `arrow-${type}`)
        .attr("viewBox", "0 -4 8 8").attr("refX", 8)
        .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
        .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", color).attr("opacity", 1)
    }

    // Simulation — only animate new nodes; freeze everything else
    const sim = d3.forceSimulation<SimNode>(nodes)
      .force("link",    d3.forceLink<SimNode, SimEdge>(edges).id(d => d.id).distance(180))
      .force("charge",  d3.forceManyBody().strength(-400))
      .force("center",  newNodeIds.size > 0 ? d3.forceCenter(W / 2, H / 2).strength(0.04) : null)
      .force("collide", d3.forceCollide(90))

    if (newNodeIds.size === 0) {
      sim.alpha(0).stop()
    } else {
      sim.alphaDecay(0.06).alpha(0.25).restart()
    }

    // Edges
    const link = g.selectAll<SVGLineElement, SimEdge>("line.edge")
      .data(edges).join("line").attr("class", "edge")
      .attr("stroke", d => ARROW_COLORS[d.type] ?? "#4a7090")
      .attr("stroke-width", d => {
        if (d.type === "owns")      return 2.5
        if (d.type === "has_email") return 2
        if (d.type === "found_at")  return 1.8
        return 1.5   // context
      })
      .attr("stroke-dasharray", d => d.type === "found_at" ? "6,3" : "none")
      .attr("marker-end", d => `url(#arrow-${d.type})`)
      .attr("opacity", d => {
        if (d.type === "owns")      return 0.9
        if (d.type === "has_email") return 0.85
        if (d.type === "found_at")  return 0.7
        return 0.45  // context — visible but secondary
      })

    // Edge label
    const edgeLabel = g.selectAll<SVGTextElement, SimEdge>("text.elabel")
      .data(edges).join("text").attr("class", "elabel")
      .attr("text-anchor", "middle").attr("font-size", 8)
      .attr("font-family", "Courier New, monospace")
      .attr("fill", d => ARROW_COLORS[d.type] ?? "#4a7090")
      .attr("opacity", d => d.type === "context" ? 0.4 : 0.8)
      .text(d => d.type === "owns" ? "owns" : d.type === "has_email" ? "email" : d.type === "found_at" ? "at" : "ctx")

    // Node groups
    const nodeG = g.selectAll<SVGGElement, SimNode>("g.node")
      .data(nodes, d => d.id).join("g").attr("class", "node")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y })
          .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y })
          // Pin the node at drop position — never release (stays still after drag)
          .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = d.x; d.fy = d.y })
      )
      .on("click", (_, d) => setDrawer(d))
      .on("dblclick", (_, d) => { if (d.type === "company") navigate(`/profil/${d.id}`) })

    // Build ki-node card per entity
    nodeG.each(function(d) {
      const gEl      = d3.select(this)
      const w        = CW[d.type] ?? 130
      const h        = CH[d.type] ?? 40
      const accent   = NODE_ACCENT[d.type]  ?? "#445060"
      const headerBg = NODE_HEADER_BG[d.type] ?? "#1a2130"
      const typeLabel = NODE_LABEL[d.type] ?? d.type.toUpperCase()
      const isPending = d.pending ?? false
      const hw = w / 2; const hh = h / 2

      // Outer border (selection glow placeholder)
      gEl.append("rect")
        .attr("x", -hw).attr("y", -hh)
        .attr("width", w).attr("height", h)
        .attr("fill", "#0d1117")
        .attr("stroke", accent + (isPending ? "44" : "88"))
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", isPending ? "5,3" : "none")

      // Header strip (top ~14px)
      const headerH = 14
      gEl.append("rect")
        .attr("x", -hw).attr("y", -hh)
        .attr("width", w).attr("height", headerH)
        .attr("fill", headerBg)

      // Left accent line
      gEl.append("rect")
        .attr("x", -hw).attr("y", -hh)
        .attr("width", 3).attr("height", h)
        .attr("fill", accent).attr("opacity", isPending ? 0.3 : 0.9)

      // Type label in header
      gEl.append("text")
        .attr("x", -hw + 7).attr("y", -hh + 10)
        .attr("font-size", 7).attr("font-family", "Courier New, monospace")
        .attr("fill", accent).attr("font-weight", "700")
        .attr("letter-spacing", "0.12em")
        .text(typeLabel)

      // Pending badge
      if (isPending) {
        gEl.append("text")
          .attr("x", hw - 5).attr("y", -hh + 10)
          .attr("font-size", 6).attr("font-family", "Courier New, monospace")
          .attr("fill", accent).attr("opacity", 0.5)
          .attr("text-anchor", "end")
          .text("…")
      }

      // Main label
      const maxChars = Math.floor((w - 14) / 5.8)
      const mainLabel = d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + "…" : d.label
      gEl.append("text")
        .attr("x", -hw + 7).attr("y", -hh + headerH + 12)
        .attr("font-size", d.type === "company" ? 10 : 9)
        .attr("font-family", "Courier New, monospace")
        .attr("fill", isPending ? "#445060" : (d.type === "company" ? "#c8d8e8" : "#8898a8"))
        .attr("font-weight", d.type === "company" ? "600" : "400")
        .text(mainLabel)

      // Sub-line (meta)
      if (d.type === "company" && d.meta?.domain) {
        const sub = String(d.meta.domain)
        gEl.append("text")
          .attr("x", -hw + 7).attr("y", -hh + headerH + 24)
          .attr("font-size", 7).attr("font-family", "Courier New, monospace")
          .attr("fill", "#445060")
          .text(sub.slice(0, 22))
      }
      if (d.type === "email") {
        gEl.append("text")
          .attr("x", -hw + 7).attr("y", -hh + headerH + 22)
          .attr("font-size", 7).attr("font-family", "Courier New, monospace")
          .attr("fill", "#5a3020")
          .text("contact")
      }
    })

    // Tooltip
    const tooltip = d3.select("body").append("div")
      .style("position", "fixed")
      .style("background", "#0d1117")
      .style("border", "1px solid #253040")
      .style("border-left", d => `3px solid ${NODE_ACCENT[d as unknown as string] ?? "#5b9bd5"}`)
      .style("padding", "8px 12px")
      .style("font-size", "11px").style("font-family", "Courier New, monospace")
      .style("color", "#c8d8e8").style("pointer-events", "none")
      .style("opacity", 0).style("z-index", 9999)
      .style("max-width", "240px").style("line-height", "1.6")

    nodeG
      .on("mouseover", (_, d) => {
        const accent = NODE_ACCENT[d.type] ?? "#5b9bd5"
        const extra  = d.type === "company" ? `<br/><span style="color:#445060;font-size:9px">dbl-click → profil lengkap</span>` : ""
        tooltip
          .style("border-left", `3px solid ${accent}`)
          .style("opacity", 1)
          .html(`<span style="color:${accent};font-size:9px;letter-spacing:.12em">${NODE_LABEL[d.type]}</span><br/><strong>${d.label}</strong>${d.meta?.domain ? `<br/><span style="color:#445060;font-size:9px">${d.meta.domain}</span>` : ""}${extra}`)
      })
      .on("mousemove", e => {
        tooltip.style("left", (e.clientX + 14) + "px").style("top", (e.clientY - 28) + "px")
      })
      .on("mouseleave", () => tooltip.style("opacity", 0))

    // Tick — attach edge endpoints to card edges
    function cardEdge(node: SimNode, other: SimNode): [number, number] {
      const w  = CW[node.type] ?? 130; const h = CH[node.type] ?? 40
      const nx = node.x ?? 0; const ny = node.y ?? 0
      const ox = other.x ?? 0; const oy = other.y ?? 0
      const dx = ox - nx; const dy = oy - ny
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const sx = dx / len; const sy = dy / len
      const tx = Math.abs(sx) > 1e-9 ? (w / 2) / Math.abs(sx) : Infinity
      const ty = Math.abs(sy) > 1e-9 ? (h / 2) / Math.abs(sy) : Infinity
      const t  = Math.min(tx, ty)
      return [nx + sx * t, ny + sy * t]
    }

    function applyTick() {
      // Keep posCache up-to-date on every tick so positions survive API refreshes
      for (const n of nodes) {
        if (n.x != null && n.y != null) posCache.current.set(n.id, { x: n.x, y: n.y })
      }

      link
        .attr("x1", d => cardEdge(d.source as SimNode, d.target as SimNode)[0])
        .attr("y1", d => cardEdge(d.source as SimNode, d.target as SimNode)[1])
        .attr("x2", d => cardEdge(d.target as SimNode, d.source as SimNode)[0])
        .attr("y2", d => cardEdge(d.target as SimNode, d.source as SimNode)[1])

      edgeLabel
        .attr("x", d => (((d.source as SimNode).x ?? 0) + ((d.target as SimNode).x ?? 0)) / 2)
        .attr("y", d => (((d.source as SimNode).y ?? 0) + ((d.target as SimNode).y ?? 0)) / 2 - 5)

      nodeG.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    }

    sim.on("tick", applyTick)

    // If sim is stopped (no new nodes), fire one layout pass so SVG elements get positioned
    if (newNodeIds.size === 0) applyTick()

    return () => { tooltip.remove(); sim.stop() }
  }, [nodes, edges, navigate])

  function handleSearch(q: string) {
    setSearch(q)
    if (!q || !svgRef.current) return
    const match = nodes.find(n => n.label.toLowerCase().includes(q.toLowerCase()))
    if (match) setDrawer(match)
  }

  const displayNodes = jobFilter === "all"
    ? nodes
    : nodes.filter(n => n.jobId === jobFilter)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div className="cc-graph-toolbar">
        <SearchBar value={search} onChange={handleSearch} placeholder="Cari entitas (perusahaan, domain, email)..." />
        <select className="cc-select" value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
          <option value="all">Semua Job</option>
          {jobs.map(j => (
            <option key={j.jobId} value={j.jobId}>{j.jobId.slice(0, 10)}… — {j.intent.slice(0, 30)}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
            {displayNodes.length} entitas · {edges.length} relasi
          </span>
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
          {Object.entries(NODE_LABEL).map(([type, label]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--cc-data-muted)" }}>
              <span style={{ width: 8, height: 8, background: NODE_ACCENT[type], display: "inline-block" }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--cc-abyss)" }}>
        {loading ? (
          <div className="cc-loading" style={{ height: "100%" }}>
            <span className="cc-spinner" /> Memuat graf entitas...
          </div>
        ) : nodes.length === 0 ? (
          <div className="cc-empty" style={{ height: "100%" }}>
            <div className="cc-empty-icon">--</div>
            <div>Belum ada entitas. Jalankan agent Discovery untuk membangun knowledge graph.</div>
          </div>
        ) : (
          <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        )}
      </div>

      {/* Detail drawer */}
      <DetailDrawer
        open={drawer !== null}
        title={drawer?.label ?? ""}
        onClose={() => setDrawer(null)}
      >
        {drawer && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Entity header */}
            <div style={{ padding: "0 0 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.12em",
                  color: NODE_ACCENT[drawer.type], background: NODE_ACCENT[drawer.type] + "18",
                  padding: "2px 6px", borderLeft: `2px solid ${NODE_ACCENT[drawer.type]}`,
                }}>
                  {NODE_LABEL[drawer.type]}
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

            {/* Description */}
            {drawer.meta?.deskripsi && (
              <>
                <div className="cc-divider" style={{ margin: "0 0 10px" }} />
                <div style={{ fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
                  {drawer.meta.deskripsi}
                </div>
              </>
            )}

            {/* Found via queries */}
            {(drawer.meta?.foundVia?.length ?? 0) > 0 && (
              <>
                <div className="cc-divider" style={{ margin: "0 0 10px" }} />
                <div style={{ marginBottom: 12 }}>
                  <div className="cc-label" style={{ marginBottom: 6 }}>DITEMUKAN LEWAT QUERY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {drawer.meta!.foundVia!.map((q, i) => (
                      <div key={i} style={{
                        fontSize: 10, color: "var(--cc-data-secondary)",
                        background: "var(--cc-elevated)", padding: "4px 8px",
                        borderLeft: "2px solid var(--cc-signal-medium)",
                        fontFamily: "var(--font-data)", lineHeight: 1.4,
                      }}>
                        "{q}"
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* News/web snippets for companies */}
            {(drawer.meta?.snippets?.length ?? 0) > 0 && (
              <>
                <div className="cc-divider" style={{ margin: "0 0 10px" }} />
                <div style={{ marginBottom: 12 }}>
                  <div className="cc-label" style={{ marginBottom: 6 }}>KONTEKS BERITA</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {drawer.meta!.snippets!.map((s, i) => (
                      <div key={i} style={{
                        fontSize: 10, color: "var(--cc-data-muted)",
                        lineHeight: 1.5, padding: "6px 8px",
                        background: "var(--cc-abyss)",
                        borderLeft: "2px solid var(--cc-border-subtle)",
                      }}>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Articles for domain nodes */}
            {(drawer.meta?.articles?.length ?? 0) > 0 && (
              <>
                <div className="cc-divider" style={{ margin: "0 0 10px" }} />
                <div style={{ marginBottom: 12 }}>
                  <div className="cc-label" style={{ marginBottom: 6 }}>
                    HALAMAN DITEMUKAN ({drawer.meta!.articles!.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {drawer.meta!.articles!.map((a, i) => (
                      <div key={i} style={{
                        padding: "6px 8px", background: "var(--cc-abyss)",
                        borderLeft: "2px solid var(--cc-border-subtle)",
                      }}>
                        <div style={{ fontSize: 10, color: "var(--cc-data-primary)", fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>
                          {a.title || a.url}
                        </div>
                        {a.snippet && (
                          <div style={{ fontSize: 9, color: "var(--cc-data-muted)", lineHeight: 1.4 }}>
                            {a.snippet.slice(0, 120)}{a.snippet.length > 120 ? "…" : ""}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: "var(--cc-signal-medium)", fontFamily: "var(--font-data)", marginTop: 3, wordBreak: "break-all" }}>
                          {a.url}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Job provenance */}
            {drawer.jobId && (
              <>
                <div className="cc-divider" style={{ margin: "0 0 10px" }} />
                <div style={{ fontSize: 9, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)", marginBottom: 12 }}>
                  JOB {drawer.jobId.slice(0, 8)}…
                </div>
              </>
            )}

            {/* Actions */}
            <div className="cc-divider" style={{ margin: "0 0 10px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {drawer.type === "company" && (
                <button className="btn-cc btn-signal" onClick={() => navigate(`/profil/${drawer.id}`)}>
                  Lihat Profil Lengkap
                </button>
              )}
              <button
                className="btn-cc btn-standard"
                onClick={() => navigate(`/command?prefill=${encodeURIComponent(drawer.label)}`)}
              >
                Run Discovery
              </button>
              <button className="btn-cc btn-ghost" onClick={() => setDrawer(null)}>
                Tutup
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}
