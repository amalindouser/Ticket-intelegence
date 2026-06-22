import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";

const TOPIC_COLORS = ["#4361ee", "#f72585", "#4cc9f0", "#f8961e", "#43aa8b", "#ff6b6b", "#6c63ff", "#ffa94d", "#69db7c", "#9775fa"];

function FlowDiagram({ edges }) {
  if (!edges || edges.length === 0) return <div className="text-center py-8 text-gray-400">No movement data</div>;

  const allNodes = [...new Set(edges.flatMap((e) => [e.fromGroup, e.toGroup]))];
  const maxCount = Math.max(...edges.map((e) => e.count));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-3 py-2">From</th>
            <th className="px-3 py-2">Flow</th>
            <th className="px-3 py-2">To</th>
            <th className="px-3 py-2 text-right">Count</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((e, i) => (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TOPIC_COLORS[allNodes.indexOf(e.fromGroup) % TOPIC_COLORS.length] }} />
                  <span className="font-medium text-xs">{e.fromGroup}</span>
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden" style={{ maxWidth: 120 }}>
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(e.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-400">&rarr;</span>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TOPIC_COLORS[allNodes.indexOf(e.toGroup) % TOPIC_COLORS.length] }} />
                  <span className="font-medium text-xs">{e.toGroup}</span>
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-sm">{e.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GroupMovements() {
  const [movements, setMovements] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, perPage });
      if (groupId) params.set("groupId", groupId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const [movRes, statsRes] = await Promise.all([
        fetch(`/api/tickets/group-movements?${params}`),
        fetch("/api/tickets/group-movements/stats"),
      ]);
      const movJson = await movRes.json();
      const statsJson = await statsRes.json();
      setMovements(movJson.data || []);
      setTotal(movJson.total || 0);
      setStats(statsJson);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [page]);

  function handleFilter(e) {
    e.preventDefault();
    setPage(1);
    fetchData();
  }

  const totalPages = Math.ceil(total / perPage);
  const mostMoved = stats?.mostMoved || [];
  const flowEdges = stats?.flowEdges || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy">Group Movement Analysis</h2>
      </div>

      {mostMoved.length > 0 && (
        <Card title="Tiket Paling Sering Berpindah Grup" subtitle="20 tiket dengan perpindahan grup terbanyak">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-3 py-2">Ticket</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2 text-right">Movements</th>
                </tr>
              </thead>
              <tbody>
                {mostMoved.slice(0, 10).map((t, i) => (
                  <tr key={t.ticketId} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link to={`/tickets/${t.ticketId}`} className="text-primary hover:underline">
                        #{t.ticketId}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[300px] truncate">{t.subject}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                        {t.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Flow Perpindahan Grup" subtitle="Visualisasi alur perpindahan grup antar tiket">
        <FlowDiagram edges={flowEdges} />
      </Card>

      <Card title="Riwayat Perpindahan Grup">
        <form onSubmit={handleFilter} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 mb-4">
          <div className="w-full sm:w-28">
            <label className="block text-xs font-medium text-gray-500 mb-1">Group ID</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="ex: 1004" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input type="date" className="w-full sm:w-auto border rounded-lg px-3 py-2 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1 sm:flex-none">
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input type="date" className="w-full sm:w-auto border rounded-lg px-3 py-2 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium btn-press transition-all duration-200">Filter</button>
        </form>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Memuat...</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Belum ada data perpindahan grup</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">&rarr;</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">By</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <Link to={`/tickets/${m.ticketId}`} className="font-mono text-xs text-primary hover:underline">
                          #{m.ticketId}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium text-gray-600">{m.fromGroup || "-"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-300 text-xs">&rarr;</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium text-gray-600">{m.toGroup}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{m.movedBy || "-"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(m.movedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
                  <button className="px-3 py-1 rounded border text-sm disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                  <span className="px-3 py-1 text-gray-500">{page} / {totalPages}</span>
                  <button className="px-3 py-1 rounded border text-sm disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
