import { useState, useEffect } from "react";

const CLUSTER_GRADIENTS = [
  "from-blue-500 to-indigo-600", "from-pink-500 to-rose-600", "from-cyan-400 to-teal-500",
  "from-orange-400 to-red-500", "from-emerald-400 to-green-600", "from-red-400 to-pink-500",
  "from-purple-500 to-violet-600", "from-amber-400 to-orange-500", "from-lime-400 to-green-500",
  "from-violet-400 to-purple-600", "from-rose-400 to-pink-500", "from-teal-400 to-cyan-600",
  "from-yellow-300 to-amber-500", "from-sky-400 to-blue-500", "from-green-400 to-emerald-500",
];

const CLUSTER_BG = [
  "bg-blue-50", "bg-pink-50", "bg-cyan-50", "bg-orange-50", "bg-emerald-50",
  "bg-red-50", "bg-purple-50", "bg-amber-50", "bg-lime-50", "bg-violet-50",
  "bg-rose-50", "bg-teal-50", "bg-yellow-50", "bg-sky-50", "bg-green-50",
];

const PRIORITY_STYLES = { 1: "bg-gray-100 text-gray-500", 2: "bg-blue-100 text-blue-700", 3: "bg-amber-100 text-amber-700", 4: "bg-red-100 text-red-700" };
const PRIORITY_LABELS = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };
const STATUS_STYLES = { 2: "bg-blue-50 text-blue-600", 3: "bg-yellow-50 text-yellow-600", 4: "bg-emerald-50 text-emerald-600", 5: "bg-gray-100 text-gray-500" };
const STATUS_LABELS = { 2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed" };

function MiniRing({ data, size = 160 }) {
  if (!data?.length) return null;
  const total = data.reduce((s, d) => s + d.ticketCount, 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 12, w = 18;
  let cur = 0;
  const arcs = data.map((d, i) => {
    const angle = (d.ticketCount / total) * 360;
    const a = cur; cur += angle;
    return { ...d, startAngle: a, angle, color: `hsl(${(i * 360 / data.length + 220) % 360}, 70%, 55%)` };
  });
  function polar(a) {
    const rad = ((a - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arcPath(start, sweep) {
    if (sweep >= 360) {
      const p1 = polar(0), p2 = polar(180), p3 = polar(359);
      return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} A ${r} ${r} 0 0 1 ${p3.x} ${p3.y}`;
    }
    const p1 = polar(start), p2 = polar(start + sweep), large = sweep > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  }
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f3f5" strokeWidth={w} />
      {arcs.map((s, i) => (
        <path key={i} d={arcPath(s.startAngle, s.angle)} fill="none" stroke={s.color} strokeWidth={w} strokeLinecap="round" />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="#1a1a2e">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#888">tiket</text>
    </svg>
  );
}

export default function ClusteringTab() {
  const [clusters, setClusters] = useState([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/clustering/topics")
      .then((r) => r.json())
      .then((d) => {
        setClusters(d.clusters || []);
        setTotalTickets(d.totalTickets || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-navy border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Hero Ring Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          <MiniRing data={clusters} size={180} />
          <div className="flex-1 min-w-0 w-full space-y-2">
            <h2 className="text-base font-bold text-navy">Analisis Topik Tiket</h2>
            <p className="text-xs text-gray-400 mb-4">{totalTickets} tiket dikelompokkan</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {clusters.map((c, i) => (
                <div key={c.label} className="flex items-center gap-2.5 text-sm group">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `hsl(${(i * 360 / clusters.length + 220) % 360}, 70%, 55%)` }} />
                  <span className="text-gray-600 truncate flex-1">{c.label}</span>
                  <span className="font-semibold text-navy">{c.ticketCount}</span>
                  <span className="text-[11px] text-gray-400 w-8 text-right">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Cards */}
      {clusters.map((c, i) => {
        const grad = CLUSTER_GRADIENTS[i % CLUSTER_GRADIENTS.length];
        const bg = CLUSTER_BG[i % CLUSTER_BG.length];
        const isOpen = expanded === c.label;
        return (
          <div key={c.label} className={`bg-white rounded-2xl shadow-sm border card-lift transition-all duration-300 ${isOpen ? "shadow-md border-gray-200" : "border-gray-100"}`}>
            <button
              className="w-full flex items-center justify-between p-5 text-left"
              onClick={() => setExpanded(isOpen ? null : c.label)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-1 h-10 rounded-full bg-gradient-to-b ${grad} shrink-0`} />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-navy truncate">{c.label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{c.ticketCount} tiket &middot; {c.percentage}% dari total</p>
                </div>
              </div>
              <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-sm transition-all duration-300 ${isOpen ? "bg-navy text-white rotate-180" : "bg-gray-100 text-gray-400"}`}>
                {isOpen ? "−" : "+"}
              </span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 animate-fadeIn">
                <div className="border-t border-gray-100 pt-5">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 stagger-2">

                    {/* Keywords */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Kata Kunci</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {c.topKeywords.map((kw) => (
                          <span key={kw.word} className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${bg} text-gray-700`}>
                            {kw.word}
                            <span className="ml-1 opacity-50">({kw.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Group Distribution */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Distribusi Grup</h4>
                      <div className="space-y-2">
                        {c.groupDistribution.map((g) => (
                          <div key={g.groupId} className="flex items-center gap-2">
                            <span className="text-gray-300 text-xs">&rarr;</span>
                            <span className="text-xs font-medium text-gray-700 flex-1 truncate">{g.groupName}</span>
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${(g.ticketCount / Math.max(...c.groupDistribution.map(x => x.ticketCount))) * 100}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-gray-500 w-6 text-right">{g.ticketCount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Target Eskalasi */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Target Eskalasi</h4>
                      {c.escalationTargets.length > 0 ? (
                        <div className="space-y-1.5">
                          {c.escalationTargets.map((email, j) => (
                            <div key={j} className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-gray-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              <span className="text-[11px] font-mono text-primary truncate">{email}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </div>

                  </div>

                  {/* Recent Tickets */}
                  <div className="mt-5">
                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Tiket Terbaru</h4>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            <th className="px-3 py-2.5">ID</th>
                            <th className="px-3 py-2.5">Subjek</th>
                            <th className="px-3 py-2.5">Grup</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Prioritas</th>
                            <th className="px-3 py-2.5">Tgl</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.recentTickets.map((t) => (
                            <tr key={t.ticketId} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="px-3 py-2.5 font-mono text-xs text-gray-500">#{t.ticketId}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[200px] truncate">{t.subject}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 truncate">{t.assignedGroup}</td>
                              <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${STATUS_STYLES[t.status] || "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[t.status] || t.status}</span></td>
                              <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${PRIORITY_STYLES[t.priority] || "bg-gray-100 text-gray-500"}`}>{PRIORITY_LABELS[t.priority] || t.priority}</span></td>
                              <td className="px-3 py-2.5 text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}