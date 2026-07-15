import { Router } from "express";
import {
  listMappings,
  upsertMapping,
  deleteMapping,
  syncFromFreshdesk,
} from "../controllers/group.controller.js";

const router = Router();

router.get("/mappings", listMappings);
router.post("/mappings", upsertMapping);
router.delete("/mappings/:id", deleteMapping);
router.post("/sync-from-freshdesk", syncFromFreshdesk);

export default router;
