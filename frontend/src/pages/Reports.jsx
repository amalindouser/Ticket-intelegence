import { useState } from "react";
import Card from "../components/Card";

const REPORT_TYPES = [
  { value: "summary", label: "Ringkasan", desc: "Total tiket per status & prioritas" },
  { value: "by-status", label: "Per Status", desc: "Distribusi tiket per status" },
  { value: "by-priority", label: "Per Prioritas", desc: "Distribusi tiket per prioritas" },
  { value: "by-group", label: "Per Grup", desc: "Distribusi tiket per grup" },
  { value: "per-day", label: "Per Hari", desc: "Tren tiket per hari" },
  { value: "top-requesters", label: "Top Requester", desc: "Pengirim tiket terbanyak" },
  { value: "all-tickets", label: "Semua Tiket", desc: "Seluruh data tiket" },
  { value: "group-movements", label: "Pergerakan Grup", desc: "Riwayat perpindahan grup" },
  { value: "escalations", label: "Eskalasi", desc: "Riwayat eskalasi tiket" },
  { value: "evidences", label: "Evidence", desc: "Daftar evidence file" },
];

const LABEL_MAP = {
  status: { 2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed" },
  prioritas: { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" },
};

export default function Reports() {
  const [type, setType] = useState("summary");
  const [data, setData] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ days: "30", limit: "10" });

  async function fetchReport(exportCsv = false) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ type });
      if (type === "per-day" && filters.days) params.set("days", filters.days);
      if (type === "top-requesters" && filters.limit) params.set("limit", filters.limit);
      if (type === "all-tickets" && filters.status) params.set("status", filters.status);
      if (type === "all-tickets" && filters.priority) params.set("priority", filters.priority);
      if (type === "all-tickets" && filters.group) params.set("group", filters.group);
      if ((type === "all-tickets" || type === "group-movements") && filters.startDate) params.set("startDate", filters.startDate);
      if ((type === "all-tickets" || type === "group-movements") && filters.endDate) params.set("endDate", filters.endDate);
      if (type === "evidences" && filters.fileType) params.set("fileType", filters.fileType);

      if (exportCsv) {
        params.set("export", "csv");
        window.open(`/api/reports?${params}`, "_blank");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Gagal memuat laporan"); }
      const json = await res.json();
      setData(json.data);
      setCount(json.count);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function renderTable() {
    if (!data || data.length === 0) return <p className="text-gray-400 text-sm py-8 text-center">Tidak ada data</p>;

    const headers = Object.keys(data[0]);

    return (
      <div className="overflow-x-auto mt-3 border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {headers.map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h.replace(/_/g, " ")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[h] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const showDateFilters = ["all-tickets", "group-movements"].includes(type);
  const showDaysFilter = type === "per-day";
  const showLimitFilter = type === "top-requesters";
  const showStatusFilter = type === "all-tickets";
  const showPriorityFilter = type === "all-tickets";
  const showGroupFilter = type === "all-tickets";
  const showFileTypeFilter = type === "evidences";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Laporan & Ekspor</h1>
      <p className="text-sm text-gray-400 mb-6">Pilih jenis laporan, filter, lalu lihat atau ekspor ke CSV</p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {REPORT_TYPES.map((r) => (
          <button key={r.value} onClick={() => { setType(r.value); setData(null); }}
            className={`text-left p-3 rounded-xl border transition-all ${type === r.value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
            <div className="text-sm font-semibold text-gray-800">{r.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{r.desc}</div>
          </button>
        ))}
      </div>

      <Card title={REPORT_TYPES.find((r) => r.value === type)?.label || type}>
        {(showDateFilters || showDaysFilter || showLimitFilter || showStatusFilter || showPriorityFilter || showGroupFilter || showFileTypeFilter) && (
          <div className="flex flex-wrap gap-3 mb-4 items-end">
            {showStatusFilter && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select className="border rounded-lg px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">Semua</option>
                  {Object.entries(LABEL_MAP.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            {showPriorityFilter && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prioritas</label>
                <select className="border rounded-lg px-3 py-2 text-sm" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
                  <option value="">Semua</option>
                  {Object.entries(LABEL_MAP.prioritas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            {showGroupFilter && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Grup</label>
                <input className="border rounded-lg px-3 py-2 text-sm w-32" placeholder="ID grup" value={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.value })} />
              </div>
            )}
            {showDateFilters && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dari</label>
                  <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sampai</label>
                  <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                </div>
              </>
            )}
            {showDaysFilter && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rentang (hari)</label>
                <input type="number" className="border rounded-lg px-3 py-2 text-sm w-24" min="1" max="365" value={filters.days} onChange={(e) => setFilters({ ...filters, days: e.target.value })} />
              </div>
            )}
            {showLimitFilter && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah</label>
                <input type="number" className="border rounded-lg px-3 py-2 text-sm w-24" min="1" max="100" value={filters.limit} onChange={(e) => setFilters({ ...filters, limit: e.target.value })} />
              </div>
            )}
            {showFileTypeFilter && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipe File</label>
                <select className="border rounded-lg px-3 py-2 text-sm" value={filters.fileType} onChange={(e) => setFilters({ ...filters, fileType: e.target.value })}>
                  <option value="">Semua</option>
                  <option value="image">Image</option>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => fetchReport(false)} disabled={loading}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
            {loading ? "Memuat..." : "Lihat Laporan"}
          </button>
          <button onClick={() => fetchReport(true)} disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Ekspor CSV
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        {data && (
          <div className="mt-2">
            <p className="text-xs text-gray-400">{count} baris</p>
            {renderTable()}
          </div>
        )}
      </Card>
    </div>
  );
}
