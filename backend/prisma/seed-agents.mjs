import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

async function seed() {
  const agents = await prisma.ticketConversation.findMany({
    where: { isAgent: true, fromEmail: { not: null } },
    select: { fromEmail: true, actorName: true },
    distinct: ['fromEmail'],
  });

  const seen = new Set();
  const unique = [];
  for (const a of agents) {
    const email = a.fromEmail?.toLowerCase().trim();
    if (email && !seen.has(email) && !email.includes('freshdesk.com') && !email.includes('helpdesk') && email.includes('@')) {
      seen.add(email);
      const name = a.actorName ? a.actorName.replace(/["<>]/g, '').trim() : email.split('@')[0];
      unique.push({ email, name });
    }
  }

  // Also import actor names from histories as fake email agents
  const actors = await prisma.ticketHistoryEntry.findMany({
    where: { actorName: { not: null } },
    select: { actorName: true },
    distinct: ['actorName'],
  });

  const hash = await bcrypt.hash('aino123', 10);
  let created = 0;

  for (const a of unique) {
    const exists = await prisma.agent.findUnique({ where: { email: a.email } });
    if (!exists) {
      await prisma.agent.create({ data: { email: a.email, name: a.name, password: hash } });
      created++;
    }
  }

  for (const a of actors) {
    if (!a.actorName) continue;
    const raw = a.actorName.replace(/["<>]/g, '').trim();
    const slug = raw.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const email = slug + '@ainosi.co.id';
    if (!email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    const exists = await prisma.agent.findUnique({ where: { email } });
    if (!exists) {
      await prisma.agent.create({ data: { email, name: raw, password: hash } });
      created++;
    }
  }

  // Also create a default admin
  const adminEmail = 'admin@ainosi.co.id';
  const adminExists = await prisma.agent.findUnique({ where: { email: adminEmail } });
  if (!adminExists) {
    await prisma.agent.create({ data: { email: adminEmail, name: 'Admin', password: await bcrypt.hash('admin123', 10) } });
    created++;
  }

  console.log('Seeded', created, 'new agents');
  const all = await prisma.agent.findMany({ select: { email: true, name: true } });
  console.log('Total:', all.length);
  all.forEach(a => console.log('  -', a.email, '(' + (a.name || '?') + ')'));
  await prisma.$disconnect();
}
seed().catch(e => { console.error(e); process.exit(1); });
