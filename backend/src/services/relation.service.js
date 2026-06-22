import prisma from "../config/prisma.js";

class RelationService {
  async detectRelations() {
    const tickets = await prisma.ticket.findMany({
      where: { requesterEmail: { not: null } },
      select: {
        id: true,
        freshdeskTicketId: true,
        requesterEmail: true,
        subject: true,
        status: true,
        createdAt: true,
        parentTicketId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const byEmail = {};
    for (const t of tickets) {
      const email = t.requesterEmail.toLowerCase();
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(t);
    }

    let linked = 0;
    for (const [, group] of Object.entries(byEmail)) {
      if (group.length < 2) continue;

      for (let i = 1; i < group.length; i++) {
        const child = group[i];
        if (child.parentTicketId) continue;

        const candidates = [];
        for (let j = 0; j < i; j++) {
          const parent = group[j];
          const daysDiff = (child.createdAt.getTime() - parent.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff < 0 || daysDiff > 14) continue;
          const parentClosed = [4, 5].includes(parent.status);
          if (parentClosed && daysDiff <= 7) {
            candidates.push({ parent, score: this._subjectSimilarity(parent.subject, child.subject) });
          }
        }

        if (candidates.length === 0) continue;
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        if (best.score >= 0.3) {
          await prisma.ticket.update({
            where: { id: child.id },
            data: { parentTicketId: best.parent.id, resolutionPath: "spawned" },
          });
          if (best.parent.resolutionPath === "unknown") {
            await prisma.ticket.update({
              where: { id: best.parent.id },
              data: { resolutionPath: "spawned" },
            });
          }
          linked++;
        }
      }
    }

    // Mark remaining resolved tickets as in_thread
    const updated = await prisma.ticket.updateMany({
      where: {
        status: { in: [4, 5] },
        resolutionPath: "unknown",
        parentTicketId: null,
      },
      data: { resolutionPath: "in_thread" },
    });

    return { linked, markedResolved: updated.count };
  }

  _subjectSimilarity(a, b) {
    if (!a || !b) return 0;
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    return intersection / Math.max(wordsA.size, wordsB.size);
  }

  async getRelations(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        freshdeskTicketId: true,
        subject: true,
        parentTicketId: true,
        resolutionPath: true,
        parentTicket: {
          select: { id: true, freshdeskTicketId: true, subject: true, status: true, resolutionPath: true },
        },
        childTickets: {
          select: { id: true, freshdeskTicketId: true, subject: true, status: true, resolutionPath: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!ticket) return null;
    return ticket;
  }
}

export default new RelationService();
