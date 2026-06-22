import { Router } from "express";
import {
  listMappings,
  upsertMapping,
  deleteMapping,
} from "../controllers/group.controller.js";

const router = Router();

router.get("/mappings", listMappings);
router.post("/mappings", upsertMapping);
router.delete("/mappings/:id", deleteMapping);

export default router;
