import { NextRequest, NextResponse } from "next/server";

const BLOCKED_REQ_HEADERS = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "te",
  "trailers",
  "upgrade",
  "keep-alive",
  "proxy-authorization",
  "proxy-authenticate",
]);

const BLOCKED_RES_HEADERS = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-content-type-options",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function rewriteHtml(html: string, baseUrl: string, proxyBase: string): string {
  const origin = new URL(baseUrl).origin;

  // Inject a <base> tag so relative URLs in the page resolve correctly,
  // plus inject a script that rewrites link clicks to go through the proxy.
  const injectedHead = `
<base href="${baseUrl}">
<script>
(function() {
  function proxyHref(url) {
    if (!url) return url;
    try {
      var abs = new URL(url, "${baseUrl}").href;
      if (abs.startsWith("${origin}")) {
        return "${proxyBase}?url=" + encodeURIComponent(abs);
      }
      return abs;
    } catch(e) { return url; }
  }
  document.addEventListener("click", function(e) {
    var el = e.target.closest("a");
    if (!el) return;
    var href = el.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
    e.preventDefault();
    var resolved = proxyHref(href);
    window.location.href = resolved;
  }, true);
  document.addEventListener("submit", function(e) {
    var form = e.target;
    var action = form.getAttribute("action");
    if (action) {
      form.setAttribute("action", proxyHref(action));
    }
  }, true);
})();
<\/script>`;

  // Strip existing X-Frame-Options meta tags
  let result = html
    .replace(/<meta[^>]+http-equiv=["']?x-frame-options["']?[^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");

  // Rewrite absolute src/href that point to the same origin through the proxy
  result = result.replace(
    /((?:src|href|action)=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      if (
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("javascript:") ||
        url.startsWith("#") ||
        url.startsWith("//") ||
        url.startsWith("mailto:")
      ) {
        return match;
      }
      try {
        const abs = resolveUrl(baseUrl, url);
        if (abs.startsWith(origin)) {
          return `${prefix}${proxyBase}?url=${encodeURIComponent(abs)}${suffix}`;
        }
      } catch {
        // ignore
      }
      return match;
    }
  );

  // Inject our script into <head> or at the top
  if (/<head[^>]*>/i.test(result)) {
    result = result.replace(/(<head[^>]*>)/i, `$1${injectedHead}`);
  } else {
    result = injectedHead + result;
  }

  return result;
}

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const proxyBase = `${req.nextUrl.origin}/api/proxy`;

  const forwardHeaders: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
    accept:
      req.headers.get("accept") ||
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": req.headers.get("accept-language") || "en-US,en;q=0.9",
  };

  req.headers.forEach((value, key) => {
    if (!BLOCKED_REQ_HEADERS.has(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  });

  try {
    const upstream = await fetch(parsedUrl.href, {
      method: "GET",
      headers: forwardHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html");

    const resHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!BLOCKED_RES_HEADERS.has(key.toLowerCase())) {
        resHeaders.set(key, value);
      }
    });

    // Always allow framing from our own origin
    resHeaders.set("x-frame-options", "SAMEORIGIN");
    resHeaders.delete("content-security-policy");
    resHeaders.delete("content-security-policy-report-only");

    if (isHtml) {
      const html = await upstream.text();
      const rewritten = rewriteHtml(html, parsedUrl.href, proxyBase);
      resHeaders.set("content-type", "text/html; charset=utf-8");
      resHeaders.delete("content-encoding");
      return new NextResponse(rewritten, {
        status: upstream.status,
        headers: resHeaders,
      });
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:2rem;background:#0f172a;color:#f1f5f9">
        <h2>Could not load page</h2>
        <p style="color:#94a3b8">${message}</p>
        <p style="color:#94a3b8">The site may be down or blocking all automated access. The bot is still pinging it to keep it alive.</p>
      </body></html>`,
      { status: 502, headers: { "content-type": "text/html" } }
    );
  }
}
