export default function BarChart({ data, labelKey, valueKey, color = "#4361ee", height = 200, compact }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const gap = compact || data.length > 10 ? "gap-0.5" : "gap-3";

  return (
    <div className="overflow-x-auto">
      <div className={`flex items-end ${gap}`} style={{ height, minWidth: `${Math.max(data.length * 32, 200)}px` }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-[16px]">
            <span className="text-[10px] font-semibold text-gray-500 mb-0.5">{d[valueKey]}</span>
            <div
              className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80"
              style={{
                height: `${(d[valueKey] / max) * 100}%`,
                background: `linear-gradient(to top, ${color}, ${color}88)`,
                minHeight: "4px",
              }}
            />
            <span className="text-[9px] text-gray-400 mt-0.5 truncate w-full text-center" title={d[labelKey]}>
              {compact ? labelCompact(d[labelKey]) : d[labelKey]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelCompact(val) {
  if (val && val.length === 10 && val[4] === "-") {
    const [, m, d] = val.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  }
  return val?.length > 6 ? val.slice(0, 6) : val;
}
