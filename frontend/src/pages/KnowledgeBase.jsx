import { useState, useEffect } from "react";

export default function KnowledgeBase() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/kb?page=${page}&perPage=20`);
      const d = await res.json();
      setData(d.data);
      setTotal(d.total);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [page]);

  async function handleImport(e) {
    e.preventDefault();
    setImportResult(null);
    if (!jsonText.trim()) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch("/api/kb/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: Array.isArray(parsed) ? parsed : [parsed] }),
      });
      const result = await res.json();
      setImportResult(result);
      setJsonText("");
      load();
    } catch (err) {
      setImportResult({ error: err.message });
    }
    setImporting(false);
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-xl sm:text-2xl font-bold">Knowledge Base</h1>
      <p className="text-sm text-gray-500">Import dan kelola data tiket referensi. Chatbot akan otomatis mencari solusi dari data ini.</p>

      <form onSubmit={handleImport} className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
        <h2 className="font-semibold text-sm">Import JSON</h2>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full h-40 border rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-navy/30"
          placeholder='[{ "ID Ticket": "32019", "Client Name": "...", ... }]'
        />
        <button type="submit" disabled={importing || !jsonText.trim()}
          className="bg-navy text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-all duration-200 btn-press">
          {importing ? "Importing..." : "Import"}
        </button>
        {importResult && (
          <p className={`text-sm ${importResult.error ? "text-red-500" : "text-green-600"}`}>
            {importResult.error || `${importResult.imported} records imported`}
          </p>
        )}
      </form>

      <div className="text-sm text-gray-500">{total} total records</div>

      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
      ) : data.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No data yet. Import JSON above.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium">Ticket ID</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Penyelesaian</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.ticketId}</td>
                  <td className="px-3 py-2">{r.clientName || "-"}</td>
                  <td className="px-3 py-2">{r.kategoriKendala || "-"}</td>
                  <td className="px-3 py-2">{r.status || "-"}</td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate">{r.penyelesaian || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Page {page} of {Math.ceil(total / 20)}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(p => Math.min(Math.ceil(total / 20), p + 1))} disabled={page >= Math.ceil(total / 20)}
              className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
