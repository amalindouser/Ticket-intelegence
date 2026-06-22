import { Router } from "express";
import { importKb, searchKb, listKb } from "../controllers/kb.controller.js";

const router = Router();

router.post("/import", importKb);
router.get("/search", searchKb);
router.get("/", listKb);

export default router;
