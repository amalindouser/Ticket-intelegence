import { useState, useEffect, useCallback } from "react";
import Card from "../components/Card";

const FILE_TYPE_COLORS = {
  image: "bg-blue-100 text-blue-800",
  pdf: "bg-red-100 text-red-800",
  video: "bg-purple-100 text-purple-800",
  document: "bg-green-100 text-green-800",
  other: "bg-gray-100 text-gray-800",
};

const FILE_TYPE_ICONS = {
  image: "\u{1F5BC}",
  pdf: "\u{1F4C4}",
  video: "\u{1F3AC}",
  document: "\u{1F4DD}",
  other: "\u{1F4CE}",
};

async function fetchBlob(url) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Gagal mengambil file");
  const ct = res.headers.get("Content-Type") || "";
  const blob = await res.blob();
  return { blob, contentType: ct };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function PreviewModal({ evidence, onClose, onDelete }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!evidence) return;
    setBlobUrl(null);
    setContentType("");
    setError(false);
    setLoading(true);

    fetchBlob(`/api/evidences/${evidence.id}/download`)
      .then(({ blob, contentType }) => {
        setContentType(contentType);
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch((err) => {
        setError(true);
        console.error("Preview error:", err.message);
      })
      .finally(() => setLoading(false));

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [evidence]);

  async function handleDownload() {
    try {
      const { blob } = await fetchBlob(`/api/evidences/${evidence.id}/download`);
      triggerDownload(blob, evidence.fileName);
    } catch {
      alert("Gagal mengunduh file");
    }
  }

  if (!evidence) return null;

  const ext = evidence.fileName?.toLowerCase().split('.').pop() || '';
  const isImage = blobUrl && contentType.startsWith("image/");
  const isPdf = blobUrl && (contentType.includes("pdf") || ext === "pdf");
  const isVideo = blobUrl && contentType.startsWith("video/");
  const isAudio = blobUrl && contentType.startsWith("audio/");
  const isText = blobUrl && (
    contentType.startsWith("text/") ||
    ["txt","csv","log","json","xml","md","html","js","ts","py","css","yml","yaml"].includes(ext)
  );
  const isHtmlError = blobUrl && contentType.includes("text/html") && ext !== "html";
  const canPreview = isImage || isPdf || isVideo || isAudio || isText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg truncate pr-4">{evidence.fileName}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              className="text-primary hover:text-primary-dark text-sm font-medium px-3 py-1 border border-primary rounded-lg"
            >
              Download
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Hapus "${evidence.fileName}"?`)) {
                  onDelete(evidence.id);
                }
              }}
              className="text-danger hover:text-red-700 text-sm font-medium px-3 py-1 border border-danger rounded-lg"
            >
              Hapus
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="flex items-center justify-center h-32 bg-red-50 rounded-lg text-red-500 font-medium">
              Preview file tidak tersedia.
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg text-gray-400">
              Memuat...
            </div>
          )}
          {isImage && (
            <img src={blobUrl} alt={evidence.fileName} className="max-w-full rounded-lg" />
          )}
          {isPdf && (
            <embed src={blobUrl} type="application/pdf" className="w-full h-96 rounded-lg border" />
          )}
          {isVideo && (
            <video controls className="w-full rounded-lg">
              <source src={blobUrl} />
            </video>
          )}
          {isAudio && (
            <audio controls className="w-full">
              <source src={blobUrl} />
            </audio>
          )}
          {isText && (
            <iframe src={blobUrl} className="w-full h-64 rounded-lg border" title={evidence.fileName} />
          )}
          {isHtmlError && (
            <div className="flex items-center justify-center h-32 bg-red-50 rounded-lg text-red-500 font-medium">
              Preview file tidak tersedia.
            </div>
          )}
          {!error && !loading && blobUrl && !canPreview && !isHtmlError && (
            <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg text-gray-400">
              <button onClick={handleDownload} className="text-primary underline text-sm">Download {evidence.fileName}</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Ticket ID:</span> <span className="font-medium">{evidence.ticketId}</span></div>
            <div><span className="text-gray-500">Tipe:</span> <span className="font-medium">{evidence.fileType}</span></div>
            <div><span className="text-gray-500">Ukuran:</span> <span className="font-medium">{evidence.fileSize ? `${(evidence.fileSize / 1024).toFixed(1)} KB` : "-"}</span></div>
            <div><span className="text-gray-500">Tanggal:</span> <span className="font-medium">{new Date(evidence.createdAt).toLocaleDateString("id-ID")}</span></div>
          </div>
          {evidence.extractedText && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-1">Terekstrak:</h4>
              <pre className="bg-gray-50 p-3 rounded-lg text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{evidence.extractedText}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Evidences() {
  const [evidences, setEvidences] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [fileType, setFileType] = useState("");
  const [ticketIdFilter, setTicketIdFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [collectInput, setCollectInput] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);
  const [preview, setPreview] = useState(null);

  async function fetchEvidences() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, perPage });
      if (fileType) params.set("fileType", fileType);
      if (ticketIdFilter) params.set("ticketId", ticketIdFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/evidences?${params}`);
      const json = await res.json();
      setEvidences(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvidences();
  }, [page]);

  function handleFilter(e) {
    e.preventDefault();
    setPage(1);
    fetchEvidences();
  }

  async function handleCollect() {
    const ids = collectInput.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n));
    if (ids.length === 0) return;
    setCollecting(true);
    setCollectResult(null);
    try {
      const res = await fetch("/api/evidences/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: ids }),
      });
      const json = await res.json();
      setCollectResult(json);
      fetchEvidences();
    } catch (err) {
      console.error(err);
    } finally {
      setCollecting(false);
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetch(`/api/evidences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal hapus");
      fetchEvidences();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus evidence");
    }
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6 animate-fadeIn">
      <Card title="Evidence / Document Collector" subtitle="Kumpulkan dan kelola lampiran tiket">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">ID Tiket (pisah dgn koma)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="ex: 32070, 32071, 32072"
              value={collectInput}
              onChange={(e) => setCollectInput(e.target.value)}
            />
          </div>
          <button
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            onClick={handleCollect}
            disabled={collecting}
          >
            {collecting ? "Mengumpulkan..." : "Kumpulkan Evidence"}
          </button>
        </div>
        {collectResult && (
          <div className="mt-3 text-sm">
            <span className="font-medium">Hasil: </span>
            {collectResult.results?.map((r) => (
              <span key={r.ticketId} className={`mr-3 ${r.error ? "text-danger" : "text-success"}`}>
                #{r.ticketId}: {r.error || `${r.count} file`}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <form onSubmit={handleFilter} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 mb-4">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipe File</label>
            <select className="w-full sm:w-auto border rounded-lg px-3 py-2 text-sm" value={fileType} onChange={(e) => setFileType(e.target.value)}>
              <option value="">Semua</option>
              <option value="image">Gambar</option>
              <option value="pdf">PDF</option>
              <option value="video">Video</option>
              <option value="document">Dokumen</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">ID Tiket</label>
            <input className="w-full sm:w-32 border rounded-lg px-3 py-2 text-sm" placeholder="ex: 32070" value={ticketIdFilter} onChange={(e) => setTicketIdFilter(e.target.value)} />
          </div>
          <div className="flex-1 w-full sm:min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Cari Teks</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Cari dalam teks ter-ekstrak..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium btn-press transition-all duration-200">Filter</button>
        </form>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Memuat...</div>
        ) : evidences.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Belum ada evidence</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Nama File</th>
                    <th className="px-3 py-2">Tipe</th>
                    <th className="px-3 py-2">Teks Ekstraksi</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {evidences.map((ev) => (
                    <tr
                      key={ev.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setPreview(ev)}
                    >
                      <td className="px-3 py-2 font-mono text-xs">#{ev.ticketId}</td>
                      <td className="px-3 py-2 font-medium max-w-[200px] truncate">{ev.fileName}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${FILE_TYPE_COLORS[ev.fileType] || FILE_TYPE_COLORS.other}`}>
                          {FILE_TYPE_ICONS[ev.fileType] || ""} {ev.fileType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[300px]">
                        <span className="line-clamp-2 text-xs">
                          {ev.extractedText || <span className="italic">-</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          className="text-primary hover:text-primary-dark text-sm font-medium mr-2"
                          title="Download"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { blob } = await fetchBlob(`/api/evidences/${ev.id}/download`);
                              triggerDownload(blob, ev.fileName);
                            } catch { alert("Gagal mengunduh file"); }
                          }}
                        >
                          Download
                        </button>
                        <button
                          className="text-danger hover:text-red-700 text-sm font-medium"
                          title="Hapus"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Hapus "${ev.fileName}"?`)) handleDelete(ev.id);
                          }}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-gray-500">{total} total</span>
                <div className="flex gap-1">
                  <button
                    className="px-3 py-1 rounded border text-sm disabled:opacity-30"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1 text-gray-500">{page} / {totalPages}</span>
                  <button
                    className="px-3 py-1 rounded border text-sm disabled:opacity-30"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <PreviewModal evidence={preview} onClose={() => setPreview(null)} onDelete={handleDelete} />
    </div>
  );
}
