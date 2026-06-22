import { useState, useEffect } from "react";

const STAT_CARDS = [
  { key: "groups", label: "Top Grup Dieskalasi", icon: "↑", gradient: "from-orange-500 to-red-500" },
  { key: "agents", label: "Agent Teraktif", icon: "👤", gradient: "from-pink-500 to-rose-500" },
  { key: "avgDuration", label: "Rata-rata Durasi per Grup", icon: "⏱", gradient: "from-blue-500 to-indigo-500" },
];

export default function EscalationsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);

  useEffect(() => {
    fetch("/api/escalations/insights")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-navy border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <div className="text-center py-12 text-red-400">Gagal memuat data eskalasi.</div>;

  const renderList = (items, key) => {
    if (!items?.length) return <p className="text-xs text-gray-400 py-6 text-center italic">Belum ada data</p>;
    return (
      <div className="space-y-1.5">
        {items.slice(0, 10).map((item, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/50 transition-colors">
            <span className="text-xs text-gray-600 truncate flex-1">{item.group || item.agent}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, (item.count || item.avgMinutes || 0) / (items[0]?.count || 1) * 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-white/90 w-12 text-right">
                {key === "avgDuration" ? formatDuration(item.avgMinutes) : `${item.count}x`}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-2">
        {STAT_CARDS.map((card) => {
          const items = data[card.key] || [];
          const maxVal = items.length > 0 ? Math.max(...items.map(i => i.count || i.avgMinutes || 1)) : 1;
          return (
            <div key={card.key} className={`bg-gradient-to-br ${card.gradient} rounded-2xl shadow-sm p-5 text-white`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg opacity-80">{card.icon}</span>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{card.label}</h3>
              </div>
              {items.length > 0 ? (
                <div className="space-y-1.5">
                  {items.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-xs truncate flex-1 opacity-90">{item.group || item.agent}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white/60 rounded-full" style={{ width: `${((item.count || item.avgMinutes || 0) / maxVal) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold w-10 text-right">
                          {card.key === "avgDuration" ? formatDuration(item.avgMinutes) : `${item.count}x`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/60 italic py-3 text-center">Belum ada data</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Keywords & Escalation Paths */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-navy">Keywords &amp; Jalur Eskalasi</h2>
          <p className="text-xs text-gray-400 mt-1">Klik keyword untuk lihat jalur eskalasi</p>
        </div>

        {data.keywords?.length > 0 ? (
          <>
            <div className="flex gap-2 flex-wrap mb-5">
              {data.keywords.slice(0, 40).map((k, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedKeyword(selectedKeyword === k.keyword ? null : k.keyword)}
                  className={`group relative px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                    selectedKeyword === k.keyword
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-200 scale-105"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:shadow-sm border border-gray-100"
                  }`}
                >
                  {k.keyword}
                  <span className={`ml-1.5 text-[10px] ${selectedKeyword === k.keyword ? "text-white/70" : "text-gray-400"}`}>
                    {k.count}
                  </span>
                </button>
              ))}
            </div>

            {selectedKeyword && (
              <div className="animate-fadeIn rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5">
                {data.keywords.filter((k) => k.keyword === selectedKeyword).map((k, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <h4 className="font-bold text-sm text-orange-700">{k.keyword}</h4>
                      <span className="text-xs text-orange-400 ml-auto">Muncul di {k.count} tiket yang dieskalasi</span>
                    </div>
                    {k.groups?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Jalur Eskalasi</p>
                        <div className="flex flex-wrap gap-2">
                          {k.groups.map((g, gi) => (
                            <span key={gi} className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-gray-700 shadow-sm border border-gray-100">
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!selectedKeyword && (
              <p className="text-center text-gray-400 text-xs py-6">Klik salah satu keyword di atas</p>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-400 italic text-sm">Belum ada data keywords</div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

function formatDuration(minutes) {
  if (!minutes || minutes < 0) return "-";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs}j ${mins}m`;
  return `${mins}m`;
}