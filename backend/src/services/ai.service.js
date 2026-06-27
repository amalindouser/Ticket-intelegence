import prisma from "../config/prisma.js";
import ticketRepository from "../repositories/ticket.repository.js";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const STATUS_LABELS = { 1: "Open", 2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed" };
const PRIORITY_LABELS = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };
const CLUSTER_NAMES = {
  1001: "JLI", 1002: "Project Medan", 1003: "FinOps / Settlement",
  1004: "QRIS / Parkir", 1005: "E-Ticket", 1006: "Tol Warju",
  1007: "Agathis / TMR", 1008: "Permohonan Data", 1009: "Hak Akses",
  1010: "Deployment / TI", 1011: "Ezitama", 1012: "EOI / Vendor",
  1013: "Internal AINO", 1014: "Spam", 1015: "Jasa Sarana",
};

async function callOllama(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.response.trim();
}

async function* callOllamaStreamRaw(prompt) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, stream: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error: ${res.status} ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.response) yield data.response;
      } catch (e) { /* skip parse errors */ }
    }
  }
  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer);
      if (data.response) yield data.response;
    } catch (e) { /* skip */ }
  }
}

function writeSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function buildContext(ticket, similar) {
  return `
Subject: ${ticket.subject || "(no subject)"}
Description: ${(ticket.description || "(no description)").slice(0, 1000)}
Requester: ${ticket.requesterEmail || "unknown"}
Group: ${ticket.assignedGroup || "N/A"}
Agent: ${ticket.assignedAgent || "N/A"}
Status: ${ticket.status}
Priority: ${ticket.priority}
Tags: ${ticket.tags || "none"}

Recent Conversations:
${(ticket.conversations || []).slice(-3).map((c) => `[${new Date(c.createdAt).toLocaleDateString()}] ${c.senderEmail}: ${(c.body || "").slice(0, 500)}`).join("\n") || "(none)"}

Similar Resolved Tickets:
${similar.slice(0, 3).map((t) => `- #${t.freshdeskTicketId} ${t.subject}`).join("\n") || "(none)"}
`;
}

async function buildRichContext(ticket) {
  const parts = [];

  parts.push(`Tiket #${ticket.freshdeskTicketId}
Subject: ${ticket.subject}
Status: ${STATUS_LABELS[ticket.status] || ticket.status}
Priority: ${PRIORITY_LABELS[ticket.priority] || ticket.priority}
Requester: ${ticket.requesterEmail || "-"}
Group: ${ticket.assignedGroup || "-"}
Agent: ${ticket.assignedAgent || "-"}
Tags: ${ticket.tags || "-"}
Resolution Path: ${ticket.resolutionPath || "unknown"}
`);

  // Evidence summary
  const evCount = await prisma.evidence.count({ where: { ticketId: ticket.freshdeskTicketId } });
  if (evCount > 0) {
    const evByType = await prisma.evidence.groupBy({
      by: ["fileType"],
      where: { ticketId: ticket.freshdeskTicketId },
      _count: { id: true },
    });
    const evDetail = evByType.map(e => `${e.fileType}: ${e._count.id}`).join(", ");
    parts.push(`Evidence: ${evCount} file (${evDetail})`);
  } else {
    parts.push("Evidence: tidak ada");
  }

  // Recent conversations
  const conversations = await prisma.ticketConversation.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (conversations.length > 0) {
    parts.push("Percakapan terbaru:");
    conversations.reverse().forEach(c => {
      const role = c.isAgent ? "Agent" : "Customer";
      const text = (c.bodyText || c.body || "").slice(0, 300);
      parts.push(`  [${role}] ${c.actorName || c.fromEmail}: ${text}`);
    });
  }

  // Relations
  let parent = null;
  if (ticket.parentTicketId) {
    parent = await prisma.ticket.findUnique({
      where: { id: ticket.parentTicketId },
      select: { freshdeskTicketId: true, subject: true, resolutionPath: true, status: true },
    });
  }
  if (parent) {
    parts.push(`Parent ticket: #${parent.freshdeskTicketId} - ${parent.subject} (${STATUS_LABELS[parent.status] || parent.status})`);
  }
  const children = await prisma.ticket.findMany({
    where: { parentTicketId: ticket.id },
    select: { freshdeskTicketId: true, subject: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  if (children.length > 0) {
    parts.push(`Child tickets (${children.length}):`);
    children.forEach(c => parts.push(`  #${c.freshdeskTicketId} - ${c.subject} (${STATUS_LABELS[c.status] || c.status})`));
  }

  // Group movements
  const movements = await prisma.ticketGroupMovement.findMany({
    where: { ticketId: ticket.id },
    orderBy: { movedAt: "asc" },
    take: 5,
  });
  if (movements.length > 0) {
    parts.push("Riwayat perpindahan grup:");
    movements.forEach(m => parts.push(`  ${new Date(m.movedAt).toLocaleDateString("id-ID")}: ${m.fromGroupId || "-"} → ${m.toGroupId} (${m.movedBy || "?"})`));
  }

  // Escalations
  const escalations = await prisma.escalation.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  if (escalations.length > 0) {
    parts.push("Eskalasi:");
    escalations.forEach(e => parts.push(`  ${new Date(e.createdAt).toLocaleDateString("id-ID")}: ke ${e.teamName}${e.agentName ? ` (${e.agentName})` : ""}`));
  }

  // Cluster
  const cluster = await prisma.ticketCluster.findFirst({
    where: { ticketId: ticket.freshdeskTicketId, method: "rule" },
    include: { clusterMetadata: true },
  });
  if (cluster) {
    parts.push(`Cluster: ${cluster.clusterLabel || cluster.clusterMetadata?.label || cluster.clusterId}`);
  }

  return parts.join("\n");
}

async function getDashboardSummary() {
  const total = await prisma.ticket.count();
  const open = await prisma.ticket.count({ where: { status: { in: [2, 3] } } });
  const closed = await prisma.ticket.count({ where: { status: { in: [4, 5] } } });
  const urgent = await prisma.ticket.count({ where: { priority: 4 } });
  const groups = await prisma.ticket.groupBy({
    by: ["assignedGroup"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });
  const gm = await prisma.groupMapping.findMany();
  const gmMap = Object.fromEntries(gm.map(g => [g.groupId, g.groupName]));
  const groupLines = groups.filter(g => g.assignedGroup).map(g => `  ${gmMap[g.assignedGroup] || g.assignedGroup}: ${g._count.id} tiket`);
  const evidenceCount = await prisma.evidence.count();
  const spawned = await prisma.ticket.count({ where: { resolutionPath: "spawned" } });
  const inThread = await prisma.ticket.count({ where: { resolutionPath: "in_thread" } });
  return [
    `Total tiket: ${total} | Open: ${open} | Closed: ${closed} | Urgent: ${urgent}`,
    `Evidence: ${evidenceCount} file | Resolusi: ${inThread} in-thread, ${spawned} spawned`,
    `Grup dengan tiket terbanyak:`,
    ...groupLines,
  ].join("\n");
}

export async function generateReply(ticketId) {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const similar = await ticketRepository.findSimilar(ticketId);
  const resolvedSimilar = similar.filter((t) => t.status === 4 || t.status === 5);
  const ctx = buildContext(ticket, resolvedSimilar);

  const prompt = `Kamu adalah agen support helpdesk. Buat draft balasan profesional dalam Bahasa Indonesia untuk PENGIRIM PESAN TERAKHIR di tiket ini.

INSTRUKSI:
1. Baca dengan saksama seluruh percakapan di bawah — terutama pesan terakhir dari pengirim (requester).
2. Balaslah secara spesifik menanggapi isi pesan terakhir tersebut, jangan membuat balasan generik.
3. Jika pesan terakhir berisi pertanyaan, jawab pertanyaannya. Jika berisi laporan masalah, tanggapi masalah tersebut.
4. Gunakan tiket serupa yang sudah terselesaikan sebagai referensi gaya penanganan.
5. Balasan harus sopan, informatif, dan langsung ke pokok permasalahan.

Konteks Tiket:
${ctx}

Hasilkan hanya draft balasan saja, tanpa penjelasan tambahan atau prefiks.`;

  const reply = await callOllama(prompt);
  return { reply, model: MODEL, type: "reply" };
}

export async function generateChat(ticketId, message, history = [], onLLMChunk = null) {
  let ctx = '';
  let participants = [];
  let ticket = null;

  async function findTicketFromAll() {
    if (ticketId) return await ticketRepository.findById(ticketId);
    const allText = [...history.map(h => h.content), message].join(' ');
    const numMatch = allText.match(/(?:tiket|ticket|nomor|#)\s*(\d{4,10})/i);
    if (numMatch) {
      const ft = await ticketRepository.findByFreshdeskId(numMatch[1]);
      if (ft) return await ticketRepository.findById(ft.id);
    }
    return null;
  }
  ticket = await findTicketFromAll();
  if (ticket) {
    participants = ticket.participants || [];
    const similar = await ticketRepository.findSimilar(ticket.id);
    ctx = buildContext(ticket, similar);
  }

  function cleanEmail(e) {
    const m = e.match(/<([^>]+)>/);
    return m ? m[1] : e;
  }
  const toList = participants.filter((p) => p.role === 'to').map((p) => cleanEmail(p.email)).join(', ');
  const ccList = participants.filter((p) => p.role === 'cc').map((p) => cleanEmail(p.email)).join(', ');

  const subject = ticket ? ticket.subject : '-';
  const status = ticket ? ticket.status : '-';
  const requester = ticket ? (ticket.requesterEmail || '-') : '-';

  const historyBlock = history.map((h) => `${h.role}: ${h.content}`).join('\n') || '(no history)';

  // --- Follow-up detection ---
  const isFollowUpYes = /^(iya|ya|ada|oke|ok|yaap|iyaap|betul|yes|y|tentu|silakan|mau|lanjutkan)$/i.test(message.trim());
  const isFollowUpNo = /^(tid.ak|nggak|gak|tidak|udah|selesai|cukup|stop|no|nope)$/i.test(message.trim());
  const isFollowUpAny = /^(ada lagi|apakah ada lagi|apa lagi|masih ada|lainnya|lagi|apalagi|lain)$/i.test(message.trim());

  if (isFollowUpNo) {
    return { reply: 'Baik, kalau ada keperluan lain silakan tanya lagi. Terima kasih 😊', model: 'rule', type: 'chat' };
  }
  if (isFollowUpYes || isFollowUpAny) {
    return { reply: 'Ada yang bisa saya bantu lagi? Coba sebutkan topik, nomor tiket, atau grup yang ingin ditanyakan.', model: 'rule', type: 'chat' };
  }

  const lowerMsg = message.toLowerCase();

  // --- NEW: Evidence questions ---
  const isEvidenceQuestion = /(?:lampiran|evidence|bukti|attachment|screenshot|file|gambar|pdf|dokumen)/i.test(message);
  if (isEvidenceQuestion && ticket) {
    const evidences = await prisma.evidence.findMany({
      where: { ticketId: ticket.freshdeskTicketId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (evidences.length > 0) {
      const byType = {};
      for (const e of evidences) {
        if (!byType[e.fileType]) byType[e.fileType] = [];
        byType[e.fileType].push(e.fileName);
      }
      const lines = [`📎 **Evidence Tiket #${ticket.freshdeskTicketId} (${evidences.length} file)**\n`];
      for (const [type, files] of Object.entries(byType)) {
        lines.push(`**${type}** (${files.length}):`);
        files.slice(0, 5).forEach(f => lines.push(`   • ${f}`));
        if (files.length > 5) lines.push(`   ... dan ${files.length - 5} file lainnya`);
        lines.push('');
      }
      lines.push('Ada lagi yang bisa dibantu?');
      return { reply: lines.join('\n'), model: 'rule', type: 'chat' };
    }
    return { reply: 'Belum ada evidence/lampiran untuk tiket ini.', model: 'rule', type: 'chat' };
  }

  // --- NEW: Stats / dashboard questions ---
  const isStatsQuestion = /(?:statistik|dashboard|ringkasan|berapa.*tiket|jumlah.*tiket|total.*tiket|semua tiket|overview|keseluruhan)/i.test(message)
    && !/(?:tiket\s*\d|nomor|#\d)/i.test(message);
  if (isStatsQuestion) {
    const summary = await getDashboardSummary();
    return { reply: `📊 **Ringkasan Dashboard**\n\n${summary}\n\nAda lagi yang bisa dibantu?`, model: 'rule', type: 'chat' };
  }

  // --- NEW: Relations / parent-child questions ---
  const isRelationQuestion = /(?:parent|child|induk|anak|turunan|relasi|terkait|hubungan|kaitan)/i.test(message);
  if (isRelationQuestion && ticket) {
    let parent = null;
    if (ticket.parentTicketId) {
      parent = await prisma.ticket.findUnique({
        where: { id: ticket.parentTicketId },
        select: { freshdeskTicketId: true, subject: true, status: true, resolutionPath: true },
      });
    }
    const children = await prisma.ticket.findMany({
      where: { parentTicketId: ticket.id },
      select: { freshdeskTicketId: true, subject: true, status: true },
      orderBy: { createdAt: "asc" },
    });
    const lines = [];
    if (parent) {
      lines.push(`**Parent/Induk:**\n#${parent.freshdeskTicketId} — ${parent.subject} (${STATUS_LABELS[parent.status] || parent.status})`);
    }
    if (children.length > 0) {
      lines.push(`\n**Child/Anak (${children.length}):**`);
      children.forEach(c => lines.push(`• #${c.freshdeskTicketId} — ${c.subject} (${STATUS_LABELS[c.status] || c.status})`));
    }
    if (lines.length > 0) {
      const path = ticket.resolutionPath === "spawned" ? " (tiket ini melahirkan tiket baru)" : ticket.resolutionPath === "in_thread" ? " (selesai dalam thread)" : "";
      return { reply: `📋 **Relasi Tiket #${ticket.freshdeskTicketId}**${path}\n\n${lines.join("\n")}\n\nAda lagi yang bisa dibantu?`, model: 'rule', type: 'chat' };
    }
    return { reply: `Tiket #${ticket.freshdeskTicketId} tidak memiliki relasi parent atau child.`, model: 'rule', type: 'chat' };
  }

  // --- NEW: Resolution path question ---
  const isResolutionQuestion = /(?:resolusi|selesai|close|resolved|penyelesaian|in.thread|spawned|bagaimana.*selesai|status.*tiket)/i.test(message);
  if (isResolutionQuestion && ticket) {
    const pathLabel = ticket.resolutionPath === "in_thread" ? "✅ **In Thread** — tiket ini diselesaikan langsung dalam percakapan tanpa perlu membuat tiket baru."
      : ticket.resolutionPath === "spawned" ? "🔄 **Spawned** — tiket ini melahirkan tiket baru untuk ditindaklanjuti."
      : "⏳ **Belum selesai** — tiket masih dalam proses.";
    const children = await prisma.ticket.count({ where: { parentTicketId: ticket.id } });
    let parent = null;
    if (ticket.parentTicketId) {
      parent = await prisma.ticket.findUnique({ where: { id: ticket.parentTicketId }, select: { freshdeskTicketId: true } });
    }
    const extra = [];
    if (parent) extra.push(`Tiket ini adalah anak dari #${parent.freshdeskTicketId}`);
    if (children > 0) extra.push(`Tiket ini memiliki ${children} child ticket`);
    return { reply: `📌 **Resolusi Tiket #${ticket.freshdeskTicketId}**\n\n${pathLabel}${extra.length > 0 ? "\n\n" + extra.join("\n") : ""}\n\nAda lagi yang bisa dibantu?`, model: 'rule', type: 'chat' };
  }

  // --- NEW: Cluster / topic question ---
  const isClusterQuestion = /(?:cluster|topik|klasifikasi|kategori|kelompok|golongan)/i.test(message);
  if (isClusterQuestion && ticket) {
    const cluster = await prisma.ticketCluster.findFirst({
      where: { ticketId: ticket.freshdeskTicketId, method: "rule" },
      orderBy: { createdAt: "desc" },
    });
    if (cluster) {
      const label = cluster.clusterLabel || "Unknown";
      const desc = CLUSTER_NAMES[cluster.clusterId] || "";
      return { reply: `🏷️ **Cluster Tiket #${ticket.freshdeskTicketId}**\n\nCluster: **${label}**${desc ? `\nDeskripsi: ${desc}` : ""}\n\nAda lagi yang bisa dibantu?`, model: 'rule', type: 'chat' };
    }
    return { reply: `Tiket #${ticket.freshdeskTicketId} belum memiliki data cluster.`, model: 'rule', type: 'chat' };
  }

  // --- NEW: Group movement stats ---
  const isMovementStatsQuestion = /(?:perpindahan|pindah.*grup|grup.*pindah|movement.*stats|group.*move|grup.*terbanyak)/i.test(message);
  if (isMovementStatsQuestion) {
    const movements = await prisma.ticketGroupMovement.findMany({
      include: { ticket: { select: { freshdeskTicketId: true, subject: true } } },
      orderBy: { movedAt: "desc" },
      take: 10,
    });
    const topTickets = await prisma.ticketGroupMovement.groupBy({
      by: ["ticketId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });
    const lines = ["📊 **Statistik Perpindahan Grup**\n"];
    if (topTickets.length > 0) {
      lines.push("**Tiket paling sering pindah grup:**");
      for (const t of topTickets) {
        const tkt = await prisma.ticket.findUnique({ where: { id: t.ticketId }, select: { freshdeskTicketId: true, subject: true } });
        if (tkt) lines.push(`• #${tkt.freshdeskTicketId} — ${t._count.id}x pindah (${(tkt.subject || "").slice(0, 50)})`);
      }
      lines.push("");
    }
    lines.push(movements.length > 0 ? `Total ${movements.length} perpindahan tercatat.` : "Belum ada data perpindahan grup.");
    lines.push("\nAda lagi yang bisa dibantu?");
    return { reply: lines.join("\n"), model: 'rule', type: 'chat' };
  }

  // --- KB search untuk forward-to queries (sebelum group detection) ---
  const forwardTargetMatch = lowerMsg.match(/(?:forward|fw|di.?forward|diteruskan|dikirim|di.?kirim|ke.?tim|ke.?team)\s+(?:ke|di|pada|oleh)?\s*(.+)/i);
  const forwardTarget = forwardTargetMatch ? forwardTargetMatch[1].trim() : null;

  if (forwardTarget) {
    const kbResults = await prisma.knowledgeBase.findMany({
      where: { penyelesaian: { contains: forwardTarget, mode: "insensitive" } },
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    if (kbResults.length > 0) {
      const lines = [`Tiket yang solusinya menyebutkan **${forwardTarget}**:\n`];
      kbResults.forEach((k, i) => {
        lines.push(`**${i + 1}. [${k.ticketId}]** ${k.clientName ? `— ${k.clientName}` : ''}`);
        if (k.deskripsiMasalah) lines.push(`   Masalah: ${k.deskripsiMasalah}`);
        if (k.penyelesaian) lines.push(`   Solusi: ${k.penyelesaian}`);
        if (k.kategoriKendala) lines.push(`   Kategori: ${k.kategoriKendala}`);
        lines.push('');
      });
      lines.push('Ada lagi yang bisa dibantu?');
      return { reply: lines.join('\n'), model: 'kb', type: 'chat' };
    }
  }

  // --- Forwarding history (riwayat pindah grup) ---
  const isForwardHistory = /(?:riwayat|history|pernah)\s*(?:di.?forward|di.?pindah|di.?teruskan|pindah|forward)|di.?forward\s*(?:ke mana|kemana|grup|tim)/i.test(message);
  const isGroupChange = /(?:pernah|pindah|berubah)\s*(?:grup|group|tim)\s*(?:dari|ke)?|grup\s*(?:dari|ke)?\s*(?:.*)\s*(?:berubah|pindah)/i.test(message);
  if (isForwardHistory || isGroupChange) {
    const allText = [...history.map(h => h.content), message].join(' ');
    const numMatch = allText.match(/(?:tiket|ticket|nomor|#)\s*(\d{4,10})/i);
    const historyTicketId = numMatch ? numMatch[1] : (ticket ? ticket.freshdeskTicketId : null);

    if (historyTicketId) {
      const ft = await ticketRepository.findByFreshdeskId(String(historyTicketId));
      if (ft) {
        const groupChanges = await prisma.ticketHistory.findMany({
          where: { ticketId: ft.id, fieldName: { in: ['assigned_group', 'group_id'] } },
          orderBy: { changedAt: 'asc' },
        });
        const agentChanges = await prisma.ticketHistory.findMany({
          where: { ticketId: ft.id, fieldName: { in: ['assigned_agent', 'agent_id'] } },
          orderBy: { changedAt: 'asc' },
        });
        const statusChanges = await prisma.ticketHistory.findMany({
          where: { ticketId: ft.id, fieldName: { in: ['status', 'priority'] } },
          orderBy: { changedAt: 'asc' },
        });
        const allMappings = await prisma.groupMapping.findMany();
        const gmMap = Object.fromEntries(allMappings.map(g => [g.groupId, g.groupName]));

        const lines = [`📋 **Riwayat Tiket #${historyTicketId}** — ${ft.subject}\n`];

        if (groupChanges.length > 0) {
          lines.push('**Perpindahan Grup:**');
          for (const gc of groupChanges) {
            const from = gc.oldValue ? (gmMap[gc.oldValue] || `ID ${gc.oldValue}`) : '—';
            const to = gc.newValue ? (gmMap[gc.newValue] || `ID ${gc.newValue}`) : '—';
            lines.push(`   ${new Date(gc.changedAt).toLocaleDateString('id-ID')}: ${from} → **${to}**`);
          }
          lines.push('');
        } else {
          lines.push('Tidak ada riwayat perpindahan grup (grup tetap sejak tiket dibuat).\n');
        }

        if (agentChanges.length > 0) {
          lines.push('**Perubahan Agent:**');
          for (const ac of agentChanges) {
            lines.push(`   ${new Date(ac.changedAt).toLocaleDateString('id-ID')}: ${ac.oldValue || '—'} → **${ac.newValue || '—'}**`);
          }
          lines.push('');
        }

        if (statusChanges.length > 0) {
          const lastStatus = statusChanges[statusChanges.length - 1];
          lines.push(`**Status saat ini:** ${STATUS_LABELS[lastStatus.newValue] || lastStatus.newValue}`);
          lines.push('');
        }

        lines.push('Ada lagi yang bisa dibantu?');
        return { reply: lines.join('\n'), model: 'rule', type: 'chat' };
      }
      return { reply: `Tiket #${historyTicketId} tidak ditemukan di database.`, model: 'rule', type: 'chat' };
    }
    if (ticket) {
      return { reply: `Tiket #${ticket.freshdeskTicketId} sedang aktif. Coba tanya "riwayat forward tiket ${ticket.freshdeskTicketId}" untuk detailnya.`, model: 'rule', type: 'chat' };
    }
    return { reply: 'Sebutkan nomor tiketnya, misal "riwayat forward tiket 32070".', model: 'rule', type: 'chat' };
  }

  // --- Group question detection ---
  if (!/(?:^|\s|ke|di)(forward|eskalasi|forwarding|transfer|teruskan|limpahkan|kirimkan)/i.test(message)) {
    const groupMatch = message.match(/(?:siapa|apa|gimana|bagaimana|yang ngurus|tim|grup|group|divisi|bagian)\s+(.+)/i);
    if (groupMatch) {
      const raw = groupMatch[1].trim().toLowerCase();
      const query = raw.split(/\s+/).filter(w => w.length > 2).pop() || raw;
      const allGroups = await prisma.groupMapping.findMany();
      const matched = allGroups.filter(g =>
        query.includes(g.groupName.toLowerCase()) || g.groupName.toLowerCase().includes(query)
      );
      if (matched.length > 0) {
        const lines = matched.map(g => {
          return `• **${g.groupName}** (ID: ${g.groupId})${g.escalationEmail ? `\n  Eskalasi: ${g.escalationEmail}` : ''}`;
        });
        return {
          reply: `Ditemukan grup yang cocok:\n${lines.join('\n')}\n\nAda yang bisa dibantu lagi?`,
          model: 'rule', type: 'chat',
        };
      }
    }
  }

  // --- Search ticket by subject if no ticket found ---
  if (!ticket && message.length > 10) {
    const subjectTickets = await prisma.ticket.findMany({
      where: { subject: { contains: message.slice(0, 60), mode: 'insensitive' } },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    if (subjectTickets.length > 0) {
      ticket = await ticketRepository.findById(subjectTickets[0].id);
      if (ticket) {
        participants = ticket.participants || [];
        const similar = await ticketRepository.findSimilar(ticket.id);
        ctx = buildContext(ticket, similar);
      }
    }
  }

  const isForwardQuestion = /(?:^|\s|ke|di)(forward|eskalasi|forwarding|transfer|teruskan|limpahkan|kirimkan)/i.test(message);
  const isToCcQuestion = /(?:^|\s)(to|cc|tujuan|tembusan|rekomendasi|participant|email)(?:\s|$)/i.test(message);

  // --- Reference email question ---
  const refMatch = message.match(/(?:referensi|reference|daftar|kontak|email\s*(?:referensi|kontak)?)\s*(?:email|kontak)?\s*(?:untuk|buat|grup|group|tim|masalah|issue)?\s*(.+)/i);
  if (refMatch) {
    const query = refMatch[1].trim().toLowerCase();
    const groups = await prisma.groupMapping.findMany();
    let matchedGroup = groups.find(g => query.includes(g.groupName.toLowerCase()) || g.groupName.toLowerCase().includes(query));

    if (!matchedGroup) {
      const words = query.split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) {
        const kbIssue = await prisma.knowledgeBase.findFirst({
          where: { OR: words.flatMap(w => [
            { deskripsiMasalah: { contains: w, mode: 'insensitive' } },
            { kategoriKendala: { contains: w, mode: 'insensitive' } },
            { clientName: { contains: w, mode: 'insensitive' } },
            { penyelesaian: { contains: w, mode: 'insensitive' } },
          ])},
          orderBy: { createdAt: 'desc' },
        });
        if (kbIssue?.ticketId) {
          const tid = kbIssue.ticketId.replace(/[^0-9]/g, '');
          if (tid) {
            const relatedTicket = await prisma.ticket.findFirst({
              where: { freshdeskTicketId: BigInt(tid) },
            });
            if (relatedTicket?.assignedGroup) {
              matchedGroup = groups.find(g => g.groupId === relatedTicket.assignedGroup) || null;
            }
          }
        }
        if (!matchedGroup) {
          const subjectTicket = await prisma.ticket.findFirst({
            where: { OR: words.flatMap(w => [
              { subject: { contains: w, mode: 'insensitive' } },
              { description: { contains: w, mode: 'insensitive' } },
            ])},
            orderBy: { createdAt: 'desc' },
          });
          if (subjectTicket?.assignedGroup) {
            matchedGroup = groups.find(g => g.groupId === subjectTicket.assignedGroup) || null;
          }
        }
      }
    }

    if (matchedGroup) {
      const refs = await prisma.referenceEmail.findMany({
        where: { groupId: matchedGroup.groupId },
        orderBy: [{ role: 'asc' }, { email: 'asc' }],
      });
      if (refs.length > 0) {
        const toList = refs.filter(r => r.role === 'to');
        const ccList = refs.filter(r => r.role === 'cc');
        const reqList = refs.filter(r => r.role === 'requester');
        const lines = [`📧 **Referensi Email — ${matchedGroup.groupName}**\n`];
        if (toList.length > 0) {
          lines.push('📥 **To (tujuan utama):**');
          toList.forEach(r => lines.push(`   • ${r.name ? `**${r.name}** ` : ''}\`${r.email}\``));
          lines.push('');
        }
        if (ccList.length > 0) {
          lines.push(`📄 **CC (tembusan) — ${ccList.length} email:**`);
          lines.push(`   ${ccList.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')}`);
          lines.push('');
        }
        if (reqList.length > 0) {
          lines.push(`👤 **Requester — ${reqList.length} email:**`);
          lines.push(`   ${reqList.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')}`);
          lines.push('');
        }
        lines.push('Ada lagi yang bisa dibantu?');
        return { reply: lines.join('\n'), model: 'rule', type: 'chat' };
      }
      return { reply: `Belum ada referensi email untuk grup **${matchedGroup.groupName}**.`, model: 'rule', type: 'chat' };
    }

    const allRefs = await prisma.$queryRaw`
      SELECT gm.group_name, re.group_id,
        json_agg(json_build_object('email', re.email, 'name', re.name, 'role', re.role) ORDER BY re.role, re.email) as emails
      FROM reference_emails re
      JOIN group_mappings gm ON gm.group_id = re.group_id
      GROUP BY gm.group_name, re.group_id
      ORDER BY gm.group_name
    `;
    if (allRefs.length > 0) {
      const lines = ['📋 **Semua referensi email per grup:**\n'];
      allRefs.forEach(r => {
        lines.push(`**${r.group_name}:**`);
        const tos = r.emails.filter(e => e.role === 'to').slice(0, 3);
        const ccs = r.emails.filter(e => e.role === 'cc');
        tos.forEach(e => lines.push(`   • To: ${e.name ? `${e.name} ` : ''}\`${e.email}\``));
        if (ccs.length > 0) lines.push(`   CC: ${ccs.length} email`);
        if (r.emails.length > 3) lines.push(`   ... total ${r.emails.length} referensi`);
        lines.push('');
      });
      lines.push('Ada lagi yang bisa dibantu?');
      return { reply: lines.join('\n'), model: 'rule', type: 'chat' };
    }
  }

  if ((isToCcQuestion || isForwardQuestion) && ticket) {
    const lines = [`Berdasarkan data tiket #${ticket.freshdeskTicketId}:`];
    if (toList) lines.push(`- **To (email notif):** ${toList}`);
    if (ccList) lines.push(`- **CC (email notif):** ${ccList}`);
    if (!toList && !ccList) lines.push('Tidak ada data participant To/CC untuk tiket ini.');
    const gm = ticket.assignedGroup ? await prisma.groupMapping.findUnique({ where: { groupId: ticket.assignedGroup } }) : null;
    if (gm?.escalationEmail) {
      lines.push('');
      lines.push(`📨 **Rekomendasi Eskalasi (${gm.groupName}):**`);
      lines.push(`   ${gm.escalationEmail}`);
    } else if (gm) {
      lines.push('');
      lines.push(`ℹ️ Grup tiket ini: **${gm.groupName}** — belum ada escalation email. Isi di menu Groups.`);
    }
    const allMappings = await prisma.groupMapping.findMany({ where: { escalationEmail: { not: null } } });
    if (allMappings.length > 0) {
      lines.push('');
      lines.push('📋 **Semua escalation email yang tersedia:**');
      allMappings.forEach((m) => lines.push(`   • **${m.groupName}** → ${m.escalationEmail}`));
    }
    lines.push('', 'Ada lagi yang bisa dibantu?');
    return { reply: lines.join('\n'), model: 'rule', type: 'chat' };
  }

  if (isForwardQuestion) {
    const lines = ['📋 **Semua grup dan escalation email:**'];
    const allMappings = await prisma.groupMapping.findMany({ orderBy: { groupName: 'asc' } });
    if (allMappings.length > 0) {
      const hasEscalation = allMappings.some(m => m.escalationEmail);
      allMappings.forEach((m) => {
        if (m.escalationEmail) {
          lines.push(`   • **${m.groupName}** → ${m.escalationEmail}`);
        } else {
          lines.push(`   • **${m.groupName}** — (belum ada escalation email)`);
        }
      });
      if (!hasEscalation) {
        lines.push('\nBelum ada escalation email yang diisi. Buka menu Groups untuk mengaturnya.');
      }
    } else {
      lines.push('Belum ada data grup. Buat grup dulu di menu Groups.');
    }
    if (ticket) {
      const gm = ticket.assignedGroup ? await prisma.groupMapping.findUnique({ where: { groupId: ticket.assignedGroup } }) : null;
      if (gm) lines.push(`\nTiket ini masuk grup **${gm.groupName}**.`);
    }
    lines.push('', 'Ada lagi yang bisa dibantu?');
    return { reply: lines.join('\n'), model: 'rule', type: 'chat' };
  }

  // --- General KB search ---
  const words = message.split(/\s+/).filter(w => w.length > 3);
  const kbResults = await prisma.knowledgeBase.findMany({
    where: words.length > 0
      ? { OR: words.flatMap(w => [
          { penyelesaian: { contains: w, mode: "insensitive" } },
          { deskripsiMasalah: { contains: w, mode: "insensitive" } },
          { kategoriKendala: { contains: w, mode: "insensitive" } },
          { clientName: { contains: w, mode: "insensitive" } },
        ])
      }
      : {
        OR: [
          { penyelesaian: { contains: message, mode: "insensitive" } },
          { deskripsiMasalah: { contains: message, mode: "insensitive" } },
          { kategoriKendala: { contains: message, mode: "insensitive" } },
          { clientName: { contains: message, mode: "insensitive" } },
        ],
      },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  if (kbResults.length > 0) {
    const lines = ['Ditemukan solusi serupa dari Knowledge Base:\n'];
    kbResults.forEach((k, i) => {
      lines.push(`**${i + 1}. [${k.ticketId}]** ${k.clientName ? `— ${k.clientName}` : ''}`);
      if (k.deskripsiMasalah) lines.push(`   Masalah: ${k.deskripsiMasalah}`);
      if (k.penyelesaian) lines.push(`   Solusi: ${k.penyelesaian}`);
      if (k.kategoriKendala) lines.push(`   Kategori: ${k.kategoriKendala}`);
      lines.push('');
    });
    lines.push('Ada lagi yang bisa dibantu?');
    return { reply: lines.join('\n'), model: 'kb', type: 'chat' };
  }

  // --- Fallback ke LLM dengan context kaya ---
  const richCtx = ticket ? await buildRichContext(ticket) : "Tidak ada tiket yang dipilih.";
  const dashSummary = await getDashboardSummary();

  const prompt = `Kamu adalah asisten helpdesk AINO Indonesia yang ramah dan membantu. Kamu hanya bisa MEMBACA data dan MEMBERI INFORMASI — TIDAK BISA mengubah status, mengirim email, atau melakukan tindakan apapun. Jangan pernah mengaku melakukan aksi.

Kamu punya akses data berikut. Gunakan untuk menjawab:
1. Data tiket (105 tiket, detail, percakapan, evidence, cluster)
2. Relasi parent-child antar tiket
3. Riwayat perpindahan grup
4. Knowledge Base solusi
5. Referensi email per grup
6. Ringkasan dashboard

${ticket ? `Data tiket aktif:\n${richCtx}` : "Tidak ada tiket yang dipilih. User bisa menyebut nomor tiket untuk detail."}

Ringkasan dashboard:
${dashSummary}

Riwayat Chat:
${historyBlock}

Pertanyaan: ${message}

Jawab secara alami dan informatif dalam Bahasa Indonesia. Jika tidak punya data spesifik, tawarkan bantuan seperti "Coba tanya detail tiket, referensi email grup, atau ringkasan dashboard." JANGAN mengaku melakukan aksi.`;

  if (onLLMChunk) {
    for await (const chunk of callOllamaStreamRaw(prompt)) {
      onLLMChunk(chunk);
    }
    return;
  }
  const reply = await callOllama(prompt);
  return { reply, model: MODEL, type: 'chat' };
}

export async function streamChat(res, ticketId, message, history = []) {
  let fullReply = "";
  const result = await generateChat(ticketId, message, history, (chunk) => {
    fullReply += chunk;
    writeSSE(res, { type: "token", content: chunk });
  });
  if (result) {
    writeSSE(res, { type: "reply", content: result.reply, model: result.model });
  }
  writeSSE(res, { type: "done" });
}

export async function generateEscalation(ticketId) {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const similar = await ticketRepository.findSimilar(ticketId);
  const ctx = buildContext(ticket, similar);

  const prompt = `Kamu adalah agen helpdesk Aino Indonesia. Buat draft pesan eskalasi / forward ke tim terkait dalam Bahasa Indonesia dengan format berikut:

Dear Team ...,

Tiket : [nomor tiket]
Menginformasikan [ringkasan singkat]
Tanggal : [tanggal tiket]
Shift : [shift jika diketahui, atau "-"]
Lokasi : [lokasi jika diketahui, atau "-"]
Permasalahan : [deskripsi masalah]
Category : [kategori jika diketahui, atau "-"]

Mohon bantuannya untuk kendala tersebut.
Terima kasih

Salam,
[fill with agent name if known, otherwise "Helpdesk Aino"]

Gunakan informasi dari tiket dan percakapan di bawah untuk mengisi bagian yang sesuai. Jika ada informasi yang tidak tersedia, tulis "-".

Konteks Tiket:
${ctx}

Hasilkan hanya draft pesan saja, tanpa penjelasan tambahan.`;

  const reply = await callOllama(prompt);
  return { reply, model: MODEL, type: "escalation" };
}
