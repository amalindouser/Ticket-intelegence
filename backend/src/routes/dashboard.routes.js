import { Router } from "express";
import {
  getStats,
  getGroupStats,
  getPriorityStats,
  getStatusStats,
  getTicketsPerDay,
  getTopRequesters,
  getTopEscalatedGroups,
} from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/stats", getStats);
router.get("/groups", getGroupStats);
router.get("/priorities", getPriorityStats);
router.get("/statuses", getStatusStats);
router.get("/tickets-per-day", getTicketsPerDay);
router.get("/top-requesters", getTopRequesters);
router.get("/top-escalated-groups", getTopEscalatedGroups);

export default router;
