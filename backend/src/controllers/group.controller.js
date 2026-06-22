import prisma from "../config/prisma.js";

export async function listMappings(req, res, next) {
  try {
    const mappings = await prisma.groupMapping.findMany({
      orderBy: { groupName: "asc" },
    });
    res.json(mappings);
  } catch (err) {
    next(err);
  }
}

export async function upsertMapping(req, res, next) {
  try {
    const { groupId, groupName, escalationEmail } = req.body;
    if (!groupId || !groupName) {
      return res.status(400).json({ error: "groupId and groupName are required" });
    }
    const mapping = await prisma.groupMapping.upsert({
      where: { groupId },
      update: { groupName, escalationEmail: escalationEmail || null },
      create: { groupId, groupName, escalationEmail: escalationEmail || null },
    });
    res.json(mapping);
  } catch (err) {
    next(err);
  }
}

export async function deleteMapping(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.groupMapping.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
