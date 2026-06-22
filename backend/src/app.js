import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./config/prisma.js";
import routes from "./routes/index.js";
import syncService from "./services/sync.service.js";
import ticketHistoriesService from "./services/ticket-histories.service.js";
import ticketConversationsService from "./services/ticket-conversations.service.js";
import relationService from "./services/relation.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT || 3000;
const POLL_INTERVAL = 25_000;

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

let pollTimer;
let historySyncTimer;

async function pollTickets() {
  try {
    const count = await syncService.pollRecent();
    if (count > 0) {
      console.log(`[poll] Synced ${count} new/updated ticket(s)`);
    }
  } catch (err) {
    console.error("[poll] Error:", err.message);
  }
}

async function scheduledHistorySync() {
  console.log("[scheduler] Starting scheduled sync...");
  try {
    const histResult = await ticketHistoriesService.syncHistories();
    console.log(`[scheduler] Histories synced: ${histResult.synced} entries`);
  } catch (err) {
    console.error("[scheduler] History sync error:", err.message);
  }
  try {
    const convResult = await ticketConversationsService.syncConversations();
    console.log(`[scheduler] Conversations synced: ${convResult.synced} entries, ${convResult.evidences || 0} evidences`);
  } catch (err) {
    console.error("[scheduler] Conversation sync error:", err.message);
  }
  try {
    const relResult = await relationService.detectRelations();
    console.log(`[scheduler] Relations detected: ${relResult.linked} linked, ${relResult.markedResolved} resolved`);
  } catch (err) {
    console.error("[scheduler] Relation detection error:", err.message);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  pollTimer = setInterval(pollTickets, POLL_INTERVAL);
  console.log(`[poll] Auto-sync every ${POLL_INTERVAL / 1000}s`);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setTimeout(scheduledHistorySync, 30000);
  historySyncTimer = setInterval(scheduledHistorySync, SIX_HOURS);
  console.log(`[scheduler] History & conversation sync every 6 hours`);
});

process.on("SIGTERM", async () => {
  clearInterval(pollTimer);
  clearInterval(historySyncTimer);
  await prisma.$disconnect();
  process.exit(0);
});
