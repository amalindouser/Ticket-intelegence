import evidenceService from "../services/evidence.service.js";

export async function getTicketEvidences(req, res, next) {
  try {
    const ticketId = req.params.id || req.params.ticketId;
    const result = await evidenceService.getTicketEvidences(ticketId);
    res.json({ ticketId: Number(ticketId), count: result.length, data: result });
  } catch (err) { next(err); }
}

export async function collectEvidences(req, res, next) {
  try {
    const { ticketIds } = req.body;
    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: "ticketIds must be a non-empty array" });
    }
    const result = await evidenceService.collectFromTickets(ticketIds);
    res.json({ processed: result.length, results: result });
  } catch (err) { next(err); }
}

export async function listEvidences(req, res, next) {
  try {
    const { ticketId, fileType, dateFrom, dateTo, search, page, perPage } = req.query;
    const result = await evidenceService.listEvidences({
      ticketId,
      fileType,
      dateFrom,
      dateTo,
      search,
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 20,
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function downloadEvidence(req, res, next) {
  try {
    const ev = await evidenceService.downloadEvidence(req.params.id);
    if (!ev) return res.status(404).json({ error: "Evidence tidak ditemukan" });
    res.setHeader("Content-Disposition", `inline; filename="${ev.fileName}"`);
    res.sendFile(ev.filePath);
  } catch (err) { next(err); }
}

export async function deleteEvidence(req, res, next) {
  try {
    await evidenceService.deleteEvidence(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}
