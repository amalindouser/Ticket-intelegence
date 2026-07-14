import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../config/prisma.js";
import ticketRepository from "../repositories/ticket.repository.js";
import syncService from "../services/sync.service.js";
import freshdesk from "../services/freshdesk.service.js";
import { generateReply, generateEscalation } from "../services/ai.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function listTickets(req, res, next) {
  try {
    const { page = 1, perPage = 20 } = req.query;
    const result = await ticketRepository.findAll({
      page: Number(page),
      perPage: Number(perPage),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req, res, next) {
  try {
    const ticket = await ticketRepository.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    if (!ticket.description && ticket.freshdeskTicketId) {
      try {
        const ft = await freshdesk.getTicket(Number(ticket.freshdeskTicketId));
        if (ft.description || ft.description_text) {
          const desc = ft.description_text || ft.description;
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { description: desc },
          });
          ticket.description = desc;
        }
      } catch {}
    }

    if (ticket.attachments) {
      const seen = new Set();
      ticket.attachments = ticket.attachments.filter((a) => {
        const key = a.filename || a.attachmentUrl || a.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function syncTickets(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const result = await syncService.syncTickets({ startDate, endDate });
    res.json({ message: "Sync completed", ...result });
  } catch (err) {
    next(err);
  }
}

export async function syncSingleTicket(req, res, next) {
  try {
    const { freshdeskId } = req.params;
    const ticket = await syncService.syncTicketDetail(freshdeskId);
    res.json({ message: "Ticket synced", ticket });
  } catch (err) {
    next(err);
  }
}

export async function getTimeline(req, res, next) {
  try {
    const timeline = await ticketRepository.getTimeline(req.params.id);
    if (!timeline) return res.status(404).json({ error: "Ticket not found" });
    res.json(timeline);
  } catch (err) {
    next(err);
  }
}

export async function getSuggestions(req, res, next) {
  try {
    const tickets = await ticketRepository.getSuggestions(req.params.id);
    res.json(tickets);
  } catch (err) {
    next(err);
  }
}

export async function getSimilar(req, res, next) {
  try {
    const tickets = await ticketRepository.findSimilar(req.params.id);
    res.json(tickets);
  } catch (err) {
    next(err);
  }
}

export async function aiReply(req, res, next) {
  try {
    const result = await generateReply(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function aiEscalation(req, res, next) {
  try {
    const result = await generateEscalation(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachment(req, res, next) {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment || !attachment.attachmentUrl) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    const filePath = path.resolve(__dirname, "../../..", attachment.attachmentUrl.replace(/^\//, ""));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }
    res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
    if (attachment.contentType) res.setHeader("Content-Type", attachment.contentType);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}
