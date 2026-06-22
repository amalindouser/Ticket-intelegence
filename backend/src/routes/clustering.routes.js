import { Router } from "express";
import { getTopicClusters, getEscalationFlow } from "../controllers/clustering.controller.js";

const router = Router();

router.get("/topics", getTopicClusters);
router.get("/escalation-flow", getEscalationFlow);

export default router;
