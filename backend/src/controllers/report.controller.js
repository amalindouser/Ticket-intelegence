import prisma from "../config/prisma.js";

const STATUS_LABELS = { 2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed" };
const PRIORITY_LABELS = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };

function toCsv(data) {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const lines = [headers.join(",")];
  for (const row of data) {
    lines.push(
      headers.map((h) => {
        const v = row[h];
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    );
  }
  return lines.join("\n");
}

function sendCsv(res, filename, data) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(toCsv(data));
}

export async function getReport(req, res, next) {
  try {
    const { type, startDate, endDate, group, priority, status, days, limit, fileType, export: exp } = req.query;
    const isCsv = exp === "csv";
    let data;
    let filename;

    switch (type) {
      case "summary": {
        const [total, open, pending, resolved, closed, high, medium, urgent, low] =
          await Promise.all([
            prisma.ticket.count(),
            prisma.ticket.count({ where: { status: 2 } }),
            prisma.ticket.count({ where: { status: 3 } }),
            prisma.ticket.count({ where: { status: 4 } }),
            prisma.ticket.count({ where: { status: 5 } }),
            prisma.ticket.count({ where: { priority: 4 } }),
            prisma.ticket.count({ where: { priority: 3 } }),
            prisma.ticket.count({ where: { priority: 2 } }),
            prisma.ticket.count({ where: { priority: 1 } }),
          ]);
        data = [{ metric: "Total Tiket", value: total }, { metric: "Open", value: open }, { metric: "Pending", value: pending }, { metric: "Resolved", value: resolved }, { metric: "Closed", value: closed }, { metric: "Urgent", value: urgent }, { metric: "High", value: high }, { metric: "Medium", value: medium }, { metric: "Low", value: low }];
        filename = "laporan-ringkasan.csv";
        break;
      }
      case "by-status": {
        const groups = await prisma.ticket.groupBy({ by: ["status"], _count: { id: true } });
        data = groups.map((g) => ({ status: STATUS_LABELS[g.status] || `S${g.status}`, jumlah: g._count.id }));
        filename = "laporan-per-status.csv";
        break;
      }
      case "by-priority": {
        const groups = await prisma.ticket.groupBy({ by: ["priority"], _count: { id: true } });
        data = groups.map((g) => ({ prioritas: PRIORITY_LABELS[g.priority] || `P${g.priority}`, jumlah: g._count.id }));
        filename = "laporan-per-prioritas.csv";
        break;
      }
      case "by-group": {
        const tickets = await prisma.ticket.findMany({ where: { assignedGroup: { not: null } }, select: { assignedGroup: true } });
        const groupMaps = await prisma.groupMapping.findMany();
        const nameMap = {};
        for (const m of groupMaps) nameMap[m.groupId] = m.groupName;
        const map = {};
        for (const t of tickets) {
          const g = t.assignedGroup;
          map[g] = (map[g] || 0) + 1;
        }
        data = Object.entries(map).map(([id, count]) => ({ group_id: id, group: nameMap[id] || id, jumlah: count }));
        data.sort((a, b) => b.jumlah - a.jumlah);
        filename = "laporan-per-grup.csv";
        break;
      }
      case "per-day": {
        const nDays = Math.min(Math.max(Number(days) || 30, 1), 365);
        const since = new Date();
        since.setDate(since.getDate() - nDays);
        const tickets = await prisma.ticket.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true }, orderBy: { createdAt: "asc" } });
        const map = {};
        for (const t of tickets) {
          const day = t.createdAt.toISOString().slice(0, 10);
          map[day] = (map[day] || 0) + 1;
        }
        data = Object.entries(map).map(([date, count]) => ({ tanggal: date, jumlah: count }));
        filename = "laporan-per-hari.csv";
        break;
      }
      case "top-requesters": {
        const lim = Math.min(Number(limit) || 10, 100);
        const groups = await prisma.ticket.groupBy({ by: ["requesterEmail"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: lim });
        data = groups.map((g, i) => ({ peringkat: i + 1, email: g.requesterEmail, jumlah_tiket: g._count.id }));
        filename = "laporan-top-requester.csv";
        break;
      }
      case "all-tickets": {
        const where = {};
        const flt = [];
        if (status) flt.push({ status: Number(status) });
        if (priority) flt.push({ priority: Number(priority) });
        if (group) flt.push({ assignedGroup: group });
        if (startDate || endDate) {
          const dateFilter = {};
          if (startDate) dateFilter.gte = new Date(startDate);
          if (endDate) dateFilter.lte = new Date(endDate);
          flt.push({ createdAt: dateFilter });
        }
        if (flt.length > 0) where.AND = flt;

        const tickets = await prisma.ticket.findMany({
          where,
          include: { participants: { select: { email: true, role: true } } },
          orderBy: { createdAt: "desc" },
        });
        const groupMaps = await prisma.groupMapping.findMany();
        const nameMap = {};
        for (const m of groupMaps) nameMap[m.groupId] = m.groupName;

        data = tickets.map((t) => ({
          id_tiket: t.freshdeskTicketId?.toString(),
          subjek: t.subject,
          status: STATUS_LABELS[t.status] || t.status,
          prioritas: PRIORITY_LABELS[t.priority] || t.priority,
          grup: nameMap[t.assignedGroup] || t.assignedGroup || "",
          pengirim: t.requesterEmail || "",
          tags: t.tags || "",
          dibuat: t.createdAt?.toISOString(),
          diupdate: t.updatedAt?.toISOString(),
        }));
        filename = "laporan-semua-tiket.csv";
        break;
      }
      case "group-movements": {
        const where = {};
        if (startDate || endDate) {
          const dateFilter = {};
          if (startDate) dateFilter.gte = new Date(startDate);
          if (endDate) dateFilter.lte = new Date(endDate);
          where.movedAt = dateFilter;
        }
        const movements = await prisma.ticketGroupMovement.findMany({
          where,
          include: { ticket: { select: { freshdeskTicketId: true, subject: true } } },
          orderBy: { movedAt: "desc" },
        });
        const groupMaps = await prisma.groupMapping.findMany();
        const nameMap = {};
        for (const m of groupMaps) nameMap[m.groupId] = m.groupName;

        data = movements.map((m) => ({
          id_tiket: m.ticket?.freshdeskTicketId?.toString() || "",
          subjek: m.ticket?.subject || "",
          dari_grup: nameMap[m.fromGroupId] || m.fromGroupId || "",
          ke_grup: nameMap[m.toGroupId] || m.toGroupId || "",
          dipindah_oleh: m.movedBy || "",
          waktu: m.movedAt?.toISOString(),
        }));
        filename = "laporan-pergerakan-grup.csv";
        break;
      }
      case "escalations": {
        const escalations = await prisma.escalation.findMany({
          include: { ticket: { select: { freshdeskTicketId: true, subject: true } } },
          orderBy: { createdAt: "desc" },
        });
        data = escalations.map((e) => ({
          id_tiket: e.ticket?.freshdeskTicketId?.toString() || "",
          subjek: e.ticket?.subject || "",
          tim: e.teamName || "",
          agen: e.agentName || "",
          catatan: (e.notes || "").replace(/["\n]/g, " "),
          waktu: e.createdAt?.toISOString(),
        }));
        filename = "laporan-eskalasi.csv";
        break;
      }
      case "evidences": {
        const where = {};
        if (fileType) where.fileType = fileType;
        if (status) where.ticketId = BigInt(status);
        const evidences = await prisma.evidence.findMany({ where, orderBy: { createdAt: "desc" } });
        data = evidences.map((e) => ({
          id_tiket: e.ticketId?.toString(),
          nama_file: e.fileName,
          tipe: e.fileType,
          ukuran: e.fileSize ? `${Math.round(e.fileSize / 1024)} KB` : "",
          sumber: e.source || "",
          dibuat: e.createdAt?.toISOString(),
        }));
        filename = "laporan-evidence.csv";
        break;
      }
      default:
        return res.status(400).json({ error: `Report type "${type}" not recognized. Available: summary, by-status, by-priority, by-group, per-day, top-requesters, all-tickets, group-movements, escalations, evidences` });
    }

    if (isCsv) {
      sendCsv(res, filename, data);
    } else {
      res.json({ type, count: data.length, data });
    }
  } catch (err) {
    next(err);
  }
}
