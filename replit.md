# Keep-Alive Ping Bot

A Next.js web app with an integrated Telegram bot that keeps services alive by pinging a target URL at regular intervals.

## Architecture

- **server.ts** — Custom Node.js HTTP server that boots Next.js and starts the Telegram bot
- **src/lib/telegram.ts** — Telegram bot logic (Telegraf): handles commands, manages ping intervals
- **src/app/** — Next.js App Router pages (home page + `/api/status` health endpoint)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token (from @BotFather) |
| `TARGET_URL` | URL to ping to keep the service alive |
| `WEBAPP_URL` | Public URL of this web app (optional, for bot display) |
| `PORT` | Port to run on (defaults to 5000) |

## Running

```bash
npm run dev    # Development
npm run build  # Build for production
npm run start  # Start production server
```

## How it works

1. On startup, the Telegram bot starts and begins pinging `TARGET_URL` every 5 minutes
2. Users can control pinging via Telegram commands: `/ping`, `/start_ping`, `/stop_ping`, `/status`
3. The web app at port 5000 shows a simple status page and `/api/status` health endpoint
