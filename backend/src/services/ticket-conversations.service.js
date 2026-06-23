import prisma from "../config/prisma.js";
import freshdesk from "./freshdesk.service.js";
import evidenceService, { extractInlineImages } from "./evidence.service.js";

class TicketConversationsService {
  async getConversations(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { freshdeskTicketId: true },
    });
    if (!ticket) throw new Error("Ticket not found");

    let conversations;
    try {
      conversations = await freshdesk.getConversations(ticket.freshdeskTicketId);
      if (Array.isArray(conversations) && conversations.length > 0) {
        const enriched = await this._enrichConversations(conversations, ticket.id);
        return enriched;
      }
    } catch {}

    const cached = await prisma.ticketConversation.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });
    return cached;
  }

  async syncConversations() {
    const tickets = await prisma.ticket.findMany({
      select: { id: true, freshdeskTicketId: true, createdAt: true },
    });

    let total = 0;
    let evTotal = 0;
    for (const ticket of tickets) {
      try {
        const conversations = await freshdesk.getConversations(ticket.freshdeskTicketId);
        const enriched = await this._enrichConversations(conversations, ticket.id);
        for (const conv of enriched) {
          const existing = await prisma.ticketConversation.findUnique({
            where: { conversationId: BigInt(conv.conversationId) },
          });
          if (!existing) {
            await prisma.ticketConversation.create({ data: conv });
            total++;
          }
        }

        const evCount = await this._syncConversationAttachments(ticket.freshdeskTicketId, conversations);
        if (evCount > 0) evTotal += evCount;
        await this._syncMergedParentEvidences(conversations);
      } catch {
        continue;
      }
    }

    return { synced: total, evidences: evTotal };
  }

  async syncConversationsForTicket(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { freshdeskTicketId: true, createdAt: true },
    });
    if (!ticket) throw new Error("Ticket not found");

    const conversations = await freshdesk.getConversations(ticket.freshdeskTicketId);
    const enriched = await this._enrichConversations(conversations, ticket.id);

    let count = 0;
    for (const conv of enriched) {
      const existing = await prisma.ticketConversation.findUnique({
        where: { conversationId: BigInt(conv.conversationId) },
      });
      if (!existing) {
        await prisma.ticketConversation.create({ data: conv });
        count++;
      }
    }

    const evCount = await this._syncConversationAttachments(ticket.freshdeskTicketId, conversations);
    await this._syncMergedParentEvidences(conversations);

    return { ticketId, synced: count, evidences: evCount };
  }

  async _syncConversationAttachments(freshdeskTicketId, conversations) {
    if (!Array.isArray(conversations)) return 0;
    let count = 0;
    for (const conv of conversations) {
      if (conv.attachments && conv.attachments.length > 0) {
        for (const att of conv.attachments) {
          const url = att.attachment_url?.url || att.url || att.attachment_url;
          if (!url) continue;
          const name = att.name || att.filename || `conv-attachment-${att.id}`;
          const existing = await prisma.evidence.findFirst({
            where: { ticketId: BigInt(freshdeskTicketId), fileName: name },
          });
          if (existing) continue;
          try {
            await evidenceService._processAttachment(
              freshdeskTicketId, name, att.content_type, url, att.size,
              { conversationId: conv.id, source: "conversation" }
            );
            count++;
          } catch {}
        }
      }
      if (conv.body) {
        const inlineImages = extractInlineImages(conv.body);
        for (const img of inlineImages) {
          const existing = await prisma.evidence.findFirst({
            where: { ticketId: BigInt(freshdeskTicketId), fileName: img.name },
          });
          if (existing) continue;
          try {
            await evidenceService._processAttachment(
              freshdeskTicketId, img.name, img.contentType, img.url, null,
              { conversationId: conv.id, source: "conversation" }
            );
            count++;
          } catch {}
        }
      }
    }
    return count;
  }

  async _syncMergedParentEvidences(conversations) {
    if (!Array.isArray(conversations)) return;
    const mergeRegex = /This ticket is closed and merged into ticket (\d+)/i;
    for (const conv of conversations) {
      const body = conv.body_text || conv.body || "";
      const match = body.match(mergeRegex);
      if (match) {
        const parentId = Number(match[1]);
        if (!parentId) continue;
        try {
          const parentConvs = await freshdesk.getConversations(parentId);
          if (parentConvs.length > 0) {
            await this._syncConversationAttachments(parentId, parentConvs);
          }
        } catch {}
        return;
      }
    }
  }

  async _enrichConversations(conversations, ticketId) {
    if (!Array.isArray(conversations)) return [];

    const agentEmails = new Set();
    const domain = process.env.FRESHDESK_DOMAIN;
    if (domain) {
      agentEmails.add(`support@${domain}`);
      agentEmails.add(`helpdesk@${domain}`);
    }
    const groupMappings = await prisma.groupMapping.findMany();
    for (const gm of groupMappings) {
      if (gm.escalationEmail) {
        gm.escalationEmail.split(",").map((e) => e.trim()).filter(Boolean).forEach((e) => agentEmails.add(e.toLowerCase()));
      }
    }

    const agentPatterns = ["support@", "helpdesk@", "@freshdesk.com", "@ainosi.co.id"];

    const sorted = [...conversations].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    const enriched = [];
    for (let i = 0; i < sorted.length; i++) {
      const conv = sorted[i];
      const fromEmail = conv.from_email || conv.email || null;
      const fromLower = fromEmail ? fromEmail.toLowerCase() : "";
      const isAgent = fromEmail
        ? agentEmails.has(fromLower) || agentPatterns.some((p) => fromLower.includes(p))
        : false;

      let responseTimeMinutes = null;
      if (i > 0) {
        const prev = sorted[i - 1];
        const prevIsAgent = prev.from_email
          ? agentEmails.has(prev.from_email.toLowerCase()) || agentPatterns.some((p) => prev.from_email.toLowerCase().includes(p))
          : false;
        if (isAgent !== prevIsAgent) {
          const prevTime = new Date(prev.created_at).getTime();
          const currTime = new Date(conv.created_at).getTime();
          responseTimeMinutes = Math.round((currTime - prevTime) / (1000 * 60));
        }
      }

      enriched.push({
        ticketId,
        conversationId: BigInt(conv.id),
        body: conv.body || null,
        bodyText: conv.body_text || null,
        fromEmail,
        actorName: conv.user_name || conv.actor_name || fromEmail || null,
        isAgent,
        responseTimeMinutes,
        createdAt: new Date(conv.created_at),
      });
    }

    return enriched;
  }
}

export default new TicketConversationsService();
