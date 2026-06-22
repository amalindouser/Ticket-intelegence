import { Router } from "express";
import {
  getTicketHistories,
  getTicketConversations,
  syncHistories,
  syncHistoriesForTicket,
  syncConversations,
  syncConversationsForTicket,
  getGroupMovements,
  getMovementStats,
} from "../controllers/ticket-histories.controller.js";

const router = Router();

router.get("/:ticketId/histories", getTicketHistories);
router.get("/:ticketId/conversations", getTicketConversations);
router.post("/sync-histories", syncHistories);
router.post("/sync-histories/:ticketId", syncHistoriesForTicket);
router.post("/sync-conversations", syncConversations);
router.post("/sync-conversations/:ticketId", syncConversationsForTicket);
router.get("/group-movements", getGroupMovements);
router.get("/group-movements/stats", getMovementStats);

export default router;
