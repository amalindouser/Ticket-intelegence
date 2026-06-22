import prisma from "../config/prisma.js";

const STOPWORDS = [
  "yang", "dan", "di", "ke", "dari", "dengan", "untuk", "pada", "adalah",
  "ini", "itu", "saya", "kami", "kita", "anda", "mereka", "dia", "tidak",
  "akan", "telah", "sudah", "bisa", "dapat", "ada", "juga", "atau", "oleh",
  "dalam", "bahwa", "karena", "jika", "saat", "setelah", "antara",
  "tentang", "seperti", "secara", "semua", "lain", "masih",
  "saja", "belum", "pernah", "sedang", "sangat",
  "lebih", "kurang", "sehingga", "maka", "lalu", "kemudian",
  "kapan", "dimana", "mohon", "tolong", "harap",
  "re", "bls", "fw", "fwd", "reply", "forward",
  "ticket", "jli", "jni", "aino", "ainosi",
  "mei", "juni", "april", "maret",
  "the", "and", "for", "any", "this", "that", "with", "from",
  "are", "not", "you", "your", "our", "its", "all", "will",
  "has", "have", "been", "were", "was", "also", "but",
];

function tokenize(text) {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[#＃]\d+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w) && !STOPWORDS.includes(w));
  return words;
}

function getTopKeywords(tickets, topN = 10, convTexts = {}) {
  const freq = {};
  tickets.forEach((t) => {
    const convExtra = convTexts[t.id] || "";
    const words = tokenize(`${t.subject || ""} ${t.description || ""} ${convExtra}`);
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

function assignClusterLabel(keywords) {
  const kw = keywords.map((k) => k.word).join(" ");
  if (kw.includes("transaksi") || kw.includes("data") || kw.includes("selisih") || kw.includes("perbedaan")) return "Rekonsiliasi Data";
  if (kw.includes("akses") || kw.includes("hak") || kw.includes("request")) return "Permohonan Hak Akses";
  if (kw.includes("pembayaran") || kw.includes("berhasil") || kw.includes("payment") || kw.includes("eticket")) return "E-Ticket & Pembayaran";
  if (kw.includes("deployment") || kw.includes("penambahan") || kw.includes("perubahan") || kw.includes("koridor")) return "Deployment & Perubahan TI";
  if (kw.includes("perbaikan") || kw.includes("insert") || kw.includes("uuid") || kw.includes("duplicate")) return "Perbaikan Data";
  if (kw.includes("vendor") || kw.includes("eoi") || kw.includes("invoice") || kw.includes("adnoc")) return "Vendor & EOI";
  if (kw.includes("settle") || kw.includes("kmt") || kw.includes("balance") || kw.includes("emoney")) return "Rekonsiliasi Settlement";
  if (kw.includes("qris") || kw.includes("bjb") || kw.includes("parkir") || kw.includes("ezitama")) return "QRIS & Parkir";
  if (kw.includes("medan") || kw.includes("accasia") || kw.includes("pool") || kw.includes("bus")) return "Project Medan";
  if (kw.includes("spam") || kw.includes("luxury") || kw.includes("watches") || kw.includes("limited")) return "Spam";
  return "Lainnya";
}

class ClusteringService {
  async getTopicClusters() {
    const allTickets = await prisma.ticket.findMany({
      select: {
        id: true,
        freshdeskTicketId: true,
        subject: true,
        description: true,
        assignedGroup: true,
        requesterEmail: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });

    const convTexts = {};
    const allConversations = await prisma.ticketConversation.findMany({
      select: { ticketId: true, bodyText: true, body: true },
    });
    for (const c of allConversations) {
      if (!convTexts[c.ticketId]) convTexts[c.ticketId] = "";
      convTexts[c.ticketId] += " " + (c.bodyText || c.body || "");
    }

    const topicKeywords = {};
    const topicTickets = {};

    allTickets.forEach((t) => {
      const convExtra = convTexts[t.id] || "";
      const words = tokenize(`${t.subject || ""} ${t.description || ""} ${convExtra}`).join(" ");
      let assigned = false;

      const rules = [
        { key: "E-Ticket & Pembayaran", words: ["pembayaran", "berhasil", "eticket", "payment"] },
        { key: "QRIS & Parkir", words: ["qris", "bjb", "parkir", "ezitama", "parkir"] },
        { key: "Permohonan Hak Akses", words: ["hak akses", "backoffice", "login"] },
        { key: "Spam", words: ["spam", "luxury", "watches", "limited offer"] },
        { key: "Vendor & EOI", words: ["vendor", "eoi", "invoice", "adnoc"] },
        { key: "Project Medan", words: ["medan", "accasia", "koridor"] },
        { key: "Deployment & Perubahan TI", words: ["deployment", "penambahan", "perubahan", "dismantle"] },
        { key: "Perbaikan Data", words: ["perbaikan uuid", "insert manual", "duplicate", "perbaikan data"] },
        { key: "Rekonsiliasi Settlement", words: ["kmt", "settle", "balance", "emoney", "jakcard"] },
        { key: "Rekonsiliasi Data", words: ["transaksi", "selisih", "perbedaan", "svd", "pengecekan"] },
      ];

      for (const rule of rules) {
        if (rule.words.some((w) => words.includes(w))) {
          if (!topicTickets[rule.key]) topicTickets[rule.key] = [];
          topicTickets[rule.key].push(t);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        const key = "Lainnya";
        if (!topicTickets[key]) topicTickets[key] = [];
        topicTickets[key].push(t);
      }
    });

    const groupMap = {};
    const groupMappings = await prisma.groupMapping.findMany();
    groupMappings.forEach((m) => { groupMap[m.groupId] = m.groupName; });

    const escMap = {};
    groupMappings.forEach((m) => { escMap[m.groupId] = m.escalationEmail; });

    const clusters = await Promise.all(Object.entries(topicTickets).map(async ([label, tickets]) => {
      const groupCounts = {};
      tickets.forEach((t) => {
        const g = t.assignedGroup || "unknown";
        groupCounts[g] = (groupCounts[g] || 0) + 1;
      });

      const groupDistribution = Object.entries(groupCounts)
        .map(([gid, count]) => ({
          groupId: gid,
          groupName: groupMap[gid] || `Grup ${gid}`,
          ticketCount: count,
          escalationEmail: escMap[gid] || null,
        }))
        .sort((a, b) => b.ticketCount - a.ticketCount);

      const topKeywords = getTopKeywords(tickets, 8, convTexts);
      const recentTickets = tickets
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((t) => ({
          ticketId: Number(t.freshdeskTicketId),
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          requesterEmail: t.requesterEmail,
          assignedGroup: t.assignedGroup,
          createdAt: t.createdAt,
        }));

      const escalationTargets = [...new Set(groupDistribution.map((g) => g.escalationEmail).filter(Boolean))];

      return {
        label,
        ticketCount: tickets.length,
        percentage: Math.round((tickets.length / allTickets.length) * 100),
        topKeywords,
        groupDistribution,
        escalationTargets,
        recentTickets,
      };
    }));

    clusters.sort((a, b) => b.ticketCount - a.ticketCount);

    return { clusters, totalTickets: allTickets.length };
  }

  async getEscalationFlow() {
    const mappings = await prisma.groupMapping.findMany({
      where: { escalationEmail: { not: null } },
      orderBy: { groupName: "asc" },
    });

    const convTexts = {};
    const allConversations = await prisma.ticketConversation.findMany({
      select: { ticketId: true, bodyText: true, body: true },
    });
    for (const c of allConversations) {
      if (!convTexts[c.ticketId]) convTexts[c.ticketId] = "";
      convTexts[c.ticketId] += " " + (c.bodyText || c.body || "");
    }

    const topicTickets = {};
    const allTickets = await prisma.ticket.findMany({
      select: { id: true, assignedGroup: true, subject: true, description: true, freshdeskTicketId: true, requesterEmail: true, status: true, priority: true, createdAt: true },
    });

    allTickets.forEach((t) => {
      const g = t.assignedGroup || "unknown";
      if (!topicTickets[g]) topicTickets[g] = [];
      topicTickets[g].push(t);
    });

    const flow = await Promise.all(mappings.map(async (m) => {
      const tickets = topicTickets[m.groupId] || [];
      const emails = m.escalationEmail.split(",").map((e) => e.trim());
      const targets = emails.map((email) => {
        const matched = mappings.filter(
          (mm) => mm.groupId !== m.groupId && mm.escalationEmail && mm.escalationEmail.includes(email)
        );
        if (matched.length > 0) {
          return { groupId: matched[0].groupId, groupName: matched[0].groupName, email };
        }
        return { groupId: null, groupName: "External / Email", email };
      });

      const topKeywords = getTopKeywords(tickets, 5, convTexts);

      return {
        groupId: m.groupId,
        groupName: m.groupName,
        escalationEmail: m.escalationEmail,
        ticketCount: tickets.length,
        topKeywords,
        escalationTargets: targets,
      };
    }));

    return { flow };
  }
}

export default new ClusteringService();
