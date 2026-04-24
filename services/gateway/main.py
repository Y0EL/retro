"""
RETRO Gateway Service — satu port untuk semua tool calls.
Jalankan: uvicorn services.gateway.main:app --port 8000 --reload
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional
import asyncio
import structlog
import json
import pathlib

app = FastAPI(title="RETRO Gateway")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
log = structlog.get_logger()


def ok(data: Any):
    return {"success": True, "data": data, "error": None}


def err(e: Exception):
    return {"success": False, "data": None, "error": str(e)}


# ── Request / Response ────────────────────────────────────────────────────────

class ToolRequest(BaseModel):
    name: str
    input: dict = {}


# ── Individual endpoint models ────────────────────────────────────────────────

class FetchReq(BaseModel):
    url: str
    timeout: int = 30

class BatchReq(BaseModel):
    urls: list[str]
    concurrency: int = 10

class TextReq(BaseModel):
    text: str
    language: Optional[str] = "auto"

class ProfileReq(BaseModel):
    company_name: str
    text: str
    language: Optional[str] = "auto"

class SynthesizeReq(BaseModel):
    profiles: list[dict]

class ProposeReq(BaseModel):
    profile: dict
    synthesis: dict
    author: Optional[str] = "PT GSP"

class BriefingReq(BaseModel):
    company_name: str
    domain: Optional[str] = None
    context: Optional[str] = ""

class SearchNewsReq(BaseModel):
    query: str
    language: Optional[str] = "auto"
    max_items: int = 15
    timespan: str = "7d"

class SearchWebReq(BaseModel):
    query: str
    max_results: int = 10
    region: str = "id-id"

class DomainReq(BaseModel):
    domain: str

class RenderReq(BaseModel):
    data: dict
    theme: Optional[str] = "light"

class SaveReq(BaseModel):
    run_data: dict

class IPIntelReq(BaseModel):
    ip: str

class URLScanReq(BaseModel):
    url: str

class DomainRepReq(BaseModel):
    domain: str

class SanctionsReq(BaseModel):
    name: str
    type: Optional[str] = "company"

class CompanyLookupReq(BaseModel):
    name: str
    jurisdiction: Optional[str] = "id"

class ThreatIntelReq(BaseModel):
    indicator: str
    type: Optional[str] = "domain"

class WaybackReq(BaseModel):
    url: str

class GeoReq(BaseModel):
    query: str


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "gateway"}


@app.get("/files/{filename}")
def download_file(filename: str):
    from retro.config import get_settings
    cfg = get_settings()
    path = pathlib.Path(cfg.output_dir) / filename
    if not path.exists() or not path.is_file():
        return JSONResponse(status_code=404, content={"error": "File not found"})
    # Hanya izinkan file dari output_dir (security: no path traversal)
    if not str(path.resolve()).startswith(str(pathlib.Path(cfg.output_dir).resolve())):
        return JSONResponse(status_code=403, content={"error": "Forbidden"})
    media = "application/pdf" if filename.endswith(".pdf") else "application/octet-stream"
    return FileResponse(path=str(path), media_type=media, filename=filename)


# ── Crawler ──────────────────────────────────────────────────────────────────

@app.post("/fetch")
async def fetch(req: FetchReq):
    import asyncio
    from retro.tools import smart_fetch, parse_text
    log.info("fetch", url=req.url)
    try:
        if not req.url.startswith("http"):
            req.url = "https://" + req.url
        # Run in thread — isolates asyncio.run() calls (playwright) from FastAPI event loop
        raw = await asyncio.to_thread(smart_fetch, req.url)
        text = parse_text(raw.get("html", "")) if raw.get("success") else ""
        return ok({"url": req.url, "text": text, "text_length": len(text),
                   "success": raw.get("success", False), "status_code": raw.get("status_code", 0),
                   "tool_used": raw.get("tool", "unknown"), "error": raw.get("error")})
    except Exception as e:
        log.error("fetch_failed", error=str(e))
        return JSONResponse(status_code=500, content=err(e))


@app.post("/fetch-batch")
async def fetch_batch(req: BatchReq):
    import asyncio
    from retro.tools import smart_fetch, parse_text
    sem = asyncio.Semaphore(req.concurrency)

    async def _one(url: str):
        async with sem:
            try:
                if not url.startswith("http"):
                    url = "https://" + url
                loop = asyncio.get_event_loop()
                raw = await loop.run_in_executor(None, smart_fetch, url)
                text = parse_text(raw.get("html", "")) if raw.get("success") else ""
                return {"url": url, "text": text, "text_length": len(text),
                        "success": raw.get("success", False), "tool_used": raw.get("tool", "unknown"), "error": raw.get("error")}
            except Exception as e:
                return {"url": url, "text": "", "text_length": 0, "success": False, "tool_used": "none", "error": str(e)}

    results = await asyncio.gather(*[_one(u) for u in req.urls])
    return ok({"results": list(results), "total": len(results),
               "success_count": sum(1 for r in results if r["success"])})


# ── Extraction ────────────────────────────────────────────────────────────────

@app.post("/entities")
async def entities(req: TextReq):
    from retro.tools import extract_entities, detect_language
    try:
        ents = extract_entities(req.text)
        lang = detect_language(req.text)
        return ok({**ents, "language": lang, "word_count": len(req.text.split())})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/detect-lang")
async def detect_lang(req: TextReq):
    from retro.tools import detect_language
    try:
        return ok({"language": detect_language(req.text)})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/extract-emails")
async def extract_emails(req: TextReq):
    from retro.tools import extract_emails_from_text
    try:
        emails = extract_emails_from_text(req.text)
        return ok({"emails": emails, "count": len(emails)})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


# ── LLM helpers ───────────────────────────────────────────────────────────────

def _llm_client():
    """Buat instructor client — Ollama jika use_ollama=True, fallback ke Groq."""
    from retro.config import get_settings
    import instructor
    cfg = get_settings()
    if cfg.use_ollama:
        from openai import OpenAI
        return instructor.from_openai(
            OpenAI(base_url=cfg.ollama_url, api_key="ollama"),
            mode=instructor.Mode.JSON,
        ), cfg.ollama_model
    else:
        import groq
        return instructor.from_groq(
            groq.Groq(api_key=cfg.groq_api_key),
            mode=instructor.Mode.JSON,
        ), cfg.groq_model


def _llm_extra():
    """Extra params untuk Ollama — disable thinking mode Qwen3."""
    from retro.config import get_settings
    cfg = get_settings()
    return {"extra_body": {"think": False}} if cfg.use_ollama else {}


# ── LLM endpoints ─────────────────────────────────────────────────────────────

@app.post("/profile")
async def profile(req: ProfileReq):
    from retro.models import CompanyProfileCard
    from retro.config import get_settings
    log.info("profile", company=req.company_name)
    cfg = get_settings()
    try:
        client, model = _llm_client()
        result: CompanyProfileCard = client.chat.completions.create(
            model=model, response_model=CompanyProfileCard,
            messages=[
                {"role": "system", "content": "Kamu adalah analis bisnis B2B Indonesia. Ekstrak informasi dari teks website. JSON format. Jangan gunakan emoji."},
                {"role": "user", "content": f"Perusahaan: {req.company_name}\nBahasa: {req.language}\n\nTeks:\n{req.text[:cfg.profile_context_max_chars]}"},
            ], max_retries=2, **_llm_extra(),
        )
        return ok(result.model_dump())
    except Exception as e:
        log.error("profile_failed", error=str(e))
        return JSONResponse(status_code=500, content=err(e))


@app.post("/synthesize")
async def synthesize(req: SynthesizeReq):
    from retro.models import SynthesisResult
    try:
        summary = json.dumps([{k: p.get(k) for k in ("company_name", "industry", "company_size", "collaboration_potential", "confidence_score")} for p in req.profiles], ensure_ascii=False)
        client, model = _llm_client()
        result: SynthesisResult = client.chat.completions.create(
            model=model, response_model=SynthesisResult,
            messages=[
                {"role": "system", "content": "Kamu adalah strategic analyst B2B Indonesia. Rank perusahaan berdasarkan potensi kolaborasi. Jangan gunakan emoji."},
                {"role": "user", "content": f"Analisis {len(req.profiles)} perusahaan:\n{summary}"},
            ], max_retries=2, **_llm_extra(),
        )
        return ok(result.model_dump())
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/propose")
async def propose(req: ProposeReq):
    from retro.models import ProposalSections
    try:
        client, model = _llm_client()
        result: ProposalSections = client.chat.completions.create(
            model=model, response_model=ProposalSections,
            messages=[
                {"role": "system", "content": f"Kamu adalah {req.author}, penulis proposal B2B profesional Indonesia. Jangan gunakan emoji. Tulis formal dan ringkas."},
                {"role": "user", "content": f"Buat proposal untuk: {req.profile.get('company_name','')}\n\nProfil:\n{json.dumps(req.profile, ensure_ascii=False)}\n\nInsight:\n{req.synthesis.get('executive_summary','')}"},
            ], max_retries=2, **_llm_extra(),
        )
        return ok(result.model_dump())
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/briefing")
async def briefing(req: BriefingReq):
    from retro.models import BriefingReport
    try:
        client, model = _llm_client()
        result: BriefingReport = client.chat.completions.create(
            model=model, response_model=BriefingReport,
            messages=[
                {"role": "system", "content": "Kamu adalah analis intelijen bisnis senior PT GSP. Buat briefing komprehensif sebelum pertemuan. Jangan gunakan emoji. Tulis formal dan ringkas."},
                {"role": "user", "content": f"Briefing untuk: {req.company_name}\nDomain: {req.domain or '-'}\nKonteks: {req.context or 'pertemuan pertama'}\n\nBuat 9 section lengkap."},
            ], max_retries=2, **_llm_extra(),
        )
        return ok(result.model_dump())
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/complete")
async def complete(req: TextReq):
    from retro.tools import llm_complete
    try:
        result = llm_complete(messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": req.text},
        ])
        return ok({"text": result.get("content", "")})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


# ── News ─────────────────────────────────────────────────────────────────────

@app.post("/search-news")
async def search_news(req: SearchNewsReq):
    from retro.tools import fetch_news
    log.info("search_news", query=req.query)
    try:
        # Try GDELT first (real-time global news, no API key)
        result = fetch_news(req.query, max_items=req.max_items, prefer="gdelt")
        if not result.get("error") and result.get("count", 0) > 0:
            return ok(result)
        # Fallback: Google News RSS
        import urllib.parse
        lang_param = "" if req.language == "auto" else f"&hl={req.language}"
        rss_url = f"https://news.google.com/rss/search?q={urllib.parse.quote(req.query)}&num={req.max_items}{lang_param}"
        result2 = fetch_news(rss_url, max_items=req.max_items, prefer="httpx")
        if not result2.get("error"):
            return ok(result2)
        return ok(result)  # Return GDELT result even if empty
    except Exception as e:
        log.error("search_news_failed", error=str(e))
        return JSONResponse(status_code=500, content=err(e))


@app.post("/search-web")
async def search_web(req: SearchWebReq):
    import asyncio
    log.info("search_web", query=req.query)
    try:
        def _ddg():
            from ddgs import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(req.query, region=req.region, max_results=req.max_results))
            return results
        results = await asyncio.to_thread(_ddg)
        items = [{"title": r.get("title",""), "url": r.get("href",""), "snippet": r.get("body","")} for r in results]
        return ok({"query": req.query, "items": items, "count": len(items)})
    except Exception as e:
        log.error("search_web_failed", error=str(e))
        return JSONResponse(status_code=500, content=err(e))


# ── OSINT ─────────────────────────────────────────────────────────────────────

@app.post("/domain-intel")
async def domain_intel(req: DomainReq):
    from retro.tools import domain_intelligence
    log.info("domain_intel", domain=req.domain)
    try:
        return ok(domain_intelligence(req.domain))
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


# ── Extended OSINT Tools ──────────────────────────────────────────────────────

@app.post("/ip-intel")
async def ip_intel(req: IPIntelReq):
    """IP geolocation + ASN via ipinfo.io (50k req/month free)."""
    import httpx
    log.info("ip_intel", ip=req.ip)
    try:
        token = os.environ.get("IPINFO_TOKEN", "")
        url = f"https://ipinfo.io/{req.ip}/json"
        params = {"token": token} if token else {}
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(url, params=params)
        return ok(r.json())
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/url-scan")
async def url_scan(req: URLScanReq):
    """URL scan: HTTP check + SSL cert + redirect chain + DNS blacklist. No API key needed."""
    import httpx, ssl, dns.resolver
    log.info("url_scan", url=req.url)
    url = req.url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    result: dict = {"url": url, "http": {}, "ssl": {}, "redirects": [], "blacklists": {}}
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, max_redirects=8) as c:
            r = await c.get(url, headers={"User-Agent": "Mozilla/5.0 RETRO-Scanner/1.0"})
        result["http"] = {
            "status_code": r.status_code,
            "final_url": str(r.url),
            "content_type": r.headers.get("content-type", ""),
            "server": r.headers.get("server", ""),
            "redirect_count": len(r.history),
            "redirects": [str(h.url) for h in r.history],
        }
        result["safe"] = 200 <= r.status_code < 400
    except httpx.TooManyRedirects:
        result["http"]["error"] = "too_many_redirects"
    except Exception as e:
        result["http"]["error"] = str(e)[:80]

    # SSL cert info
    try:
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname or ""
        ctx = ssl.create_default_context()
        import socket
        conn = ctx.wrap_socket(socket.socket(), server_hostname=hostname)
        conn.settimeout(5)
        conn.connect((hostname, 443))
        cert = conn.getpeercert()
        conn.close()
        result["ssl"] = {
            "subject": dict(x[0] for x in cert.get("subject", [])),
            "issuer":  dict(x[0] for x in cert.get("issuer", [])),
            "expires": cert.get("notAfter", ""),
            "valid": True,
        }
    except ssl.SSLCertVerificationError:
        result["ssl"] = {"valid": False, "error": "certificate_invalid"}
    except Exception:
        pass

    # Domain blacklist check
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).hostname or ""
        domain = domain.lstrip("www.")
        resolver = dns.resolver.Resolver(); resolver.lifetime = 3
        for bl, host in [("spamhaus_dbl", f"{domain}.dbl.spamhaus.org"),
                          ("surbl",        f"{domain}.multi.surbl.org")]:
            try:
                resolver.resolve(host, "A")
                result["blacklists"][bl] = "LISTED"
            except dns.resolver.NXDOMAIN:
                result["blacklists"][bl] = "clean"
            except Exception:
                result["blacklists"][bl] = "unknown"
    except Exception:
        pass

    listed = sum(1 for v in result["blacklists"].values() if v == "LISTED")
    result["verdict"] = "malicious" if listed >= 1 else ("safe" if result.get("safe") else "unknown")
    return ok(result)


@app.post("/domain-reputation")
async def domain_reputation(req: DomainRepReq):
    """Domain reputation: RDAP (free WHOIS) + DNS records + Spamhaus DNSBL. No API key needed."""
    import httpx
    import dns.resolver
    log.info("domain_reputation", domain=req.domain)
    domain = req.domain.lower().strip().lstrip("www.")
    result: dict = {"domain": domain, "rdap": {}, "dns": {}, "blacklists": {}}
    try:
        # RDAP — free, standardised WHOIS replacement (no key needed)
        async with httpx.AsyncClient(timeout=10) as c:
            rdap_r = await c.get(f"https://rdap.org/domain/{domain}",
                                 headers={"Accept": "application/json"}, follow_redirects=True)
        if rdap_r.status_code == 200:
            d = rdap_r.json()
            events = {e.get("eventAction"): e.get("eventDate", "") for e in d.get("events", [])}
            result["rdap"] = {
                "registrar": next((e.get("vcardArray", [[]])[1] for e in d.get("entities", []) if "registrar" in e.get("roles", [])), None),
                "status": d.get("status", []),
                "registered": events.get("registration", ""),
                "expires": events.get("expiration", ""),
                "updated": events.get("last changed", ""),
                "nameservers": [ns.get("ldhName", "") for ns in d.get("nameservers", [])],
            }
    except Exception:
        pass
    # DNS A + MX records
    try:
        resolver = dns.resolver.Resolver()
        resolver.lifetime = 5
        try:
            a_records = [str(r) for r in resolver.resolve(domain, "A")]
            result["dns"]["a"] = a_records
        except Exception:
            result["dns"]["a"] = []
        try:
            mx_records = [str(r.exchange) for r in resolver.resolve(domain, "MX")]
            result["dns"]["mx"] = mx_records
        except Exception:
            result["dns"]["mx"] = []
    except Exception:
        pass
    # Spamhaus DBL domain blacklist (DNS-based, completely free)
    try:
        resolver2 = dns.resolver.Resolver()
        resolver2.lifetime = 3
        try:
            resolver2.resolve(f"{domain}.dbl.spamhaus.org", "A")
            result["blacklists"]["spamhaus_dbl"] = "LISTED"
        except dns.resolver.NXDOMAIN:
            result["blacklists"]["spamhaus_dbl"] = "clean"
        except Exception:
            result["blacklists"]["spamhaus_dbl"] = "unknown"
        # SURBL multi blacklist
        try:
            resolver2.resolve(f"{domain}.multi.surbl.org", "A")
            result["blacklists"]["surbl"] = "LISTED"
        except dns.resolver.NXDOMAIN:
            result["blacklists"]["surbl"] = "clean"
        except Exception:
            result["blacklists"]["surbl"] = "unknown"
    except Exception:
        pass
    return ok(result)


@app.post("/sanctions-check")
async def sanctions_check(req: SanctionsReq):
    """Sanctions check via DuckDuckGo search on public sanctions databases. No API key needed."""
    import asyncio
    log.info("sanctions_check", name=req.name)
    try:
        name = req.name.strip()
        hits = []
        sources_searched = []

        def _ddg_search():
            from ddgs import DDGS
            queries = [
                f'"{name}" site:opensanctions.org',
                f'"{name}" sanctions list OFAC SDN',
            ]
            results = []
            with DDGS() as ddgs:
                for q in queries:
                    try:
                        r = list(ddgs.text(q, max_results=3))
                        results.extend(r)
                    except Exception:
                        pass
            return results

        raw = await asyncio.to_thread(_ddg_search)
        for r in raw:
            title = r.get("title", "")
            url   = r.get("href", "")
            snip  = r.get("body", "")
            is_sanctions = any(kw in url.lower() or kw in title.lower()
                               for kw in ["opensanctions", "ofac", "sanctionslist", "scsanctions", "treasury"])
            hits.append({
                "title": title,
                "url": url,
                "snippet": snip,
                "source": "opensanctions" if "opensanctions" in url else "ofac" if "ofac" in url or "treasury" in url else "web",
                "is_sanctions_source": is_sanctions,
            })
            if url and url not in sources_searched:
                sources_searched.append(url)

        # Heuristic: if any hit links directly to a sanctions-database entity page, flag it
        direct_hit = any(h["is_sanctions_source"] and name.lower() in (h["title"] + h["snippet"]).lower() for h in hits)
        return ok({
            "query": name,
            "direct_match_found": direct_hit,
            "total_results": len(hits),
            "hits": hits[:6],
            "sources": ["opensanctions.org (DuckDuckGo)", "OFAC SDN (DuckDuckGo)"],
        })
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/company-lookup")
async def company_lookup(req: CompanyLookupReq):
    """Company lookup via DuckDuckGo + RDAP domain check. No API key needed."""
    import httpx, asyncio
    log.info("company_lookup", name=req.name)
    try:
        name = req.name.strip()

        def _ddg():
            from ddgs import DDGS
            queries = [
                f"{name} perusahaan profil resmi",
                f"{name} company official website Indonesia",
            ]
            results = []
            with DDGS() as ddgs:
                for q in queries:
                    try:
                        r = list(ddgs.text(q, max_results=4))
                        results.extend(r)
                    except Exception:
                        pass
            return results

        raw = await asyncio.to_thread(_ddg)
        companies = []
        seen_urls = set()
        for r in raw:
            url = r.get("href", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)
            companies.append({
                "name": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": url,
                "domain": url.split("/")[2] if url.startswith("http") else "",
            })

        # Try RDAP for any domain found
        rdap_info = None
        for c in companies[:2]:
            domain = c.get("domain", "")
            if domain and "." in domain:
                try:
                    async with httpx.AsyncClient(timeout=8) as cl:
                        r2 = await cl.get(f"https://rdap.org/domain/{domain}",
                                          headers={"Accept": "application/json"}, follow_redirects=True)
                    if r2.status_code == 200:
                        d = r2.json()
                        events = {e.get("eventAction"): e.get("eventDate", "") for e in d.get("events", [])}
                        rdap_info = {
                            "domain": domain,
                            "status": d.get("status", []),
                            "registered": events.get("registration", ""),
                            "nameservers": [ns.get("ldhName", "") for ns in d.get("nameservers", [])[:3]],
                        }
                        break
                except Exception:
                    pass

        return ok({"query": name, "count": len(companies), "companies": companies[:6], "rdap": rdap_info})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/threat-intel")
async def threat_intel(req: ThreatIntelReq):
    """Threat intelligence via DNS blacklists (Spamhaus ZEN/DBL, SURBL) + RDAP. No API key needed."""
    import dns.resolver, ipaddress, httpx
    log.info("threat_intel", indicator=req.indicator, type=req.type)
    indicator = req.indicator.strip()
    result: dict = {"indicator": indicator, "blacklists": {}, "rdap": {}, "dns": {}}

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 4

    # Detect type
    is_ip = False
    try:
        ipaddress.ip_address(indicator)
        is_ip = True
    except ValueError:
        pass

    try:
        if is_ip:
            # Spamhaus ZEN (IPs): reverse IP + .zen.spamhaus.org
            parts = indicator.split(".")
            reversed_ip = ".".join(reversed(parts))
            for bl, host in [("spamhaus_zen", f"{reversed_ip}.zen.spamhaus.org"),
                              ("spamhaus_xbl", f"{reversed_ip}.xbl.spamhaus.org")]:
                try:
                    resolver.resolve(host, "A")
                    result["blacklists"][bl] = "LISTED"
                except dns.resolver.NXDOMAIN:
                    result["blacklists"][bl] = "clean"
                except Exception:
                    result["blacklists"][bl] = "unknown"
            # ipinfo for IP enrichment (free, no key)
            try:
                async with httpx.AsyncClient(timeout=8) as c:
                    ip_r = await c.get(f"https://ipinfo.io/{indicator}/json")
                if ip_r.status_code == 200:
                    d = ip_r.json()
                    result["rdap"] = {
                        "org": d.get("org"), "country": d.get("country"),
                        "city": d.get("city"), "asn": d.get("org", "").split(" ")[0],
                    }
            except Exception:
                pass
        else:
            # Domain: Spamhaus DBL + SURBL
            domain = indicator.lstrip("www.").split("/")[0]
            for bl, host in [("spamhaus_dbl", f"{domain}.dbl.spamhaus.org"),
                              ("surbl_multi",  f"{domain}.multi.surbl.org"),
                              ("uribl",        f"{domain}.black.uribl.com")]:
                try:
                    resolver.resolve(host, "A")
                    result["blacklists"][bl] = "LISTED"
                except dns.resolver.NXDOMAIN:
                    result["blacklists"][bl] = "clean"
                except Exception:
                    result["blacklists"][bl] = "unknown"
            # DNS A records
            try:
                a = [str(r) for r in resolver.resolve(domain, "A")]
                result["dns"]["a_records"] = a
            except Exception:
                result["dns"]["a_records"] = []
            # RDAP registration info
            try:
                async with httpx.AsyncClient(timeout=8) as c:
                    rdap_r = await c.get(f"https://rdap.org/domain/{domain}",
                                         headers={"Accept": "application/json"}, follow_redirects=True)
                if rdap_r.status_code == 200:
                    d = rdap_r.json()
                    events = {e.get("eventAction"): e.get("eventDate", "") for e in d.get("events", [])}
                    result["rdap"] = {
                        "status": d.get("status", []),
                        "registered": events.get("registration", ""),
                        "expires": events.get("expiration", ""),
                    }
            except Exception:
                pass
    except Exception as e:
        result["error"] = str(e)

    listed_count = sum(1 for v in result["blacklists"].values() if v == "LISTED")
    result["threat_level"] = "HIGH" if listed_count >= 2 else "MEDIUM" if listed_count == 1 else "clean"
    return ok(result)


@app.post("/wayback")
async def wayback(req: WaybackReq):
    """Historical snapshots from Wayback Machine CDX API (completely free, no key)."""
    import httpx, urllib.parse
    log.info("wayback", url=req.url)
    url_enc = urllib.parse.quote(req.url, safe="")
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            avail_r, cdx_r = await asyncio.gather(
                c.get(f"https://archive.org/wayback/available?url={url_enc}"),
                c.get(
                    f"https://web.archive.org/cdx/search/cdx"
                    f"?url={url_enc}&limit=8&output=json"
                    f"&fl=timestamp,statuscode,mimetype,original&from=20200101"
                ),
                return_exceptions=True,
            )

        snapshots = []
        if not isinstance(cdx_r, Exception) and cdx_r.status_code == 200:
            try:
                rows = cdx_r.json()
                if isinstance(rows, list) and len(rows) > 1:
                    keys = rows[0]
                    for row in rows[1:]:
                        entry = dict(zip(keys, row))
                        ts = entry.get("timestamp", "")
                        if ts:
                            entry["archive_url"] = f"https://web.archive.org/web/{ts}/{entry.get('original','')}"
                        snapshots.append(entry)
            except Exception:
                pass

        closest = {}
        if not isinstance(avail_r, Exception) and avail_r.status_code == 200:
            try:
                closest = avail_r.json().get("archived_snapshots", {}).get("closest", {})
            except Exception:
                pass

        return ok({
            "url": req.url,
            "closest": closest,
            "snapshots": snapshots,
            "total_snapshots": len(snapshots),
            "has_archive": bool(closest or snapshots),
        })
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/geolocate")
async def geolocate(req: GeoReq):
    """Geocode address/location via Nominatim/OpenStreetMap (free, 1 req/sec)."""
    import httpx, urllib.parse
    log.info("geolocate", query=req.query)
    try:
        params = {"q": req.query, "format": "json", "limit": 3, "addressdetails": 1}
        headers = {"User-Agent": "RETRO/1.0 gemilangsatriaperkasa@gmail.com"}
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
        if r.status_code != 200:
            return ok({"error": f"Nominatim HTTP {r.status_code}", "query": req.query, "results": []})
        results = [{
            "display_name": loc.get("display_name"),
            "lat": loc.get("lat"),
            "lon": loc.get("lon"),
            "type": loc.get("type"),
            "importance": loc.get("importance"),
            "address": loc.get("address", {}),
        } for loc in r.json()]
        return ok({"query": req.query, "count": len(results), "results": results})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


# ── PDF ───────────────────────────────────────────────────────────────────────

@app.post("/render-outbound")
async def render_outbound(req: RenderReq):
    from retro.tools import render_outbound_pdf
    from retro.config import get_settings
    from datetime import datetime
    cfg = get_settings()
    try:
        out = pathlib.Path(cfg.output_dir)
        out.mkdir(parents=True, exist_ok=True)
        filename = f"proposal_outbound_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        path = str(out / filename)
        result = render_outbound_pdf(req.data, path, theme=req.theme)
        backend = os.environ.get("BACKEND_URL", "http://localhost:3001")
        result["download_url"] = f"{backend}/api/files/{filename}"
        result["filename"] = filename
        return ok(result)
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/render-internal")
async def render_internal(req: RenderReq):
    from retro.tools import render_internal_pdf
    from retro.config import get_settings
    from datetime import datetime
    cfg = get_settings()
    try:
        out = pathlib.Path(cfg.output_dir)
        out.mkdir(parents=True, exist_ok=True)
        filename = f"report_internal_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        path = str(out / filename)
        result = render_internal_pdf(req.data, path, theme=req.theme)
        backend = os.environ.get("BACKEND_URL", "http://localhost:3001")
        result["download_url"] = f"{backend}/api/files/{filename}"
        result["filename"] = filename
        return ok(result)
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


# ── Storage ───────────────────────────────────────────────────────────────────

@app.post("/save-run")
async def save_run(req: SaveReq):
    from retro.tools import save_pipeline_results
    from retro.config import get_settings
    cfg = get_settings()
    try:
        result = save_pipeline_results(req.run_data, db_path=cfg.db_path)
        return ok(result) if result.get("success") else JSONResponse(status_code=500, content=err(Exception(result.get("error"))))
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


@app.post("/query-runs")
async def query_runs():
    from retro.config import get_settings
    import sqlite3
    cfg = get_settings()
    try:
        conn = sqlite3.connect(cfg.db_path)
        conn.row_factory = sqlite3.Row
        rows = [dict(r) for r in conn.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT 50").fetchall()]
        conn.close()
        return ok({"runs": rows, "count": len(rows)})
    except Exception as e:
        return JSONResponse(status_code=500, content=err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
