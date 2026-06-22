import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function MovementsTab() {
  const [movements, setMovements] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData(pg) {
    setLoading(true);
    const p = pg ?? page;
    try {
      const params = new URLSearchParams({ page: p, perPage: 20 });
      if (groupId) params.set("groupId", groupId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const [movRes, statsRes] = await Promise.all([
        fetch(`/api/tickets/group-movements?${params}`),
        fetch("/api/tickets/group-movements/stats"),
      ]);
      const [movJson, statsJson] = await Promise.all([movRes.json(), statsRes.json()]);
      setMovements(movJson.data || []);
      setTotal(movJson.total || 0);
      setStats(statsJson);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [page]);

  const mostMoved = stats?.mostMoved || [];
  const flowEdges = stats?.flowEdges || [];
  const totalPages = Math.ceil(total / 20);
  const maxFlow = Math.max(1, ...flowEdges.map((e) => e.count));

  return (
    <div className="space-y-5">

      {/* Most Moved Tickets */}
      {mostMoved.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <h2 className="text-sm font-bold text-navy">Tiket Paling Sering Berpindah Grup</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2.5">Ticket</th>
                  <th className="px-3 py-2.5">Subject</th>
                  <th className="px-3 py-2.5 text-right">Pindah</th>
                </tr>
              </thead>
              <tbody>
                {mostMoved.slice(0, 10).map((t) => (
                  <tr key={t.ticketId} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link to={`/tickets/${t.ticketUuid || t.ticketId}`} className="font-mono text-xs text-primary hover:underline font-medium">
                        #{t.ticketId}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[300px] truncate">{t.subject}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-[11px] font-bold">
                        <span>{t.count}x</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flow Edges */}
      {flowEdges.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <h2 className="text-sm font-bold text-navy">Flow Perpindahan Grup</h2>
          </div>
          <div className="space-y-2">
            {flowEdges.map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors">
                <span className="text-xs font-medium text-gray-600 w-28 truncate text-right">{e.fromGroup}</span>
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                      style={{ width: `${(e.count / maxFlow) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-300 text-xs">&rarr;</span>
                </div>
                <span className="text-xs font-medium text-gray-600 w-28 truncate">{e.toGroup}</span>
                <span className="text-xs font-bold text-navy w-8 text-right">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movements History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-navy" />
          <h2 className="text-sm font-bold text-navy">Riwayat Perpindahan</h2>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-5 p-4 bg-gray-50 rounded-xl">
          <div className="w-full sm:w-auto">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Group ID</label>
            <input className="w-full sm:w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy outline-none transition-all" placeholder="ex: 1004" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Dari</label>
            <input type="date" className="w-full sm:w-auto border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy outline-none transition-all" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Sampai</label>
            <input type="date" className="w-full sm:w-auto border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-navy/20 focus:border-navy outline-none transition-all" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button className="bg-navy text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 btn-press shadow-sm" onClick={() => { setPage(1); fetchData(1); }}>
            Filter
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-navy border-t-transparent rounded-full" />
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 text-gray-400 italic text-sm">Belum ada data perpindahan grup</div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2.5">Ticket</th>
                    <th className="px-3 py-2.5">Dari</th>
                    <th className="px-3 py-2.5 w-8"></th>
                    <th className="px-3 py-2.5">Ke</th>
                    <th className="px-3 py-2.5">Oleh</th>
                    <th className="px-3 py-2.5">Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <Link to={`/tickets/${m.ticketUuid || m.ticketId}`} className="font-mono text-xs text-primary hover:underline font-medium">
                          #{m.ticketId}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{m.fromGroup || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-300 text-sm text-center">&rarr;</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{m.toGroup}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{m.movedBy || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(m.movedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-xs text-gray-400">{total} total perpindahan</span>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </button>
                  <span className="px-2 py-1.5 text-xs text-gray-500 font-medium">{page} / {totalPages}</span>
                  <button className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}