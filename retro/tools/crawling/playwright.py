"""[02] Web Crawling — ALT2: Playwright (full browser, JS-heavy sites)"""
import asyncio


async def fetch_async(url: str, timeout: int = 30000) -> dict:
    """Playwright headless Chromium. Last resort untuk JS-heavy / SPA sites."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                locale="id-ID",
            )
            page = await ctx.new_page()
            await page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
            try:
                await page.goto(url, timeout=timeout, wait_until="networkidle")
                html = await page.content()
                success = len(html) > 100
                return {"html": html, "status_code": 200 if success else 0, "tool": "playwright", "error": None if success else "empty", "success": success}
            finally:
                await browser.close()
    except ImportError:
        return {"html": "", "status_code": 0, "tool": "playwright", "error": "playwright not installed", "success": False}
    except Exception as e:
        return {"html": "", "status_code": 0, "tool": "playwright", "error": str(e), "success": False}


def fetch(url: str, timeout: int = 30000) -> dict:
    """Sync wrapper untuk fetch_async."""
    try:
        return asyncio.run(fetch_async(url, timeout))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(fetch_async(url, timeout))
        finally:
            loop.close()
