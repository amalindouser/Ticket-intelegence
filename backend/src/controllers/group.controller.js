import prisma from "../config/prisma.js";
import freshdesk from "../services/freshdesk.service.js";

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

export async function syncFromFreshdesk(req, res, next) {
  try {
    const fdGroups = await freshdesk.getGroups();
    const localMappings = await prisma.groupMapping.findMany();
    let matched = 0;

    for (const local of localMappings) {
      const fd = fdGroups.find(
        (g) => g.name.toLowerCase().trim() === local.groupName.toLowerCase().trim()
      );
      if (fd && fd.id !== local.freshdeskGroupId) {
        await prisma.groupMapping.update({
          where: { id: local.id },
          data: { freshdeskGroupId: fd.id },
        });
        matched++;
      }
    }

    const unmatched = localMappings.length - matched;
    res.json({ message: "Sync selesai", matched, unmatched, totalFdGroups: fdGroups.length });
  } catch (err) {
    next(err);
  }
}
