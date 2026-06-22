import { Router } from "express";
import { postLogin, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../services/auth.service.js";

const router = Router();

router.post("/login", postLogin);
router.get("/me", authMiddleware, getMe);

export default router;