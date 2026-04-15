import { Telegraf, Context } from "telegraf";
import { getTargetUrl, setTargetUrl } from "./state";

let bot: Telegraf | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let isPinging = false;
let lastPingResult: { success: boolean; status?: number; error?: string; timestamp: Date } | null = null;

const PING_INTERVAL_MS = 5 * 60 * 1000;

function getWebAppUrl(): string {
  const base =
    process.env.WEBAPP_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
  return base ? `${base}/webapp` : "";
}

async function pingTarget(url?: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const targetUrl = url || getTargetUrl();
  if (!targetUrl) {
    return { success: false, error: "TARGET_URL not set" };
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });
    return { success: response.ok, status: response.status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

function startPinging(ctx?: Context) {
  if (isPinging) return;
  isPinging = true;

  const run = async () => {
    lastPingResult = { ...(await pingTarget()), timestamp: new Date() };
  };

  run();
  pingInterval = setInterval(run, PING_INTERVAL_MS);

  if (ctx) {
    ctx.reply(
      `Pinging started!\nTarget: ${getTargetUrl() || "Not set"}\nInterval: every 5 minutes`
    );
  }
}

function stopPinging(ctx?: Context) {
  if (!isPinging) return;
  isPinging = false;
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (ctx) {
    ctx.reply("Pinging stopped.");
  }
}

function openBrowserButton() {
  const webappUrl = getWebAppUrl();
  if (!webappUrl) return undefined;
  return {
    inline_keyboard: [
      [{ text: "🌐 Open in Browser", web_app: { url: webappUrl } }],
    ],
  };
}

export function startTelegramBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.warn("BOT_TOKEN not set — Telegram bot will not start.");
    return;
  }

  bot = new Telegraf(token);

  bot.command("start", (ctx) => {
    const keyboard = openBrowserButton();
    ctx.reply(
      `Keep-Alive Ping Bot\n\nI keep your services alive by pinging them regularly, and can open them inside Telegram like a browser.\n\n` +
        `Commands:\n/ping — Ping the current target URL\n/seturl <url> — Change the target URL instantly\n/open — Open website in Mini App browser\n/start_ping — Start automatic pinging\n/stop_ping — Stop automatic pinging\n/status — Check current status\n/help — Show this message`,
      keyboard ? { reply_markup: keyboard } : {}
    );
  });

  bot.command("help", (ctx) => {
    const keyboard = openBrowserButton();
    ctx.reply(
      `Commands:\n/ping — Ping the current target URL\n/seturl <url> — Change the target URL instantly\n/open — Open website in Mini App browser\n/start_ping — Start automatic pinging\n/stop_ping — Stop automatic pinging\n/status — Check current status`,
      keyboard ? { reply_markup: keyboard } : {}
    );
  });

  bot.command("seturl", async (ctx) => {
    const parts = ctx.message.text.trim().split(/\s+/);
    const newUrl = parts[1];

    if (!newUrl) {
      ctx.reply(
        `Current target URL: ${getTargetUrl() || "Not set"}\n\nTo change it, send:\n/seturl https://your-site.com`
      );
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(newUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Invalid protocol");
    } catch {
      ctx.reply("Invalid URL. Please include https://, e.g.:\n/seturl https://your-site.com");
      return;
    }

    const oldUrl = getTargetUrl();
    setTargetUrl(parsedUrl.href);
    lastPingResult = null;

    ctx.reply(`Target URL updated!\n\nFrom: ${oldUrl || "None"}\nTo: ${parsedUrl.href}\n\nPinging the new URL now…`);

    const result = await pingTarget(parsedUrl.href);
    lastPingResult = { ...result, timestamp: new Date() };

    const keyboard = openBrowserButton();
    ctx.reply(
      result.success
        ? `✅ ${parsedUrl.href} is reachable (status ${result.status}). Auto-pinging every 5 minutes.`
        : `⚠️ Could not reach ${parsedUrl.href}: ${result.error || `status ${result.status}`}\nURL saved — will keep trying.`,
      keyboard ? { reply_markup: keyboard } : {}
    );
  });

  bot.command("open", (ctx) => {
    const webappUrl = getWebAppUrl();
    if (!webappUrl) {
      ctx.reply("WEBAPP_URL is not configured. Please set it to enable the in-app browser.");
      return;
    }
    const targetUrl = getTargetUrl() || "Not set";
    ctx.reply(
      `Opening ${targetUrl} in the Mini App browser.\nThe site will be kept alive with continuous pings.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 Open in Browser", web_app: { url: webappUrl } }],
          ],
        },
      }
    );
  });

  bot.command("ping", async (ctx) => {
    const targetUrl = getTargetUrl();
    if (!targetUrl) {
      ctx.reply("No target URL set. Use /seturl https://your-site.com to set one.");
      return;
    }
    ctx.reply(`Pinging ${targetUrl}…`);
    const result = await pingTarget();
    lastPingResult = { ...result, timestamp: new Date() };
    if (result.success) {
      ctx.reply(`✅ Success! Status: ${result.status}`);
    } else {
      ctx.reply(`❌ Failed: ${result.error || `Status ${result.status}`}`);
    }
  });

  bot.command("start_ping", (ctx) => {
    if (isPinging) {
      ctx.reply("Pinging is already running.");
      return;
    }
    startPinging(ctx);
  });

  bot.command("stop_ping", (ctx) => {
    if (!isPinging) {
      ctx.reply("Pinging is not running.");
      return;
    }
    stopPinging(ctx);
  });

  bot.command("status", (ctx) => {
    const targetUrl = getTargetUrl() || "Not set";
    const webappUrl = getWebAppUrl() || "Not configured";
    const keyboard = openBrowserButton();

    let statusMsg = `Status\n\nTarget URL: ${targetUrl}\nWebApp URL: ${webappUrl}\nAuto-ping: ${isPinging ? "✅ Running" : "⏸ Stopped"}`;

    if (lastPingResult) {
      const ago = Math.round(
        (Date.now() - lastPingResult.timestamp.getTime()) / 1000
      );
      statusMsg += `\nLast ping: ${lastPingResult.success ? "✅ Success" : "❌ Failed"} (${ago}s ago)`;
      if (!lastPingResult.success && lastPingResult.error) {
        statusMsg += `\nError: ${lastPingResult.error}`;
      }
    } else {
      statusMsg += `\nLast ping: Never`;
    }

    ctx.reply(statusMsg, keyboard ? { reply_markup: keyboard } : {});
  });

  bot.launch();
  console.log("Telegram bot started.");

  process.once("SIGINT", () => bot?.stop("SIGINT"));
  process.once("SIGTERM", () => bot?.stop("SIGTERM"));

  startPinging();
}
