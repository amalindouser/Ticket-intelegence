import { Router } from "express";
import { chat, chatStream } from "../controllers/ai.controller.js";

const router = Router();

router.post("/chat", chat);
router.post("/chat/stream", chatStream);

export default router;
