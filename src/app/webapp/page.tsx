"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

const PING_INTERVAL_MS = 30 * 1000;

function proxyUrl(url: string) {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

export default function WebAppPage() {
  const [url, setUrl] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [pingStatus, setPingStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    fetch("/api/target-url")
      .then((r) => r.json())
      .then((data) => {
        if (data.url) {
          setUrl(data.url);
          setInputUrl(data.url);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!url) return;

    const ping = async () => {
      try {
        const res = await fetch(`/api/ping?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        setPingStatus(data.ok ? "ok" : "fail");
        setPingCount((c) => c + 1);
        setLastPing(new Date().toLocaleTimeString());
      } catch {
        setPingStatus("fail");
        setLastPing(new Date().toLocaleTimeString());
      }
    };

    ping();
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [url]);

  const handleGo = () => {
    let target = inputUrl.trim();
    if (!target) return;
    if (!target.startsWith("http")) target = "https://" + target;
    setUrl(target);
    setInputUrl(target);
    setPingStatus("idle");
    setPingCount(0);
    setLoading(true);
  };

  const statusColor =
    pingStatus === "ok" ? "#4ade80" : pingStatus === "fail" ? "#f87171" : "#94a3b8";
  const statusLabel =
    pingStatus === "ok" ? "Active" : pingStatus === "fail" ? "Unreachable" : "Connecting…";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Browser toolbar */}
      <div
        style={{
          padding: "10px 12px",
          background: "#1e293b",
          borderBottom: "1px solid #334155",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Reload button */}
          <button
            onClick={() => {
              if (url && iframeRef.current) {
                setLoading(true);
                iframeRef.current.src = proxyUrl(url);
              }
            }}
            title="Reload"
            style={{
              background: "#334155",
              border: "none",
              borderRadius: 6,
              width: 32,
              height: 32,
              color: "#94a3b8",
              fontSize: 15,
              cursor: "pointer",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ↻
          </button>

          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGo()}
            placeholder="Enter URL to open & keep alive…"
            style={{
              flex: 1,
              background: "#0f172a",
              border: "1px solid #475569",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#f1f5f9",
              fontSize: 13,
              outline: "none",
              minWidth: 0,
            }}
          />
          <button
            onClick={handleGo}
            style={{
              background: "#3b82f6",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Go
          </button>
        </div>

        {/* Status bar */}
        {url && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 8,
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColor,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
            {lastPing && (
              <span>
                · Last kept alive {lastPing} · {pingCount} ping{pingCount !== 1 ? "s" : ""}
              </span>
            )}
            {loading && <span style={{ marginLeft: "auto", color: "#60a5fa" }}>Loading…</span>}
          </div>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {!url ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
              padding: "2rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 48 }}>🌐</div>
            <p style={{ color: "#94a3b8", margin: 0, maxWidth: 300 }}>
              Enter a URL above to open the website and keep it alive automatically.
            </p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={proxyUrl(url)}
            onLoad={() => setLoading(false)}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
            title="Proxied site"
          />
        )}
      </div>
    </div>
  );
}
