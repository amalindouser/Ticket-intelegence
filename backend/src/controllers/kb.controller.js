import prisma from "../config/prisma.js";

export async function importKb(req, res, next) {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: "data must be a non-empty array" });
    }

    const records = data.map((item) => ({
      ticketId: String(item["ID Ticket"] || ""),
      timestamp: item["Timestamp"] || null,
      responseTime: item["Response Time"] || null,
      clientName: item["Client Name"] || null,
      pic: item["PiC"] || null,
      kategoriKendala: item["Kategori Kendala"] || null,
      prioritas: item["Prioritas"] || null,
      deskripsiMasalah: item["Deskripsi Masalah"] || null,
      status: item["Status"] || null,
      namaHelpdesk: item["Nama Helpdesk"] || null,
      rootCause: item["Root Cause"] || null,
      penyelesaian: item["Penyelesaian"] || null,
      resolutionTime: item["Resolution Time"] || null,
      closeTime: item["Close Time"] || null,
    }));

    const result = await prisma.knowledgeBase.createMany({ data: records });
    res.json({ imported: result.count });
  } catch (err) {
    next(err);
  }
}

export async function searchKb(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "query param q is required" });
    }

    const results = await prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { deskripsiMasalah: { contains: q, mode: "insensitive" } },
          { penyelesaian: { contains: q, mode: "insensitive" } },
          { kategoriKendala: { contains: q, mode: "insensitive" } },
          { clientName: { contains: q, mode: "insensitive" } },
          { ticketId: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function listKb(req, res, next) {
  try {
    const { page = 1, perPage = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(perPage);
    const [data, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        skip,
        take: Number(perPage),
        orderBy: { createdAt: "desc" },
      }),
      prisma.knowledgeBase.count(),
    ]);
    res.json({ data, total, page: Number(page), perPage: Number(perPage) });
  } catch (err) {
    next(err);
  }
}
