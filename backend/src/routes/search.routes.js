import { Router } from "express";
import { searchTickets } from "../controllers/search.controller.js";

const router = Router();

router.get("/", searchTickets);

export default router;
