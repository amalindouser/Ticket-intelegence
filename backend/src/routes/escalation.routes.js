import { Router } from "express";
import { getInsights, addEvidence } from "../controllers/escalation.controller.js";
import { upload } from "../config/upload.js";

const router = Router();

router.get("/insights", getInsights);
router.post("/:id/evidence", upload.single("file"), addEvidence);

export default router;
