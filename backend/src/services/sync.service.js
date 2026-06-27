import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import freshdesk from "./freshdesk.service.js";
import ticketRepository from "../repositories/ticket.repository.js";
import evidenceService, { extractInlineImages } from "./evidence.service.js";
import relationService from "./relation.service.js";
import prisma from "../config/prisma.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

class SyncService {
  constructor() {
    this._contactCache = new Map();
  }

  _getContactKey(requesterId) {
    if (!requesterId) return null;
    if (this._contactCache.has(requesterId)) {
      return this._contactCache.get(requesterId);
    }
    return null;
  }

  async _resolveRequesterEmail(ft) {
    if (ft.requester_email) return ft.requester_email;
    if (!ft.requester_id) return null;

    const cached = this._getContactKey(ft.requester_id);
    if (cached) return cached;

    try {
      const contact = await freshdesk.getContact(ft.requester_id);
      const email = contact.email || null;
      this._contactCache.set(ft.requester_id, email);
      return email;
    } catch {
      this._contactCache.set(ft.requester_id, null);
      return null;
    }
  }

  async _processTicket(ft, existingTicket = null) {
    const mapped = this._mapTicket(ft);
    mapped.requesterEmail = await this._resolveRequesterEmail(ft);
    const rawGroup = mapped.assignedGroup;
    if (existingTicket && existingTicket.assignedGroup && /^10\d{2}$/.test(existingTicket.assignedGroup)) {
      mapped.assignedGroup = existingTicket.assignedGroup;
    } else {
      const detected = this._detectGroupFromSubject(ft.subject || existingTicket?.subject);
      if (detected) mapped.assignedGroup = detected;
    }
    if (rawGroup !== mapped.assignedGroup) {
      mapped._originalGroup = rawGroup;
      mapped._movedBy = "System (auto-detect)";
    }
    return mapped;
  }

  _detectGroupFromSubject(subject) {
    if (!subject) return null;
    if (/\bJLI\b/i.test(subject)) return "1001";
    if (/PJ Medan|Medan.*Accasia|Medan.*(BCA|MAA)|Koridor Khusus|Teknisi Medan|Dishub.*Banjarmasin/i.test(subject)) return "1002";
    if (/FinOps|Refund|settlement|not yet settlement|daily finops|update query|query.*finops|selisih.*transaksi|perbedaan.*transaksi|OPEN TICKET.*RECON|rekon|rekonsiliasi/i.test(subject)) return "1003";
    if (/QRIS|BJB|Parkir|parkir/i.test(subject)) return "1004";
    if (/E-Ticket|E Ticket|Pembayaran Berhasil|INSERT DATA TRANSAKSI|blokir kartu|buka blokir|pemblokiran/i.test(subject)) return "1005";
    if (/Tol Warju|Warju.*BCA|DBPool/i.test(subject)) return "1006";
    if (/Agathis|TMR/i.test(subject)) return "1007";
    if (/Permohonan Data|Request.*Ticket|penarikan data|tarikan data/i.test(subject)) return "1008";
    if (/Hak Akses|Hak Ases|permintaan.*akses|Akses.*SVD|AKUN.*BO/i.test(subject)) return "1009";
    if (/Deployment|Perubahan TI|Pengajuan Perubahan/i.test(subject)) return "1010";
    if (/Ezitama/i.test(subject)) return "1011";
    if (/EOI|Expression Of Interests|Vendor/i.test(subject)) return "1012";
    if (/Internal AINO|Old Platform|IWM|Server OldPlatform/i.test(subject)) return "1013";
    if (/Spam|Luxury Watches|Limited-Time Offer|No Reply.*Invoice|Watches from/i.test(subject)) return "1014";
    if (/Jasa Sarana|\[JS\]/i.test(subject)) return "1015";
    if (/DCSA|sftp|File Konsolidasi|Folder.*Konsolidasi/i.test(subject)) return "1016";
    return null;
  }

  async syncTickets({ startDate, endDate } = {}) {
    const syncLog = await ticketRepository.createSyncLog({
      syncType: startDate && endDate ? `bulk_${startDate}_${endDate}` : "bulk_all",
      totalTickets: 0,
      startedAt: new Date(),
      status: "running",
    });

    try {
      let synced = 0;
      let skipped = 0;

      for await (const tickets of freshdesk.iterateTickets({ startDate, endDate })) {
        for (const ft of tickets) {
          const exists = await ticketRepository.findByFreshdeskId(ft.id);
          const mapped = await this._processTicket(ft, exists);
          let ticket;
          if (exists) {
            await ticketRepository.saveChanges(exists, mapped);
            ticket = await ticketRepository.update(exists.id, mapped);
            skipped++;
          } else {
            ticket = await ticketRepository.create(mapped);
            synced++;
          }

          await this._syncParticipants(ticket.id, ft, mapped.requesterEmail);
          await this._assignGroupFromToParticipants(ticket.id, ft);

          try {
            const conversations = await freshdesk.getConversations(ft.id);
            if (conversations.length > 0) {
              await ticketRepository.syncConversations(ticket.id, conversations);
              await this._syncConversationEvidences(ticket.id, ft.id, conversations);
              await this._syncMergedParentEvidences(conversations);
            }
          } catch {
            // skip conversation errors on bulk sync
          }

          try {
            const detail = await freshdesk.getTicket(ft.id);
            const attachments = detail.attachments || [];
            if (attachments.length > 0) {
              const downloaded = await Promise.all(
                attachments.map((att) => this._resolveAttachment(att))
              );
              await ticketRepository.syncAttachments(ticket.id, downloaded);
              await this._syncTicketEvidences(ft.id, attachments);
            }
          } catch {}
        }
      }

      const total = synced + skipped;
      await ticketRepository.updateSyncLog(syncLog.id, {
        totalTickets: total,
        finishedAt: new Date(),
        status: "completed",
      });

      await this._detectAndLinkRelations();

      return { synced, skipped };
    } catch (err) {
      await ticketRepository.updateSyncLog(syncLog.id, {
        finishedAt: new Date(),
        status: "failed",
        errorMessage: err.message,
      });
      throw err;
    }
  }

  async _syncTicketEvidences(freshdeskId, attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return;
    for (const att of attachments) {
      const url = att.attachment_url?.url || att.url || att.attachment_url;
      if (!url) continue;
      const name = att.name || att.filename || `ticket-attachment-${att.id}`;
      try {
        await evidenceService._processAttachment(freshdeskId, name, att.content_type, url, att.size, {
          source: "ticket",
        });
      } catch {}
    }
  }

  async _syncConversationEvidences(ticketId, freshdeskId, conversations) {
    if (!Array.isArray(conversations)) return;
    for (const conv of conversations) {
      if (conv.attachments && conv.attachments.length > 0) {
        for (const att of conv.attachments) {
          const url = att.attachment_url?.url || att.url || att.attachment_url;
          if (!url) continue;
          const name = att.name || att.filename || `conv-evidence-${att.id}`;
          try {
            await evidenceService._processAttachment(freshdeskId, name, att.content_type, url, att.size, {
              conversationId: conv.id,
              source: "conversation",
            });
          } catch {}
        }
      }
      if (conv.body) {
        const inlineImages = extractInlineImages(conv.body);
        for (const img of inlineImages) {
          try {
            await evidenceService._processAttachment(freshdeskId, img.name, img.contentType, img.url, null, {
              conversationId: conv.id,
              source: "conversation",
            });
          } catch {}
        }
      }
    }
  }

  async _detectAndLinkRelations() {
    try {
      return await relationService.detectRelations();
    } catch {
      return { linked: 0, markedResolved: 0 };
    }
  }

  async syncTicketDetail(ticketId) {
    const ft = await freshdesk.getTicket(ticketId);

    const existing = await ticketRepository.findByFreshdeskId(ft.id);
    const mapped = await this._processTicket(ft, existing);

    let ticket;
    if (existing) {
      await ticketRepository.saveChanges(existing, mapped);
      ticket = await ticketRepository.update(existing.id, mapped);
    } else {
      ticket = await ticketRepository.create(mapped);
    }

    const conversations = await freshdesk.getConversations(ticketId);
    await ticketRepository.syncConversations(ticket.id, conversations);
    await this._syncConversationEvidences(ticket.id, ft.id, conversations);
    await this._syncMergedParentEvidences(conversations);

    if (ft.attachments && ft.attachments.length > 0) {
      const downloaded = await Promise.all(
        ft.attachments.map((att) => this._resolveAttachment(att))
      );
      await ticketRepository.syncAttachments(ticket.id, downloaded);
      await this._syncTicketEvidences(ft.id, ft.attachments);
    }

    await this._syncParticipants(ticket.id, ft, mapped.requesterEmail);
    await this._assignGroupFromToParticipants(ticket.id, ft);

    try { await relationService.detectRelations(); } catch {}

    return ticket;
  }

  async pollRecent() {
    const since = new Date(Date.now() - 60000);
    const tickets = await freshdesk.getRecentTickets(since);
    let synced = 0;
    for (const ft of tickets) {
      const existing = await ticketRepository.findByFreshdeskId(ft.id);
      const mapped = await this._processTicket(ft, existing);
      let ticket;
      if (existing) {
        await ticketRepository.saveChanges(existing, mapped);
        ticket = await ticketRepository.update(existing.id, mapped);
      } else {
        ticket = await ticketRepository.create(mapped);
        synced++;
      }
      await this._syncParticipants(ticket.id, ft, mapped.requesterEmail);
      await this._assignGroupFromToParticipants(ticket.id, ft);
      try {
        const conversations = await freshdesk.getConversations(ft.id);
        if (conversations.length > 0) {
          await ticketRepository.syncConversations(ticket.id, conversations);
          await this._syncConversationEvidences(ticket.id, ft.id, conversations);
          await this._syncMergedParentEvidences(conversations);
        }
      } catch {}
      try {
        const detail = await freshdesk.getTicket(ft.id);
        const attachments = detail.attachments || [];
        if (attachments.length > 0) {
          const downloaded = await Promise.all(
            attachments.map((att) => this._resolveAttachment(att))
          );
          await ticketRepository.syncAttachments(ticket.id, downloaded);
          await this._syncTicketEvidences(ft.id, attachments);
        }
      } catch {}
    }
    return synced;
  }

  async _syncMergedParentEvidences(conversations) {
    if (!Array.isArray(conversations)) return;
    const mergeRegex = /This ticket is closed and merged into ticket (\d+)/i;
    for (const conv of conversations) {
      const body = conv.body_text || conv.body || "";
      const match = body.match(mergeRegex);
      if (match) {
        const parentId = Number(match[1]);
        if (!parentId || parentId === conv.id) continue;
        try {
          const parentConvs = await freshdesk.getConversations(parentId);
          if (parentConvs.length > 0) {
            await this._syncConversationEvidences(parentId, parentId, parentConvs);
          }
        } catch {}
        return;
      }
    }
  }

  async _syncParticipants(ticketId, ft, requesterEmail) {
    if (ft.cc_emails && ft.cc_emails.length > 0) {
      await ticketRepository.syncParticipants(ticketId, ft.cc_emails, "cc");
    }
    if (ft.to_emails && ft.to_emails.length > 0) {
      await ticketRepository.syncParticipants(ticketId, ft.to_emails, "to");
    }
    const email = requesterEmail || ft.requester_email || (ft.requester_id ? `${ft.requester_id}@freshdesk.com` : null);
    if (email) {
      await ticketRepository.syncParticipants(ticketId, [email], "requester");
    }
  }

  async _assignGroupFromToParticipants(ticketId, ft) {
    const toEmails = ft.to_emails;
    if (!Array.isArray(toEmails) || toEmails.length === 0) return;

    const mappings = await prisma.groupMapping.findMany({
      where: { escalationEmail: { not: null } },
      select: { groupId: true, groupName: true, escalationEmail: true },
    });
    if (mappings.length === 0) return;

    const matchedEmails = toEmails.map((e) => e.toLowerCase());
    const candidates = mappings.filter((m) =>
      m.escalationEmail.split(",").some((em) => matchedEmails.includes(em.trim().toLowerCase()))
    );
    if (candidates.length === 0) return;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return;

    let target = candidates[0];
    if (candidates.length > 1) {
      const detected = this._detectGroupFromSubject(ticket.subject);
      const bySubject = candidates.find((c) => c.groupId === detected);
      if (bySubject) target = bySubject;
    }

    if (ticket.assignedGroup === target.groupId) return;

    await ticketRepository.saveChanges(ticket, {
      assignedGroup: target.groupId,
      _movedBy: "System (To-participant)",
    });
    await ticketRepository.update(ticket.id, {
      freshdeskTicketId: ticket.freshdeskTicketId,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      requesterEmail: ticket.requesterEmail,
      assignedGroup: target.groupId,
      assignedAgent: ticket.assignedAgent,
      tags: ticket.tags,
      updatedAt: new Date(),
    });
  }

  _getAttachmentUrl(att) {
    return att.attachment_url?.url || att.url || att.attachment_url || null;
  }

  async _resolveAttachment(att) {
    const url = this._getAttachmentUrl(att);
    if (!url) return { ...att, attachment_url: null };
    if (typeof url === "string" && url.startsWith("/uploads/")) {
      return { ...att, attachment_url: url };
    }
    const local = await this._downloadAttachment(url, att.name || att.filename);
    return { ...att, attachment_url: local };
  }

  async _downloadAttachment(url, filename) {
    if (!url || url.startsWith("/uploads/")) return url;
    const ext = path.extname(filename) || ".bin";
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const dest = path.join(UPLOAD_DIR, safe);
    const isS3 = url.includes("s3.amazonaws.com") || url.includes("freshdesk.com");
    try {
      const res = await fetch(url, {
        headers: isS3 ? {} : { Authorization: freshdesk.authHeader() },
      });
      if (!res.ok) {
        // retry without auth if s3
        if (isS3) {
          const retry = await fetch(url);
          if (!retry.ok) return url;
          const buffer = Buffer.from(await retry.arrayBuffer());
          fs.writeFileSync(dest, buffer);
          return `/uploads/${safe}`;
        }
        return url;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      return `/uploads/${safe}`;
    } catch {
      return url;
    }
  }

  _mapTicket(ft) {
    const tags = Array.isArray(ft.tags) ? ft.tags.join(",") : ft.tags || null;
    return {
      freshdeskTicketId: ft.id,
      subject: ft.subject,
      description: ft.description_text || ft.description,
      status: ft.status,
      priority: ft.priority,
      requesterEmail: null,
      assignedGroup: ft.group_name || (ft.group_id ? String(ft.group_id) : null),
      assignedAgent: ft.responder_name || ft.agent_name || (ft.responder_id ? String(ft.responder_id) : null),
      tags,
      createdAt: new Date(ft.created_at),
      updatedAt: new Date(ft.updated_at),
    };
  }
}

export default new SyncService();
