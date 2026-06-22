import ticketRepository from "../repositories/ticket.repository.js";

export async function getStats(req, res, next) {
  try {
    const stats = await ticketRepository.getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

export async function getGroupStats(req, res, next) {
  try {
    const data = await ticketRepository.getGroupStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPriorityStats(req, res, next) {
  try {
    const data = await ticketRepository.getPriorityStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getStatusStats(req, res, next) {
  try {
    const data = await ticketRepository.getStatusStats();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getTicketsPerDay(req, res, next) {
  try {
    const { days = 30 } = req.query;
    const data = await ticketRepository.getTicketsPerDay(Number(days));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getTopRequesters(req, res, next) {
  try {
    const data = await ticketRepository.getTopRequesters();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getTopEscalatedGroups(req, res, next) {
  try {
    const data = await ticketRepository.getTopEscalatedGroups();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
