import prisma from "../config/prisma.js";

class TicketRepository {
  async findByFreshdeskId(freshdeskId) {
    return prisma.ticket.findUnique({
      where: { freshdeskTicketId: BigInt(freshdeskId) },
    });
  }

  async create(data) {
    const ticket = await prisma.ticket.create({
      data: {
        freshdeskTicketId: BigInt(data.freshdeskTicketId),
        subject: data.subject,
        description: data.description,
        status: data.status,
        priority: data.priority,
        requesterEmail: data.requesterEmail,
        assignedGroup: data.assignedGroup,
        assignedAgent: data.assignedAgent,
        tags: data.tags,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });

    if (data.assignedGroup) {
      await prisma.ticketGroupMovement.create({
        data: {
          ticketId: ticket.id,
          fromGroupId: data._originalGroup || null,
          toGroupId: data.assignedGroup,
          movedAt: data.createdAt,
          movedBy: data._movedBy || "System (initial assignment)",
        },
      });
    }

    return ticket;
  }

  async update(id, data) {
    return prisma.ticket.update({
      where: { id },
      data: {
        subject: data.subject,
        description: data.description,
        status: data.status,
        priority: data.priority,
        requesterEmail: data.requesterEmail,
        assignedGroup: data.assignedGroup,
        assignedAgent: data.assignedAgent,
        tags: data.tags,
        updatedAt: data.updatedAt,
      },
    });
  }

  async upsert(data) {
    const existing = await this.findByFreshdeskId(data.freshdeskTicketId);
    if (existing) {
      await this.saveChanges(existing, data);
      return this.update(existing.id, data);
    }
    return this.create(data);
  }

  async saveChanges(oldTicket, newData) {
    const changes = [];
    const fields = [
      { key: "status", label: "status" },
      { key: "priority", label: "priority" },
      { key: "assignedGroup", label: "assigned_group" },
      { key: "assignedAgent", label: "assigned_agent" },
      { key: "subject", label: "subject" },
      { key: "description", label: "description" },
    ];

    for (const { key, label } of fields) {
      const oldVal = oldTicket[key];
      const newVal = newData[key];
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        changes.push({
          ticketId: oldTicket.id,
          fieldName: label,
          oldValue: String(oldVal ?? ""),
          newValue: String(newVal ?? ""),
          changedAt: new Date(),
        });
      }
    }

    if (changes.length > 0) {
      await prisma.ticketHistory.createMany({ data: changes });
    }

    const oldGroup = oldTicket.assignedGroup;
    const newGroup = newData.assignedGroup;
    if (String(oldGroup ?? "") !== String(newGroup ?? "")) {
      await prisma.ticketGroupMovement.create({
        data: {
          ticketId: oldTicket.id,
          fromGroupId: oldGroup || null,
          toGroupId: newGroup || null,
          movedAt: new Date(),
          movedBy: newData._movedBy || "System (auto-detect)",
        },
      });
    }
  }

  async findAll({ page = 1, perPage = 20 } = {}) {
    const skip = (page - 1) * perPage;
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        skip,
        take: perPage,
        orderBy: { createdAt: "desc" },
        include: { participants: true },
      }),
      prisma.ticket.count(),
    ]);
    return { tickets, total, page, perPage };
  }

  async findById(id) {
    const where = id.includes("-")
      ? { id }
      : { freshdeskTicketId: BigInt(id) };
    return prisma.ticket.findFirst({
      where,
      include: {
        participants: true,
        attachments: true,
        conversations: { orderBy: { createdAt: "asc" } },
        escalations: {
          orderBy: { createdAt: "desc" },
          include: { attachments: true },
        },
      },
    });
  }

  async search({ query, page = 1, perPage = 20 }) {
    const skip = (page - 1) * perPage;
    const idFilter = !isNaN(query)
      ? { freshdeskTicketId: { equals: BigInt(query) } }
      : undefined;
    const where = {
      OR: [
        idFilter,
        { subject: { contains: query, mode: "insensitive" } },
        { requesterEmail: { contains: query, mode: "insensitive" } },
      ].filter(Boolean),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ticket.count({ where }),
    ]);
    return { tickets, total, page, perPage };
  }

  async syncConversations(ticketId, conversations) {
    for (const conv of conversations) {
      await prisma.conversation.upsert({
        where: {
          freshdeskConversationId: BigInt(conv.id),
        },
        create: {
          freshdeskConversationId: BigInt(conv.id),
          ticketId,
          senderEmail: conv.from_email || conv.user_id?.toString(),
          body: conv.body_text || conv.body,
          createdAt: new Date(conv.created_at),
        },
        update: {},
      });
    }
  }

  async syncAttachments(ticketId, attachments) {
    for (const att of attachments) {
      const url = typeof att.attachment_url === "string"
        ? att.attachment_url
        : att.attachment_url?.url || att.url || null;
      await prisma.attachment.create({
        data: {
          ticketId,
          filename: att.name || att.filename || "unknown",
          contentType: att.content_type,
          fileSize: att.size ? Number(att.size) : null,
          attachmentUrl: url,
        },
      });
    }
  }

  async addEscalationEvidence(escalationId, evidence) {
    return prisma.attachment.create({
      data: {
        escalationId,
        filename: evidence.filename,
        contentType: evidence.contentType || null,
        fileSize: evidence.fileSize ? Number(evidence.fileSize) : null,
        attachmentUrl: evidence.attachmentUrl,
      },
    });
  }

  async syncParticipants(ticketId, emails, role) {
    await prisma.participant.deleteMany({
      where: { ticketId, role },
    });
    for (const email of emails) {
      await prisma.participant.create({
        data: {
          ticketId,
          email,
          role,
        },
      });
    }
  }

  async getDashboardStats() {
    const [total, openTickets, closedTickets, highPriority] =
      await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.count({ where: { status: { in: [2, 3] } } }),
        prisma.ticket.count({ where: { status: { in: [4, 5] } } }),
        prisma.ticket.count({ where: { priority: { in: [3, 4] } } }),
      ]);

    return {
      totalTickets: total,
      openTickets,
      closedTickets,
      highPriorityTickets: highPriority,
    };
  }

  async getGroupStats() {
    const tickets = await prisma.ticket.findMany({
      where: { assignedGroup: { not: null } },
      select: { assignedGroup: true },
    });
    const map = {};
    for (const t of tickets) {
      const g = t.assignedGroup;
      map[g] = (map[g] || 0) + 1;
    }
    return Object.entries(map).map(([group, count]) => ({ group, count }));
  }

  async getPriorityStats() {
    const groups = await prisma.ticket.groupBy({
      by: ["priority"],
      _count: { id: true },
    });
    const labels = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };
    return groups.map((g) => ({
      priority: labels[g.priority] || `P${g.priority}`,
      count: g._count.id,
    }));
  }

  async getStatusStats() {
    const groups = await prisma.ticket.groupBy({
      by: ["status"],
      _count: { id: true },
    });
    const labels = { 2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed" };
    return groups.map((g) => ({
      status: labels[g.status] || `S${g.status}`,
      count: g._count.id,
    }));
  }

  async getTicketsPerDay(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const tickets = await prisma.ticket.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const map = {};
    for (const t of tickets) {
      const day = t.createdAt.toISOString().slice(0, 10);
      map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }

  async getTopRequesters(limit = 10) {
    const groups = await prisma.ticket.groupBy({
      by: ["requesterEmail"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });
    return groups.map((g) => ({
      email: g.requesterEmail,
      count: g._count.id,
    }));
  }

  async getTopEscalatedGroups(limit = 10) {
    const groups = await prisma.escalation.groupBy({
      by: ["teamName"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit,
    });
    return groups.map((g) => ({
      group: g.teamName,
      count: g._count.id,
    }));
  }

  async getTimeline(ticketId) {
    const where = ticketId.includes("-")
      ? { id: ticketId }
      : { freshdeskTicketId: BigInt(ticketId) };
    const ticket = await prisma.ticket.findFirst({
      where,
      select: {
        id: true,
        createdAt: true,
        status: true,
        assignedGroup: true,
        assignedAgent: true,
      },
    });
    if (!ticket) return null;

    const history = await prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: { changedAt: "asc" },
    });

    const groupIds = [...new Set(history.filter(h => h.fieldName === "assigned_group").map(h => h.newValue).filter(Boolean))];
    const groupMappings = groupIds.length > 0
      ? await prisma.groupMapping.findMany({ where: { groupId: { in: groupIds } } })
      : [];
    const groupMap = Object.fromEntries(groupMappings.map(m => [m.groupId, m.groupName]));

    const timeline = [
      {
        type: "created",
        timestamp: ticket.createdAt,
      },
    ];

    let currentGroup = null;
    let currentAgent = null;

    for (const h of history) {
      if (h.fieldName === "status") {
        timeline.push({
          type: "status_changed",
          from: h.oldValue,
          to: h.newValue,
          timestamp: h.changedAt,
        });
      } else if (h.fieldName === "assigned_group") {
        currentGroup = h.newValue;
        timeline.push({
          type: "assigned",
          group: h.newValue,
          groupName: groupMap[h.newValue] || h.newValue,
          timestamp: h.changedAt,
        });
      } else if (h.fieldName === "assigned_agent") {
        currentAgent = h.newValue;
        timeline.push({
          type: "agent_assigned",
          agent: h.newValue,
          timestamp: h.changedAt,
        });
      } else {
        timeline.push({
          type: h.fieldName,
          from: h.oldValue,
          to: h.newValue,
          timestamp: h.changedAt,
        });
      }
    }

    return timeline;
  }

  async findSimilar(ticketId) {
    const where = ticketId.includes("-")
      ? { id: ticketId }
      : { freshdeskTicketId: BigInt(ticketId) };
    const ticket = await prisma.ticket.findFirst({
      where,
      select: {
        id: true,
        subject: true,
        tags: true,
        requesterEmail: true,
        assignedGroup: true,
      },
    });
    if (!ticket) return [];

    const conditions = [];
    if (ticket.requesterEmail) {
      conditions.push({ requesterEmail: ticket.requesterEmail });
    }
    if (ticket.assignedGroup) {
      conditions.push({ assignedGroup: ticket.assignedGroup });
    }
    if (ticket.tags) {
      const tags = ticket.tags.split(",").map((t) => t.trim()).filter(Boolean);
      for (const tag of tags) {
        conditions.push({ tags: { contains: tag, mode: "insensitive" } });
      }
    }
    if (ticket.subject) {
      const words = ticket.subject
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      for (const word of words) {
        conditions.push({ subject: { contains: word, mode: "insensitive" } });
      }
    }

    if (conditions.length === 0) return [];

    const similar = await prisma.ticket.findMany({
      where: {
        id: { not: ticketId },
        OR: conditions,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        freshdeskTicketId: true,
        subject: true,
        status: true,
        priority: true,
        requesterEmail: true,
        assignedGroup: true,
        tags: true,
        createdAt: true,
      },
    });

    return similar;
  }

  async getSuggestions(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        subject: true,
        tags: true,
        requesterEmail: true,
        assignedGroup: true,
      },
    });
    if (!ticket) return [];

    const conditions = [];
    if (ticket.requesterEmail) {
      conditions.push({ requesterEmail: ticket.requesterEmail });
    }
    if (ticket.assignedGroup) {
      conditions.push({ assignedGroup: ticket.assignedGroup });
    }
    if (ticket.tags) {
      const tags = ticket.tags.split(",").map((t) => t.trim()).filter(Boolean);
      for (const tag of tags) {
        conditions.push({ tags: { contains: tag, mode: "insensitive" } });
      }
    }
    if (ticket.subject) {
      const words = ticket.subject
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 5);
      for (const word of words) {
        conditions.push({ subject: { contains: word, mode: "insensitive" } });
      }
    }

    if (conditions.length === 0) return [];

    const suggestions = await prisma.ticket.findMany({
      where: {
        id: { not: ticketId },
        status: { in: [4, 5] },
        OR: conditions,
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        freshdeskTicketId: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        conversations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, senderEmail: true, createdAt: true },
        },
      },
    });

    return suggestions.map((s) => ({
      id: s.id,
      freshdeskTicketId: s.freshdeskTicketId,
      subject: s.subject,
      status: s.status,
      priority: s.priority,
      createdAt: s.createdAt,
      lastReply: s.conversations[0] || null,
    }));
  }

  async getEscalationInsights() {
    const escalations = await prisma.escalation.findMany({
      include: {
        ticket: {
          select: {
            id: true,
            subject: true,
            assignedGroup: true,
            assignedAgent: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const groupMap = {};
    const agentMap = {};
    const keywordMap = {};
    const durationTotal = {};
    const durationCount = {};

    for (const esc of escalations) {
      const g = esc.teamName;
      if (!groupMap[g]) groupMap[g] = 0;
      groupMap[g]++;

      if (esc.agentName) {
        if (!agentMap[esc.agentName]) agentMap[esc.agentName] = 0;
        agentMap[esc.agentName]++;
      }

      if (esc.ticket?.subject) {
        const words = esc.ticket.subject
          .split(/\s+/)
          .filter((w) => w.length > 4);
        for (const w of words) {
          if (!keywordMap[w]) keywordMap[w] = { count: 0, groups: new Set() };
          keywordMap[w].count++;
          keywordMap[w].groups.add(g);
        }
      }

      if (esc.ticket?.createdAt) {
        const duration =
          (esc.createdAt.getTime() - esc.ticket.createdAt.getTime()) /
          (1000 * 60);
        if (!durationTotal[g]) {
          durationTotal[g] = 0;
          durationCount[g] = 0;
        }
        durationTotal[g] += duration;
        durationCount[g]++;
      }
    }

    const agents = Object.entries(agentMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([agent, count]) => ({ agent, count }));

    const groups = Object.entries(groupMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([group, count]) => ({ group, count }));

    const keywords = Object.entries(keywordMap)
      .map(([word, data]) => ({
        keyword: word,
        count: data.count,
        groups: [...data.groups],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const avgDuration = Object.entries(durationTotal).map(
      ([group, total]) => ({
        group,
        avgMinutes: Math.round(total / durationCount[group]),
      })
    );

    return { keywords, groups, agents, avgDuration };
  }

  async createSyncLog(data) {
    return prisma.syncLog.create({ data });
  }

  async updateSyncLog(id, data) {
    return prisma.syncLog.update({ where: { id }, data });
  }
}

export default new TicketRepository();
