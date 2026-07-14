import { Router } from "express";
import {
  listTickets,
  getTicket,
  syncTickets,
  syncSingleTicket,
  getTimeline,
  getSimilar,
  getSuggestions,
  aiReply,
  aiEscalation,
  downloadAttachment,
} from "../controllers/tickets.controller.js";
import { getTicketEvidences } from "../controllers/evidence.controller.js";

const router = Router();

router.get("/", listTickets);
router.get("/:id/timeline", getTimeline);
router.get("/:id/evidences", getTicketEvidences);
router.get("/:id/similar", getSimilar);
router.get("/:id/suggestions", getSuggestions);
router.post("/:id/ai-reply", aiReply);
router.post("/:id/ai-escalation", aiEscalation);
router.get("/:id", getTicket);
router.post("/sync", syncTickets);
router.post("/sync/:freshdeskId", syncSingleTicket);
router.get("/attachments/:id/download", downloadAttachment);

export default router;
