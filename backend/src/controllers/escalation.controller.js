import ticketRepository from "../repositories/ticket.repository.js";
import prisma from "../config/prisma.js";

export async function getInsights(req, res, next) {
  try {
    const data = await ticketRepository.getEscalationInsights();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function addEvidence(req, res, next) {
  try {
    const { id } = req.params;
    const escalation = await prisma.escalation.findUnique({
      where: { id },
    });
    if (!escalation) {
      return res.status(404).json({ error: "Escalation not found" });
    }

    let attachmentUrl = req.body.attachmentUrl || null;
    let filename = req.body.filename || "evidence";
    let contentType = req.body.contentType || null;
    let fileSize = req.body.fileSize || null;

    if (req.file) {
      filename = req.file.originalname;
      contentType = req.file.mimetype;
      fileSize = req.file.size;
      attachmentUrl = `/uploads/${req.file.filename}`;
    }

    if (!attachmentUrl) {
      return res.status(400).json({ error: "file or attachmentUrl is required" });
    }

    if (!req.file && attachmentUrl && !attachmentUrl.startsWith("/uploads/")) {
      try {
        const parsed = new URL(attachmentUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Invalid URL protocol" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }
    }

    const evidence = await ticketRepository.addEscalationEvidence(id, {
      filename,
      contentType,
      fileSize,
      attachmentUrl,
    });

    res.status(201).json(evidence);
  } catch (err) {
    next(err);
  }
}
