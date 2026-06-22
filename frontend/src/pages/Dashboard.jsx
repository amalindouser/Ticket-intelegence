import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import useGroupMappings from "../hooks/useGroupMappings";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = { Open: "#f72585", Pending: "#4361ee", Resolved: "#06d6a0", Closed: "#6c757d" };
const PRIORITY_COLORS = { Low: "#6c757d", Medium: "#4361ee", High: "#f8961e", Urgent: "#ef476f" };

function Donut({ data, colorMap, size = 160 }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 16, w = 28;
  let cum = 0;
  const arcs = data.map((d) => {
    const a = (d.count / total) * 360;
    const s = cum;
    cum += a;
    return { ...d, startAngle: s, angle: a };
  });
  function polar(angle) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function describe(start, angle) {
    if (angle >= 360) return "";
    const p1 = polar(start), p2 = polar(start + angle);
    const large = angle > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  }
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        {arcs.map((d, i) => (
          <path key={i} d={describe(d.startAngle, d.angle)} fill="none" stroke={colorMap[d.label] || colorMap[d.status] || "#888"} strokeWidth={w} strokeLinecap="round" />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1a1a2e">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#888">total</text>
      </svg>
    </div>
  );
}

function Sparkline({ data, color = "#4361ee", height = 60 }) {
  if (!data || data.length < 2) return null;
  const w = Math.max(data.length * 20, 200);
  const max = Math.max(...data.map((d) => d.count), 1);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${height - (d.count / max) * (height - 8) - 4}`).join(" ");
  return (
    <svg width={w} height={height} className="w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d, i) => (
        <text key={i} x={(i === 0 ? 0 : i === 1 ? w - 30 : w / 2 - 10)} y={height - 2} fontSize="9" fill="#888">
          {d.date ? d.date.slice(5) : d.label}
        </text>
      ))}
    </svg>
  );
}

function MiniBar({ data, color = "#4361ee" }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 w-20 truncate text-xs">{d.group || d.priority || d.label}</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.count / max) * 100}%`, background: color }} />
          </div>
          <span className="font-semibold text-xs text-gray-600 w-6 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export default function Dashboard() {
  const { agent } = useAuth();
  const { resolve } = useGroupMappings();
  const [stats, setStats] = useState(null);
  const [groupStats, setGroupStats] = useState([]);
  const [priorityStats, setPriorityStats] = useState([]);
  const [statusStats, setStatusStats] = useState([]);
  const [ticketsPerDay, setTicketsPerDay] = useState([]);
  const [topRequesters, setTopRequesters] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.json()),
      fetch("/api/dashboard/groups").then((r) => r.json()),
      fetch("/api/dashboard/priorities").then((r) => r.json()),
      fetch("/api/dashboard/statuses").then((r) => r.json()),
      fetch("/api/dashboard/tickets-per-day").then((r) => r.json()),
      fetch("/api/dashboard/top-requesters").then((r) => r.json()),
    ])
      .then(([s, g, p, st, tpd, tr]) => {
        setStats(s);
        setGroupStats(g.map((x) => ({ ...x, group: resolve(x.group) })));
        setPriorityStats(p);
        setStatusStats(st);
        setTicketsPerDay(tpd);
        setTopRequesters(tr);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-danger font-medium text-lg mb-2">Gagal memuat dashboard</p>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Profile */}
      {agent && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 card-lift animate-fadeIn">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
            {agent.name ? agent.name.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-navy">{agent.name || "Agent"}</h2>
            <p className="text-xs text-gray-400">{agent.email}</p>
          </div>
          <div className="text-right text-[11px] text-gray-400">
            {agent.lastLogin && <p>Terakhir login: {new Date(agent.lastLogin).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">Overview ticket & aktivitas helpdesk</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400">
            <Link to="/tickets" className="hover:text-primary">Tickets</Link>
            <Link to="/analytics/clustering" className="hover:text-primary">Clustering</Link>
            <Link to="/analytics/escalations" className="hover:text-primary">Escalations</Link>
          </div>
          <button onClick={async () => { setSyncing(true); await fetch("/api/tickets/sync", { method: "POST" }).catch(() => {}); setSyncing(false); }}
            disabled={syncing}
             className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50 transition-all duration-200 btn-press">
            {syncing ? "Sync..." : "Sync Now"}
          </button>
        </div>
      </div>

      {!stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-1">
          <StatCard icon="🎫" label="Total Tickets" value={stats.totalTickets} color="#4361ee" />
          <StatCard icon="📂" label="Open" value={stats.openTickets} color="#f72585" />
          <StatCard icon="✅" label="Closed" value={stats.closedTickets} color="#06d6a0" />
          <StatCard icon="🔴" label="High Priority" value={stats.highPriorityTickets} color="#ef476f" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-2">
        <Card title="Status" accent="#06d6a0">
          <div className="flex items-start gap-4">
            <Donut data={statusStats} colorMap={STATUS_COLORS} size={140} />
            <div className="space-y-1.5 pt-2">
              {statusStats.map((s) => (
                <div key={s.status} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] || "#888" }} />
                  <span className="text-gray-500 w-14">{s.status}</span>
                  <span className="font-semibold text-gray-700">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Prioritas" accent="#f8961e">
          <div className="flex items-start gap-4">
            <Donut data={priorityStats} colorMap={PRIORITY_COLORS} size={140} />
            <div className="space-y-1.5 pt-2">
              {priorityStats.map((p) => (
                <div key={p.priority} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY_COLORS[p.priority] || "#888" }} />
                  <span className="text-gray-500 w-14">{p.priority}</span>
                  <span className="font-semibold text-gray-700">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Per Grup" accent="#4361ee">
          {groupStats.length > 0 ? <MiniBar data={groupStats} color="#4361ee" /> : <p className="text-gray-400 text-sm py-4 text-center">No data</p>}
        </Card>

        <Card title="Tiket per Hari (30 hari)" accent="#e85d04">
          {ticketsPerDay.length > 1 ? <Sparkline data={ticketsPerDay} color="#e85d04" /> : <p className="text-gray-400 text-sm py-4 text-center">No data</p>}
        </Card>

        <Card title="Top Requester" accent="#4361ee">
          {topRequesters.filter((r) => r.email).length > 0 ? (
            <div className="space-y-1.5">
              {topRequesters.filter((r) => r.email).slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-600 truncate flex-1">{r.email}</span>
                  <span className="text-xs font-semibold text-primary ml-2">{r.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-400 text-sm py-4 text-center">No data</p>}
        </Card>

        <Card title="Quick Actions" accent="#4cc9f0">
          <div className="space-y-2">
            <Link to="/tickets" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-lg">📋</span>
              <div><p className="text-sm font-medium text-gray-700">Lihat Semua Tiket</p><p className="text-xs text-gray-400">{stats?.totalTickets || 0} tiket</p></div>
            </Link>
            <Link to="/analytics/clustering" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-lg">📊</span>
              <div><p className="text-sm font-medium text-gray-700">Analisis Clustering</p><p className="text-xs text-gray-400">Topik & distribusi tiket</p></div>
            </Link>
            <Link to="/kb" className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-lg">📚</span>
              <div><p className="text-sm font-medium text-gray-700">Knowledge Base</p><p className="text-xs text-gray-400">Solusi & referensi</p></div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 card-lift">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: `${color}15` }}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}
