import { useState, useEffect } from "react";
import Card from "../components/Card";

const TOPIC_COLORS = [
  "#4361ee", "#f72585", "#4cc9f0", "#f8961e", "#43aa8b",
  "#ff6b6b", "#6c63ff", "#ffa94d", "#69db7c", "#9775fa",
  "#f783ac", "#20c997", "#ffd43b", "#74c0fc", "#a9e34b",
];

const PRIORITY_COLORS = { 1: "bg-gray-100 text-gray-600", 2: "bg-blue-100 text-blue-700", 3: "bg-yellow-100 text-yellow-700", 4: "bg-red-100 text-red-700" };
const PRIORITY_LABELS = { 1: "Low", 2: "Medium", 3: "High", 4: "Urgent" };
const STATUS_LABELS = { 2: "Open", 3: "Pending", 4: "Resolved", 5: "Closed" };

function PieChart({ data, size = 200 }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.ticketCount, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;
  let cumulative = 0;
  const slices = data.map((d, i) => {
    const angle = (d.ticketCount / total) * 360;
    const startAngle = cumulative;
    cumulative += angle;
    return { ...d, startAngle, angle, color: TOPIC_COLORS[i % TOPIC_COLORS.length] };
  });
  function p2c(a) { const rad = ((a - 90) * Math.PI) / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; }
  function dArc(start, angle) {
    const end = start + angle, p1 = p2c(start), p2 = p2c(end), large = angle > 180 ? 1 : 0;
    if (angle >= 360) {
      const p3 = p2c(start + 179), p4 = p2c(start + 359);
      return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p3.x} ${p3.y} A ${r} ${r} 0 0 1 ${p4.x} ${p4.y} Z`;
    }
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
  }
  return (
    <svg width={size} height={size}>
      {slices.map((s, i) => <path key={i} d={dArc(s.startAngle, s.angle)} fill={s.color} stroke="#fff" strokeWidth="1" />)}
      <circle cx={cx} cy={cy} r={r * 0.4} fill="#fff" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="bold" fill="#333">{total}</text>
    </svg>
  );
}

export default function Clustering() {
  const [activeTab, setActiveTab] = useState("topics");
  const [clusters, setClusters] = useState([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [flow, setFlow] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const [topicRes, flowRes] = await Promise.all([
        fetch("/api/clustering/topics"),
        fetch("/api/clustering/escalation-flow"),
      ]);
      const topicJson = await topicRes.json();
      const flowJson = await flowRes.json();
      setClusters(topicJson.clusters || []);
      setTotalTickets(topicJson.totalTickets || 0);
      setFlow(flowJson.flow || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Memuat...</div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex gap-2 border-b pb-2">
        <button
          className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition ${activeTab === "topics" ? "bg-white text-navy border border-b-white -mb-[3px] border-gray-200" : "text-gray-500 hover:bg-gray-50"}`}
          onClick={() => setActiveTab("topics")}
        >
          Topik Tiket
        </button>
        <button
          className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition ${activeTab === "flow" ? "bg-white text-navy border border-b-white -mb-[3px] border-gray-200" : "text-gray-500 hover:bg-gray-50"}`}
          onClick={() => setActiveTab("flow")}
        >
          Alur Eskalasi
        </button>
      </div>

      {activeTab === "topics" && (
        <>
          <Card title="Analisis Topik Tiket" subtitle={`${totalTickets} tiket dikelompokkan berdasarkan isi subjek & deskripsi`}>
            <div className="flex flex-wrap gap-8 items-start mb-4">
              <PieChart data={clusters} size={200} />
              <div className="space-y-1.5">
                {clusters.map((c, i) => (
                  <div key={c.label} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded shrink-0" style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
                    <span className="text-gray-600 w-44 truncate">{c.label}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full w-32 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.percentage}%`, background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
                    </div>
                    <span className="font-semibold text-gray-700 w-12 text-right">{c.ticketCount}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {clusters.map((c, i) => (
            <Card key={c.label} accent={TOPIC_COLORS[i % TOPIC_COLORS.length]}>
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === c.label ? null : c.label)}>
                <div>
                  <h3 className="text-sm font-semibold text-navy">{c.label}</h3>
                  <p className="text-xs text-gray-400">{c.ticketCount} tiket ({c.percentage}%)</p>
                </div>
                <span className="text-gray-400 text-lg">{expanded === c.label ? "−" : "+"}</span>
              </div>

              {expanded === c.label && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Kata Kunci</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {c.topKeywords.map((kw) => (
                          <span key={kw.word} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium">
                            {kw.word}
                            <span className="text-gray-400 ml-1">({kw.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Distribusi Grup</h4>
                      <div className="space-y-1">
                        {c.groupDistribution.map((g) => (
                          <div key={g.groupId} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">&rarr;</span>
                            <span className="font-medium">{g.groupName}</span>
                            <span className="text-gray-400 ml-auto">{g.ticketCount} tiket</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Target Eskalasi</h4>
                      {c.escalationTargets.length > 0 ? (
                        <div className="space-y-1">
                          {c.escalationTargets.map((email, j) => (
                            <div key={j} className="text-xs font-mono text-primary break-all">{email}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Tidak ada</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tiket Terbaru</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <th className="px-2 py-1">ID</th>
                            <th className="px-2 py-1">Subjek</th>
                            <th className="px-2 py-1">Grup</th>
                            <th className="px-2 py-1">Status</th>
                            <th className="px-2 py-1">Prioritas</th>
                            <th className="px-2 py-1">Tgl</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.recentTickets.map((t) => (
                            <tr key={t.ticketId} className="border-b hover:bg-gray-50">
                              <td className="px-2 py-1 font-mono text-xs">#{t.ticketId}</td>
                              <td className="px-2 py-1 text-xs max-w-[200px] truncate">{t.subject}</td>
                              <td className="px-2 py-1 text-xs text-gray-500">{t.assignedGroup}</td>
                              <td className="px-2 py-1 text-xs">{STATUS_LABELS[t.status] || t.status}</td>
                              <td className="px-2 py-1"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[t.priority] || "bg-gray-100"}`}>{PRIORITY_LABELS[t.priority] || t.priority}</span></td>
                              <td className="px-2 py-1 text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {activeTab === "flow" && (
        <Card title="Alur Eskalasi per Grup" subtitle="Grup → Email Eskalasi → Target">
          {flow.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Belum ada data eskalasi</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flow.map((item, i) => (
                <div key={item.groupId} className="border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} />
                    <span className="font-semibold text-sm text-gray-800">{item.groupName}</span>
                    <span className="text-xs text-gray-400 ml-auto">{item.ticketCount} tiket</span>
                  </div>
                  {item.topKeywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.topKeywords.map((kw) => (
                        <span key={kw.word} className="px-1.5 py-0.5 bg-gray-50 rounded text-[10px] text-gray-500">{kw.word}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-2">
                    Eskalasi: <span className="font-mono text-primary break-all">{item.escalationEmail}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Target:</div>
                    {item.escalationTargets.map((t, j) => (
                      <div key={j} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="text-gray-300">&rarr;</span>
                        <span className="font-medium">{t.groupName}</span>
                        {t.email && <span className="text-gray-400">({t.email})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
