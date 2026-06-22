import { generateChat, streamChat } from "../services/ai.service.js";

export async function chat(req, res, next) {
  try {
    const { ticketId, message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });
    const result = await generateChat(ticketId || null, message, history || []);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function chatStream(req, res, next) {
  try {
    const { ticketId, message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    await streamChat(res, ticketId || null, message, history || []);
    res.end();
  } catch (err) {
    if (!res.headersSent) return next(err);
    res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
    res.end();
  }
}
