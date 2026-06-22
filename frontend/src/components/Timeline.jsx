const EVENT_META = {
  created: { label: "Created", color: "#4361ee", icon: "●" },
  status_changed: { label: "Status Changed", color: "#f72585", icon: "◆" },
  assigned: { label: "Assigned to Group", color: "#e85d04", icon: "▶" },
  agent_assigned: { label: "Agent Assigned", color: "#06d6a0", icon: "◉" },
};

export default function Timeline({ events }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-200" />
      {events.map((ev, i) => {
        const meta = EVENT_META[ev.type] || { label: ev.type, color: "#888", icon: "○" };
        return (
          <div key={i} className="relative pb-5 last:pb-0 animate-fadeIn" style={{animationDelay: `${i * 0.04}s`}}>
            <div
              className="absolute -left-[18px] top-0.5 w-[10px] h-[10px] rounded-full border-2 border-white shadow-sm"
              style={{ background: meta.color }}
            />
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 card-lift">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[11px] text-gray-400">{new Date(ev.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">
                {ev.type === "status_changed" && <>Changed from <strong>{ev.from}</strong> to <strong>{ev.to}</strong></>}
                {ev.type === "assigned" && <>Assigned to <strong>{ev.groupName || ev.group}</strong></>}
                {ev.type === "agent_assigned" && <>Assigned to <strong>{ev.agent}</strong></>}
                {ev.type === "created" && <>Ticket was created</>}
                {!["created", "status_changed", "assigned", "agent_assigned"].includes(ev.type) && (
                  <>{ev.from} → {ev.to}</>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
