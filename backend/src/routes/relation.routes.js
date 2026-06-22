import { Router } from "express";
import { detectRelations, getRelations } from "../controllers/relation.controller.js";

const router = Router();

router.post("/detect", detectRelations);
router.get("/:id", getRelations);

export default router;
