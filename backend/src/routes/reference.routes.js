import { Router } from "express";
import {
  getReferences,
  getReferenceGroups,
  addReference,
  deleteReference,
  refreshReferences,
} from "../controllers/reference.controller.js";

const router = Router();

router.get("/", getReferences);
router.get("/groups", getReferenceGroups);
router.post("/", addReference);
router.delete("/:id", deleteReference);
router.post("/refresh", refreshReferences);

export default router;
