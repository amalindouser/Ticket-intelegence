import { useState, useEffect } from "react";
import BarChart from "../components/BarChart";
import Card from "../components/Card";

export default function EscalationInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);

  useEffect(() => {
    fetch("/api/escalations/insights")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading escalation insights...</div>;
  if (!data) return <div className="text-center py-16 text-danger text-sm">Failed to load insights.</div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-2xl font-bold text-dark">Escalation Insights</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Top Escalated Groups" accent="#e85d04">
          {data.groups.length > 0 ? <BarChart data={data.groups} labelKey="group" valueKey="count" color="#e85d04" /> : <Empty />}
        </Card>
        <Card title="Frequent Agents" accent="#f72585">
          {data.agents.length > 0 ? <ListTable data={data.agents} labelKey="agent" valueKey="count" suffix="x" /> : <Empty />}
        </Card>
        <Card title="Average Duration per Group" accent="#4361ee">
          {data.avgDuration.length > 0 ? <ListTable data={data.avgDuration} labelKey="group" valueKey="avgMinutes" format={formatDuration} /> : <Empty />}
        </Card>
      </div>

      <Card title="Keywords & Escalation Paths" subtitle="Click a keyword to see its escalation history">
        <div className="flex gap-2 flex-wrap mb-4">
          {data.keywords.slice(0, 30).map((k, i) => (
            <button key={i} onClick={() => setSelectedKeyword(selectedKeyword === k.keyword ? null : k.keyword)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedKeyword === k.keyword ? "bg-warning text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {k.keyword} <span className="opacity-60">({k.count})</span>
            </button>
          ))}
        </div>

        {(selectedKeyword ? data.keywords.filter((k) => k.keyword === selectedKeyword) : []).map((k, i) => (
          <div key={i} className="p-5 bg-orange-50 rounded-xl border border-orange-200">
            <h4 className="font-bold text-warning mb-1">{k.keyword}</h4>
            <p className="text-sm text-gray-500 mb-3">Appears in {k.count} escalated tickets</p>
            {k.groups.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5">Escalation Path:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {k.groups.map((g, gi) => (
                    <span key={gi} className="px-2.5 py-1 bg-primary text-white rounded text-xs font-medium">{g}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {!selectedKeyword && data.keywords.length > 0 && (
          <p className="text-center text-gray-400 text-sm py-6">Click a keyword above to see escalation path details</p>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="text-gray-400 text-sm py-4">No data</p>;
}

function ListTable({ data, labelKey, valueKey, suffix, format }) {
  if (!data || data.length === 0) return <Empty />;
  return (
    <div className="space-y-0">
      {data.map((d, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
          <span className="text-gray-600 truncate flex-1">{d[labelKey]}</span>
          <strong className="text-dark ml-3">{format ? format(d[valueKey]) : `${d[valueKey]}${suffix || ""}`}</strong>
        </div>
      ))}
    </div>
  );
}

function formatDuration(minutes) {
  if (!minutes || minutes < 0) return "-";
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs}j ${mins}m`;
  return `${mins} menit`;
}
