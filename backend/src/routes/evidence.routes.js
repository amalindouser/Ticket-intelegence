import { Router } from "express";
import { listEvidences, collectEvidences, deleteEvidence } from "../controllers/evidence.controller.js";

const router = Router();

router.get("/", listEvidences);
router.post("/collect", collectEvidences);
router.delete("/:id", deleteEvidence);

export default router;
