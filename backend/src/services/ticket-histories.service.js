import prisma from "../config/prisma.js";
import freshdesk from "./freshdesk.service.js";
import ticketRepository from "../repositories/ticket.repository.js";

class TicketHistoriesService {
  async getHistories(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { freshdeskTicketId: true },
    });
    if (!ticket) throw new Error("Ticket not found");

    try {
      const activities = await freshdesk.getActivities(ticket.freshdeskTicketId);
      if (Array.isArray(activities) && activities.length > 0) {
        const parsed = this._parseActivities(activities);
        return parsed;
      }
    } catch {}

    const cached = await prisma.ticketHistoryEntry.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
    });
    return cached;
  }

  async syncHistories() {
    const tickets = await prisma.ticket.findMany({
      select: { id: true, freshdeskTicketId: true },
    });

    let total = 0;
    for (const ticket of tickets) {
      try {
        const activities = await freshdesk.getActivities(ticket.freshdeskTicketId);
        const parsed = this._parseActivities(activities);

        for (const entry of parsed) {
          const existing = await prisma.ticketHistoryEntry.findFirst({
            where: {
              ticketId: ticket.id,
              createdAt: entry.createdAt,
              changedField: entry.changedField,
            },
          });
          if (!existing) {
            await prisma.ticketHistoryEntry.create({
              data: {
                ticketId: ticket.id,
                actorId: entry.actorId,
                actorName: entry.actorName,
                changedField: entry.changedField,
                oldValue: entry.oldValue,
                newValue: entry.newValue,
                createdAt: entry.createdAt,
              },
            });
            total++;
          }
        }

        await this._trackGroupMovements(ticket.id, parsed);
      } catch {
        continue;
      }
    }

    return { synced: total };
  }

  async syncHistoriesForTicket(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { freshdeskTicketId: true },
    });
    if (!ticket) throw new Error("Ticket not found");

    const activities = await freshdesk.getActivities(ticket.freshdeskTicketId);
    const parsed = this._parseActivities(activities);

    let count = 0;
    for (const entry of parsed) {
      const existing = await prisma.ticketHistoryEntry.findFirst({
        where: {
          ticketId: ticket.id,
          createdAt: entry.createdAt,
          changedField: entry.changedField,
        },
      });
      if (!existing) {
        await prisma.ticketHistoryEntry.create({
          data: {
            ticketId: ticket.id,
            actorId: entry.actorId,
            actorName: entry.actorName,
            changedField: entry.changedField,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            createdAt: entry.createdAt,
          },
        });
        count++;
      }
    }

    await this._trackGroupMovements(ticket.id, parsed);
    return { ticketId, synced: count };
  }

  _parseActivities(activities) {
    const entries = [];
    for (const act of activities) {
      if (act.type === "TicketCreated") {
        entries.push({
          actorId: String(act.actor_id || ""),
          actorName: act.actor_name || "System",
          changedField: "status",
          oldValue: "",
          newValue: "Open",
          createdAt: new Date(act.created_at),
        });
        continue;
      }

      if (act.type === "StatusChanged" || act.type === "Edit") {
        const changes = act.field_changes || {};
        for (const [field, change] of Object.entries(changes)) {
          entries.push({
            actorId: String(act.actor_id || ""),
            actorName: act.actor_name || "System",
            changedField: this._mapField(field),
            oldValue: String(change.previous_value ?? change.old_value ?? ""),
            newValue: String(change.new_value ?? change.current_value ?? ""),
            createdAt: new Date(act.created_at),
          });
        }
      }

      if (act.type === "Forward" || act.type === "Note" || act.type === "Reply" || act.type === "Email") {
        entries.push({
          actorId: String(act.actor_id || ""),
          actorName: act.actor_name || "System",
          changedField: act.type.toLowerCase(),
          oldValue: "",
          newValue: act.body_text || act.body || act.type,
          createdAt: new Date(act.created_at),
        });
      }
    }

    entries.sort((a, b) => a.createdAt - b.createdAt);
    return entries;
  }

  _mapField(field) {
    const map = {
      group_id: "assigned_group",
      status: "status",
      priority: "priority",
      responder_id: "assigned_agent",
      "group.name": "assigned_group",
      "status.name": "status",
    };
    return map[field] || field;
  }

  async _trackGroupMovements(ticketId, entries) {
    const groupChanges = entries.filter((e) => e.changedField === "assigned_group" && e.newValue);
    for (const change of groupChanges) {
      const existing = await prisma.ticketGroupMovement.findFirst({
        where: {
          ticketId,
          movedAt: change.createdAt,
        },
      });
      if (!existing) {
        await prisma.ticketGroupMovement.create({
          data: {
            ticketId,
            fromGroupId: change.oldValue || null,
            toGroupId: change.newValue,
            movedAt: change.createdAt,
            movedBy: change.actorName,
          },
        });
      }
    }
  }

  async getGroupMovements({ groupId, startDate, endDate, page = 1, perPage = 20 } = {}) {
    const where = {};
    if (groupId) {
      where.OR = [{ fromGroupId: groupId }, { toGroupId: groupId }];
    }
    if (startDate || endDate) {
      where.movedAt = {};
      if (startDate) where.movedAt.gte = new Date(startDate);
      if (endDate) where.movedAt.lte = new Date(endDate);
    }

    const skip = (page - 1) * perPage;
    const [movements, total] = await Promise.all([
      prisma.ticketGroupMovement.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { movedAt: "desc" },
        include: {
          ticket: {
            select: { freshdeskTicketId: true, subject: true },
          },
        },
      }),
      prisma.ticketGroupMovement.count({ where }),
    ]);

    const groupIds = [...new Set(movements.flatMap((m) => [m.fromGroupId, m.toGroupId].filter(Boolean)))];
    const mappings = groupIds.length > 0
      ? await prisma.groupMapping.findMany({ where: { groupId: { in: groupIds } } })
      : [];
    const groupMap = Object.fromEntries(mappings.map((m) => [m.groupId, m.groupName]));

    const data = movements.map((m) => ({
      id: m.id,
      ticketId: m.ticket.freshdeskTicketId,
      ticketUuid: m.ticketId,
      subject: m.ticket.subject,
      fromGroup: groupMap[m.fromGroupId] || m.fromGroupId,
      fromGroupId: m.fromGroupId,
      toGroup: groupMap[m.toGroupId] || m.toGroupId,
      toGroupId: m.toGroupId,
      movedAt: m.movedAt,
      movedBy: m.movedBy,
    }));

    return { data, total, page, perPage };
  }

  async getMovementStats() {
    const movements = await prisma.ticketGroupMovement.findMany({
      include: {
        ticket: {
          select: { freshdeskTicketId: true, subject: true },
        },
      },
      orderBy: { movedAt: "desc" },
    });

    const ticketMovementCount = {};
    for (const m of movements) {
      const tid = m.ticket.freshdeskTicketId;
      if (!ticketMovementCount[tid]) {
        ticketMovementCount[tid] = { ticketId: tid, ticketUuid: m.ticketId, subject: m.ticket.subject, count: 0 };
      }
      ticketMovementCount[tid].count++;
    }

    const mostMoved = Object.values(ticketMovementCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const fromToCount = {};
    for (const m of movements) {
      const key = `${m.fromGroupId || "none"}->${m.toGroupId || "none"}`;
      if (!fromToCount[key]) {
        fromToCount[key] = { fromGroupId: m.fromGroupId, toGroupId: m.toGroupId, count: 0 };
      }
      fromToCount[key].count++;
    }

    const flowEdges = Object.values(fromToCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    const groupIds = [...new Set(flowEdges.flatMap((e) => [e.fromGroupId, e.toGroupId].filter(Boolean)))];
    const mappings = groupIds.length > 0
      ? await prisma.groupMapping.findMany({ where: { groupId: { in: groupIds } } })
      : [];
    const groupMap = Object.fromEntries(mappings.map((m) => [m.groupId, m.groupName]));

    return {
      mostMoved,
      flowEdges: flowEdges.map((e) => ({
        fromGroup: groupMap[e.fromGroupId] || e.fromGroupId || "Unknown",
        toGroup: groupMap[e.toGroupId] || e.toGroupId || "Unknown",
        count: e.count,
      })),
    };
  }
}

export default new TicketHistoriesService();
