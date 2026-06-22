import relationService from "../services/relation.service.js";

export async function detectRelations(req, res, next) {
  try {
    const result = await relationService.detectRelations();
    res.json({ message: "Detection completed", ...result });
  } catch (err) {
    next(err);
  }
}

export async function getRelations(req, res, next) {
  try {
    const relations = await relationService.getRelations(req.params.id);
    if (!relations) return res.status(404).json({ error: "Ticket not found" });
    res.json(relations);
  } catch (err) {
    next(err);
  }
}
