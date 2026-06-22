import ticketRepository from "../repositories/ticket.repository.js";

export async function searchTickets(req, res, next) {
  try {
    const { q, page = 1, perPage = 20 } = req.query;
    if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });
    const result = await ticketRepository.search({
      query: q,
      page: Number(page),
      perPage: Number(perPage),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
