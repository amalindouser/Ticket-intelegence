import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import Tesseract from "tesseract.js";
import prisma from "../config/prisma.js";
import freshdesk from "./freshdesk.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, "../../uploads/evidence");

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export function extractInlineImages(htmlBody) {
  if (!htmlBody) return [];
  const images = [];
  const regex = /<img[^>]+src="(https:\/\/attachment\.freshdesk\.com\/inline\/attachment\?token=[^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(htmlBody)) !== null) {
    const src = match[1];
    const idMatch = match[0].match(/data-id="(\d+)"/);
    const id = idMatch ? idMatch[1] : `inline-${images.length}`;
    images.push({
      url: src,
      name: `inline_image_${id}.png`,
      contentType: "image/png",
    });
  }
  return images;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/bmp", "image/webp"];
const PDF_TYPES = ["application/pdf"];
const VIDEO_TYPES = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"];
const DOC_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
];

function classifyType(contentType) {
  if (!contentType) return "other";
  const ct = contentType.toLowerCase();
  if (IMAGE_TYPES.includes(ct)) return "image";
  if (PDF_TYPES.includes(ct)) return "pdf";
  if (VIDEO_TYPES.includes(ct)) return "video";
  if (DOC_TYPES.includes(ct)) return "document";
  if (ct.startsWith("image/")) return "image";
  return "other";
}

function classifyTypeByExt(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext)) return "image";
  if ([".pdf"].includes(ext)) return "pdf";
  if ([".mp4", ".mpeg", ".mov", ".avi"].includes(ext)) return "video";
  if ([".doc", ".docx", ".txt", ".csv", ".xls", ".xlsx"].includes(ext)) return "document";
  return "other";
}

function getImageMimeType(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  const map = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".webp": "image/webp" };
  return map[ext] || null;
}

class EvidenceService {
  async _extractAllAttachments(ticketId) {
    const ticket = await freshdesk.getTicket(ticketId);

    let conversations = [];
    try {
      conversations = await freshdesk.getConversations(ticketId);
    } catch {
      // conversations API may be restricted
    }

    const seenUrls = new Set();
    const attachments = [];

    if (ticket.attachments && ticket.attachments.length > 0) {
      for (const att of ticket.attachments) {
        const url = att.attachment_url?.url || att.url || att.attachment_url;
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          attachments.push({
            id: att.id,
            name: att.name || att.filename || `attachment-${att.id}`,
            contentType: att.content_type || att.contentType || classifyTypeByExt(att.name || att.filename),
            fileSize: att.size || att.fileSize,
            url,
            source: "ticket",
          });
        }
      }
    }

    for (const conv of conversations) {
      if (conv.attachments && conv.attachments.length > 0) {
        for (const att of conv.attachments) {
          const url = att.attachment_url?.url || att.url || att.attachment_url;
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            attachments.push({
              id: att.id,
              name: att.name || att.filename || `attachment-${att.id}`,
              contentType: att.content_type || att.contentType || classifyTypeByExt(att.name || att.filename),
              fileSize: att.size || att.fileSize,
              url,
              source: "conversation",
            });
          }
        }
      }
      if (conv.body) {
        const inlineImages = extractInlineImages(conv.body);
        for (const img of inlineImages) {
          if (!attachments.some((a) => a.url === img.url)) {
            attachments.push({
              ...img,
              id: `inline-${conv.id}-${img.name}`,
              fileSize: null,
              source: "conversation",
            });
          }
        }
      }
    }

    if (ticket.description) {
      const inlineImages = extractInlineImages(ticket.description);
      for (const img of inlineImages) {
        if (!attachments.some((a) => a.url === img.url)) {
          attachments.push({
            ...img,
            id: `inline-ticket-${img.name}`,
            fileSize: null,
            source: "ticket",
          });
        }
      }
    }

    return attachments;
  }

  async _downloadAttachment(url, filename) {
    if (!url) return null;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const allowedHosts = [
      "freshdesk.com", "s3.amazonaws.com", "s3-", "attachment.freshdesk.com",
      "ainosi.freshdesk.com", "ainoindonesia.freshdesk.com",
      ...(process.env.ALLOWED_DOWNLOAD_HOSTS || "").split(",").filter(Boolean),
    ];
    const host = parsed.hostname;
    if (!allowedHosts.some((a) => host === a || host.endsWith("." + a) || host.startsWith(a))) {
      return null;
    }
    const ext = path.extname(filename) || ".bin";
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const dest = path.join(EVIDENCE_DIR, safe);
    const isS3 = url.includes("s3.amazonaws.com") || url.includes("s3-");
    try {
      const res = await fetch(url, {
        headers: isS3 ? {} : { Authorization: freshdesk.authHeader() },
      });
      if (!res.ok) {
        if (isS3) {
          const retry = await fetch(url);
          if (!retry.ok) return null;
          const buffer = Buffer.from(await retry.arrayBuffer());
          fs.writeFileSync(dest, buffer);
          return { filePath: `/uploads/evidence/${safe}`, fileSize: buffer.length };
        }
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      return { filePath: `/uploads/evidence/${safe}`, fileSize: buffer.length };
    } catch {
      return null;
    }
  }

  async _extractText(filePath, fileType) {
    const absolutePath = path.resolve(__dirname, "../..", filePath);
    if (!fs.existsSync(absolutePath)) return null;

    if (fileType === "image") {
      try {
        const { data } = await Tesseract.recognize(absolutePath, "eng+ind");
        return data.text || null;
      } catch {
        return null;
      }
    }

    if (fileType === "pdf") {
      try {
        const { data } = await Tesseract.recognize(absolutePath, "eng+ind");
        return data.text || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  async _processAttachment(ticketId, name, contentType, url, fileSize, extra = {}) {
    const fileType = contentType
      ? classifyType(contentType)
      : classifyTypeByExt(name);

    const existing = await prisma.evidence.findFirst({
      where: {
        ticketId: BigInt(ticketId),
        OR: [
          { fileName: name },
          { filePath: { contains: path.basename(url) } },
        ],
      },
    });
    if (existing) return existing;

    const downloadResult = await this._downloadAttachment(url, name);
    if (!downloadResult) return null;
    let extractedText = null;
    if (fileType === "image" || fileType === "pdf") {
      extractedText = await this._extractText(downloadResult.filePath, fileType);
    }
    return prisma.evidence.create({
      data: {
        ticketId: BigInt(ticketId),
        conversationId: extra.conversationId ? BigInt(extra.conversationId) : null,
        source: extra.source || "ticket",
        fileName: name,
        fileType,
        fileSize: downloadResult.fileSize || fileSize || null,
        filePath: downloadResult.filePath,
        extractedText,
      },
    });
  }

  async getTicketEvidences(ticketId, _visited = new Set()) {
    if (_visited.has(Number(ticketId))) return [];
    _visited.add(Number(ticketId));

    const freshdeskAttachments = await this._extractAllAttachments(ticketId);
    const results = [];

    for (const att of freshdeskAttachments) {
      const ev = await this._processAttachment(
        ticketId, att.name, att.contentType, att.url, att.fileSize
      );
      if (ev) results.push(ev);
    }

    // Also process locally-recorded attachments from the sync
    const ticketRows = await prisma.ticket.findMany({
      where: { freshdeskTicketId: BigInt(ticketId) },
      select: { id: true },
    });

    if (ticketRows.length > 0) {
      const tids = ticketRows.map((r) => r.id);
      const existingFilenames = new Set(results.map((r) => r.fileName));
      const localAttachments = await prisma.attachment.findMany({
        where: { ticketId: { in: tids } },
      });

      for (const att of localAttachments) {
        if (existingFilenames.has(att.filename)) continue;
        existingFilenames.add(att.filename);
        if (!att.attachmentUrl) continue;
        const ev = await this._processAttachment(
          ticketId, att.filename, att.contentType, att.attachmentUrl, att.fileSize
        );
        if (ev) results.push(ev);
      }
    }

    // Check for merged child tickets in Freshdesk conversations
    try {
      const conversations = await freshdesk.getConversations(ticketId);
      const mergedIds = new Set();
      for (const conv of conversations) {
        const body = conv.body_text || conv.body || "";
        const match = body.match(/(?:Ticket|Tickets)\s+with\s+IDs?\s+(\d[\d,\s]*\d)\s+is\s+merged\s+into\s+this\s+ticket/i);
        if (match) {
          match[1].split(/[,\s]+/).filter(Boolean).forEach((id) => {
            const n = Number(id);
            if (n && n !== Number(ticketId)) mergedIds.add(n);
          });
        }
      }
      for (const mergedId of mergedIds) {
        const mergedEvs = await this.getTicketEvidences(mergedId, _visited);
        for (const ev of mergedEvs) {
          const existingEv = results.find((r) => r.fileName === ev.fileName);
          if (!existingEv) results.push(ev);
        }
      }
    } catch {}

    return results;
  }

  async collectFromTickets(ticketIds) {
    const results = [];
    for (const id of ticketIds) {
      try {
        const evidences = await this.getTicketEvidences(id);
        results.push({ ticketId: id, count: evidences.length, evidences });
      } catch (err) {
        results.push({ ticketId: id, count: 0, error: err.message });
      }
    }
    return results;
  }

  async listEvidences(filters = {}) {
    const { ticketId, fileType, dateFrom, dateTo, search, page = 1, perPage = 20 } = filters;
    const where = {};

    if (ticketId) {
      where.ticketId = BigInt(ticketId);
    }
    if (fileType) {
      where.fileType = fileType;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.extractedText = { contains: search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.evidence.count({ where }),
    ]);

    return { data, total, page, perPage };
  }

  async downloadEvidence(id) {
    const ev = await prisma.evidence.findUnique({ where: { id } });
    if (!ev) return null;
    const uploadsDir = path.resolve(__dirname, "../../uploads");
    const relativePath = ev.filePath.startsWith("/") ? ev.filePath.slice(1) : ev.filePath;
    const filePath = path.resolve(__dirname, "../..", relativePath);
    if (!filePath.startsWith(uploadsDir)) return null;
    if (!fs.existsSync(filePath)) return null;
    return { ...ev, filePath };
  }

  async deleteEvidence(id) {
    const ev = await prisma.evidence.findUnique({ where: { id } });
    if (!ev) throw new Error("Evidence not found");
    const uploadsDir = path.resolve(__dirname, "../../uploads");
    const relativePath = ev.filePath.startsWith("/") ? ev.filePath.slice(1) : ev.filePath;
    const filePath = path.resolve(__dirname, "../..", relativePath);
    if (!filePath.startsWith(uploadsDir)) throw new Error("Invalid file path");
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    await prisma.evidence.delete({ where: { id } });
    return ev;
  }
}

export default new EvidenceService();
