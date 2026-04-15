import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { startTelegramBot } from "./src/lib/telegram";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "5000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  startTelegramBot();

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, hostname, () => {
    console.log(``);
    console.log(`  Keep-Alive Ping Bot`);
    console.log(`  Running on http://${hostname}:${port}`);
    console.log(`  Target URL: ${process.env.TARGET_URL || "Not set"}`);
    console.log(`  Bot Token: ${process.env.BOT_TOKEN ? "Set" : "Not set"}`);
    console.log(`  WebApp URL: ${process.env.WEBAPP_URL || process.env.REPLIT_DEV_DOMAIN || "Not set"}`);
    console.log(``);
  });
});
