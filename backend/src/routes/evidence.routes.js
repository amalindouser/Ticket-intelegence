import { Router } from "express";
import { listEvidences, collectEvidences, downloadEvidence, deleteEvidence } from "../controllers/evidence.controller.js";

const router = Router();

router.get("/", listEvidences);
router.get("/:id/download", downloadEvidence);
router.post("/collect", collectEvidences);
router.delete("/:id", deleteEvidence);

export default router;
