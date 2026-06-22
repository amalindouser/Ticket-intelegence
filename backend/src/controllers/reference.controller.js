import prisma from "../config/prisma.js";

export async function getReferences(req, res, next) {
  try {
    const { groupId } = req.query;
    const where = groupId ? { groupId } : {};
    const data = await prisma.referenceEmail.findMany({
      where,
      orderBy: [{ groupId: "asc" }, { role: "asc" }, { email: "asc" }],
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getReferenceGroups(req, res, next) {
  try {
    const data = await prisma.$queryRaw`
      SELECT
        gm.group_name,
        re.group_id,
        json_agg(json_build_object('email', re.email, 'name', re.name, 'role', re.role) ORDER BY re.role, re.email) as emails
      FROM reference_emails re
      JOIN group_mappings gm ON gm.group_id = re.group_id
      GROUP BY gm.group_name, re.group_id
      ORDER BY gm.group_name
    `;
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function addReference(req, res, next) {
  try {
    const { email, name, groupId, role } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const data = await prisma.referenceEmail.create({
      data: { email, name, groupId, role: role || "to" },
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteReference(req, res, next) {
  try {
    await prisma.referenceEmail.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function refreshReferences(req, res, next) {
  try {
    await prisma.$executeRaw`DELETE FROM reference_emails WHERE source = 'participant'`;
    await prisma.$executeRaw`
      INSERT INTO reference_emails (email, name, group_id, role, source)
      SELECT DISTINCT ON (p.email, t.assigned_group, p.role)
        CASE
          WHEN p.email ~ '<([^>]+)>' THEN regexp_replace(p.email, '.*<([^>]+)>.*', '\\1')
          ELSE p.email
        END,
        CASE
          WHEN p.email ~ '^"(.+)" <' THEN regexp_replace(p.email, '"(.+)" <.*', '\\1')
          ELSE NULL
        END,
        t.assigned_group,
        p.role,
        'participant'
      FROM participants p
      JOIN tickets t ON t.id = p.ticket_id
      WHERE t.assigned_group IS NOT NULL
      ORDER BY p.email, t.assigned_group, p.role
    `;
    const count = await prisma.referenceEmail.count({ where: { source: 'participant' } });
    res.json({ refreshed: count });
  } catch (err) {
    next(err);
  }
}
