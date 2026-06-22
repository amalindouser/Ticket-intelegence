export default function StatCard({ label, value, color = "#4361ee" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5" style={{ borderLeft: `4px solid ${color}` }}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}
