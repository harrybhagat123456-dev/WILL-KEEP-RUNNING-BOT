export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Keep-Alive Ping Bot
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
          Your service is running. The bot is actively pinging your target URL to keep it alive.
        </p>
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "1.5rem", textAlign: "left" }}>
          <p style={{ margin: 0, color: "#4ade80", fontFamily: "monospace" }}>● Server running</p>
          <p style={{ margin: "0.5rem 0 0", color: "#94a3b8", fontSize: "0.875rem" }}>
            Use the Telegram bot to control pinging. See /help for available commands.
          </p>
        </div>
      </div>
    </main>
  );
}
