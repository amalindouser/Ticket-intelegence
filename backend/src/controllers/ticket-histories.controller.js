import prisma from "../config/prisma.js";
import ticketHistoriesService from "../services/ticket-histories.service.js";
import ticketConversationsService from "../services/ticket-conversations.service.js";

async function resolveTicketId(rawId) {
  if (rawId.includes("-")) return rawId;
  const ticket = await prisma.ticket.findFirst({
    where: { freshdeskTicketId: BigInt(rawId) },
    select: { id: true },
  });
  return ticket ? ticket.id : rawId;
}

export async function getTicketHistories(req, res, next) {
  try {
    const ticketId = await resolveTicketId(req.params.ticketId);
    const histories = await ticketHistoriesService.getHistories(ticketId);
    res.json(histories);
  } catch (err) {
    res.json([]);
  }
}

export async function getTicketConversations(req, res, next) {
  try {
    const ticketId = await resolveTicketId(req.params.ticketId);
    const conversations = await ticketConversationsService.getConversations(ticketId);
    res.json(conversations);
  } catch (err) {
    res.json([]);
  }
}

export async function syncHistories(req, res, next) {
  try {
    const result = await ticketHistoriesService.syncHistories();
    res.json(result);
  } catch (err) {
    res.json({ synced: 0, error: err.message });
  }
}

export async function syncHistoriesForTicket(req, res, next) {
  try {
    const ticketId = await resolveTicketId(req.params.ticketId);
    const result = await ticketHistoriesService.syncHistoriesForTicket(ticketId);
    res.json(result);
  } catch (err) {
    res.json({ synced: 0, error: err.message });
  }
}

export async function syncConversations(req, res, next) {
  try {
    const result = await ticketConversationsService.syncConversations();
    res.json(result);
  } catch (err) {
    res.json({ synced: 0, error: err.message });
  }
}

export async function syncConversationsForTicket(req, res, next) {
  try {
    const ticketId = await resolveTicketId(req.params.ticketId);
    const result = await ticketConversationsService.syncConversationsForTicket(ticketId);
    res.json(result);
  } catch (err) {
    res.json({ synced: 0, error: err.message });
  }
}

export async function getGroupMovements(req, res, next) {
  try {
    const { groupId, startDate, endDate, page, perPage } = req.query;
    const result = await ticketHistoriesService.getGroupMovements({
      groupId,
      startDate,
      endDate,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMovementStats(req, res, next) {
  try {
    const result = await ticketHistoriesService.getMovementStats();
    res.json(result);
  } catch (err) {
    next(err);
  }
}
