import { Router } from "express";
import ticketsRoutes from "./tickets.routes.js";
import searchRoutes from "./search.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import escalationRoutes from "./escalation.routes.js";
import groupRoutes from "./group.routes.js";
import aiRoutes from "./ai.routes.js";
import kbRoutes from "./kb.routes.js";
import referenceRoutes from "./reference.routes.js";
import evidenceRoutes from "./evidence.routes.js";
import clusteringRoutes from "./clustering.routes.js";
import timelineRoutes from "./timeline.routes.js";
import relationRoutes from "./relation.routes.js";
import authRoutes from "./auth.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/tickets", timelineRoutes);
router.use("/tickets", ticketsRoutes);
router.use("/evidences", evidenceRoutes);
router.use("/search", searchRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/escalations", escalationRoutes);
router.use("/groups", groupRoutes);
router.use("/ai", aiRoutes);
router.use("/kb", kbRoutes);
router.use("/references", referenceRoutes);
router.use("/clustering", clusteringRoutes);
router.use("/relations", relationRoutes);

export default router;
