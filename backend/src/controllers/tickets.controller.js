import ticketRepository from "../repositories/ticket.repository.js";
import syncService from "../services/sync.service.js";
import { generateReply, generateEscalation } from "../services/ai.service.js";

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
