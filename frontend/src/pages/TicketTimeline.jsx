import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Card from "../components/Card";

const TOPIC_COLORS = ["#4361ee", "#f72585", "#4cc9f0", "#f8961e", "#43aa8b", "#ff6b6b", "#6c63ff", "#ffa94d"];

function formatMinutes(m) {
  if (m == null) return "-";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

export default function TicketTimeline() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [histories, setHistories] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [relations, setRelations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/tickets/${id}`).then((r) => r.json()),
      fetch(`/api/tickets/${id}/histories`).then((r) => r.json()).catch(() => []),
      fetch(`/api/tickets/${id}/conversations`).then((r) => r.json()).catch(() => []),
      fetch(`/api/relations/${id}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([t, h, c, rel]) => {
        setTicket(t);
        setHistories(Array.isArray(h) ? h : []);
        setConversations(Array.isArray(c) ? c : []);
        setRelations(rel);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSync = async (type) => {
    setSyncing(type);
    try {
      const res = await fetch(`/api/tickets/sync-${type}/${id}`, { method: "POST" });
      if (res.ok) {
        if (type === "histories") {
          const h = await fetch(`/api/tickets/${id}/histories`).then((r) => r.json()).catch(() => []);
          setHistories(Array.isArray(h) ? h : []);
        } else {
          const c = await fetch(`/api/tickets/${id}/conversations`).then((r) => r.json()).catch(() => []);
          setConversations(Array.isArray(c) ? c : []);
        }
      }
    } catch {} finally {
      setSyncing(null);
    }
  };

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading timeline...</div>;
  if (!ticket) return <div className="text-center py-16 text-danger text-sm">Ticket not found.</div>;

  const totalResponseTime = conversations
    .filter((c) => c.responseTimeMinutes != null)
    .reduce((s, c) => s + c.responseTimeMinutes, 0);
  const avgResponseTime = conversations.filter((c) => c.responseTimeMinutes != null).length > 0
    ? Math.round(totalResponseTime / conversations.filter((c) => c.responseTimeMinutes != null).length)
    : null;

  const timeline = [
    { type: "created", timestamp: ticket.createdAt, label: "Ticket Created", detail: "Ticket dibuat oleh requester" },
    ...(ticket.description
      ? [{
          type: "customer_reply",
          timestamp: ticket.createdAt,
          label: "Initial Message",
          actor: ticket.requesterEmail || "Requester",
          body: ticket.description,
          isAgent: false,
        }]
      : []
    ),
    ...histories.map((h) => ({
      type: h.changedField,
      timestamp: h.createdAt,
      label: h.changedField === "assigned_group" ? "Group Changed"
        : h.changedField === "status" ? "Status Changed"
        : h.changedField === "priority" ? "Priority Changed"
        : h.changedField === "assigned_agent" ? "Agent Assigned"
        : h.changedField === "forward" ? "Forwarded"
        : h.changedField === "reply" ? "Reply"
        : h.changedField === "note" ? "Note Added"
        : h.changedField,
      actor: h.actorName,
      oldValue: h.oldValue,
      newValue: h.newValue,
      detail: h.changedField === "assigned_group"
        ? `Group: ${h.oldValue || "none"} → ${h.newValue}`
        : h.changedField === "status"
        ? `Status: ${h.oldValue || "unknown"} → ${h.newValue}`
        : h.changedField === "priority"
        ? `Priority: ${h.oldValue || "unknown"} → ${h.newValue}`
        : h.changedField === "assigned_agent"
        ? `Agent: ${h.oldValue || "none"} → ${h.newValue}`
        : h.newValue,
    })),
    ...conversations.map((c) => ({
      type: c.isAgent ? "agent_reply" : "customer_reply",
      timestamp: c.createdAt,
      label: c.isAgent ? "Agent Reply" : "Customer Reply",
      actor: c.actorName || c.fromEmail,
      body: c.bodyText || c.body,
      responseTime: c.responseTimeMinutes,
      isAgent: c.isAgent,
    })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-navy to-blue-800 rounded-xl p-5 text-white shadow-md">
        <div className="flex items-center justify-between mb-3">
          <Link to={`/tickets/${id}`} className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Ticket
          </Link>
          <div className="flex gap-2">
            <button onClick={() => handleSync("histories")} disabled={syncing !== null}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-40 backdrop-blur-sm">
              {syncing === "histories" ? "Syncing..." : "Sync Histories"}
            </button>
            <button onClick={() => handleSync("conversations")} disabled={syncing !== null}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-40 backdrop-blur-sm">
              {syncing === "conversations" ? "Syncing..." : "Sync Conversations"}
            </button>
          </div>
        </div>

        <h1 className="text-lg font-bold">
          #{String(ticket.freshdeskTicketId)} &mdash; {ticket.subject}
        </h1>
        <p className="text-xs text-white/60 mt-1">
          Created {new Date(ticket.createdAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox label="Total Duration" value={formatMinutes(avgResponseTime ? avgResponseTime * conversations.length : 0)} color="#4361ee" />
        <StatBox label="Avg Response" value={avgResponseTime ? formatMinutes(avgResponseTime) : "-"} color="#f72585" />
        <StatBox label="Group Moves" value={histories.filter((h) => h.changedField === "assigned_group").length} color="#f8961e" />
        <StatBox label="Conversations" value={conversations.length} color="#06d6a0" />
        <StatBox label="Resolution"
          value={ticket.resolutionPath === "in_thread" ? "In Thread"
            : ticket.resolutionPath === "spawned" ? "Spawned"
            : "-"}
          color={ticket.resolutionPath === "in_thread" ? "#06d6a0"
            : ticket.resolutionPath === "spawned" ? "#f8961e"
            : "#adb5bd"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger-2">
        <div className="space-y-4">
          <Card title="Timeline Perjalanan Tiket" subtitle={`${timeline.length} events`}>
            <div className="relative pl-6">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gray-200" />
              {timeline.map((ev, i) => (
                <TimelineEvent key={i} event={ev} />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {relations && (relations.parentTicket || relations.childTickets?.length > 0) && (
            <Card title="Ticket Relations" subtitle={
              relations.resolutionPath === "spawned" ? "Tiket ini memiliki relasi parent/child" : ""
            } accent={
              relations.resolutionPath === "spawned" ? "#f8961e"
              : relations.resolutionPath === "in_thread" ? "#06d6a0"
              : undefined
            }>
              <div className="space-y-3">
                {relations.parentTicket && (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1">Parent</p>
                    <Link to={`/tickets/${relations.parentTicket.id}/timeline`}
                      className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 font-medium">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      #{String(relations.parentTicket.freshdeskTicketId)}
                    </Link>
                    <p className="text-xs text-gray-500 ml-5 truncate">{relations.parentTicket.subject}</p>
                  </div>
                )}
                {relations.childTickets?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                      Children ({relations.childTickets.length})
                    </p>
                    <div className="space-y-1.5">
                      {relations.childTickets.map((c) => (
                        <Link key={c.id} to={`/tickets/${c.id}/timeline`}
                          className="block bg-white rounded-lg px-3 py-2 border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            #{String(c.freshdeskTicketId)}
                          </div>
                          <p className="text-xs text-gray-500 ml-5 truncate">{c.subject}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="Conversation Thread" subtitle={`${conversations.length} messages`}>
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No conversation data</div>
            ) : (
              <div className="space-y-3">
                {conversations.map((c) => (
                  <div key={c.id}
                    className={`p-4 rounded-xl border transition-shadow hover:shadow-sm ${
                      c.isAgent ? "bg-blue-50/50 border-blue-200 ml-6" : "bg-white border-gray-200 mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: c.isAgent ? "#4361ee" : "#e85d04" }}>
                        {c.actorName || c.fromEmail || "Unknown"}
                        {c.isAgent && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">agent</span>}
                      </span>
                      <div className="flex items-center gap-2">
                        {c.responseTimeMinutes != null && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatMinutes(c.responseTimeMinutes)}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className={`text-sm text-gray-700 whitespace-pre-wrap leading-relaxed ${c.isAgent ? "" : "bg-gray-50 -mx-4 -mb-4 px-4 py-3 rounded-b-xl border-t border-gray-100"}`}>
                      {c.bodyText || c.body || <span className="italic text-gray-300">(no content)</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({ event }) {
  const colorMap = {
    created: "#4361ee", status_changed: "#f72585", assigned_group: "#e85d04",
    assigned_agent: "#06d6a0", priority: "#f8961e", forward: "#6c63ff",
    reply: "#4cc9f0", note: "#ffa94d", agent_reply: "#4361ee", customer_reply: "#e85d04",
  };
  const iconMap = {
    created: "●", status_changed: "◆", assigned_group: "▶", assigned_agent: "◉",
    priority: "▲", forward: "⇢", reply: "◀", note: "📝", agent_reply: "💬", customer_reply: "💬",
  };
  const color = colorMap[event.type] || "#888";
  const icon = iconMap[event.type] || "○";

  return (
    <div className="relative pb-4 last:pb-0 group">
      <div className="absolute -left-[18px] top-1 w-[10px] h-[10px] rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-125" style={{ background: color }} />
      <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 transition-shadow group-hover:shadow-sm">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color }}>
            <span>{icon}</span> {event.label}
          </span>
          <span className="text-[11px] text-gray-400">{new Date(event.timestamp).toLocaleString()}</span>
          {event.actor && <span className="text-[11px] text-gray-400">by {event.actor}</span>}
          {event.responseTime != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {event.responseTime}m
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
          {event.body || event.detail || event.label}
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="font-bold text-lg mt-1" style={{ color }}>{value}</p>
    </div>
  );
}
