import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Timeline from "../components/Timeline";
import Card from "../components/Card";
import useGroupMappings from "../hooks/useGroupMappings";

const STATUS = ["", "", "Open", "Pending", "Resolved", "Closed"];
const PRIORITY = ["", "Low", "Medium", "High", "Urgent"];

const STATUS_BADGE = {
  2: { color: "#f72585", bg: "#f7258515" },
  3: { color: "#4361ee", bg: "#4361ee15" },
  4: { color: "#06d6a0", bg: "#06d6a015" },
  5: { color: "#6c757d", bg: "#6c757d15" },
};

export default function TicketDetail() {
  const { resolve } = useGroupMappings();
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [similar, setSimilar] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [relations, setRelations] = useState(null);
  const [aiReply, setAiReply] = useState(null);
  const [aiEscalation, setAiEscalation] = useState(null);
  const [aiLoading, setAiLoading] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/tickets/${id}`).then((r) => r.json()),
      fetch(`/api/tickets/${id}/timeline`).then((r) => r.json()),
      fetch(`/api/tickets/${id}/similar`).then((r) => r.json()),
      fetch(`/api/tickets/${id}/suggestions`).then((r) => r.json()),
      fetch(`/api/relations/${id}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([t, tl, sim, sug, rel]) => {
        setTicket(t);
        setTimeline(tl);
        setSimilar(sim);
        setSuggestions(sug);
        setRelations(rel);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAi = useCallback(async (type) => {
    setAiLoading(type);
    if (type === "reply") setAiReply(null);
    else setAiEscalation(null);
    try {
      const res = await fetch(`/api/tickets/${id}/ai-${type}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (type === "reply") setAiReply(data.reply);
        else setAiEscalation(data.reply);
      } else {
        alert("Gagal menghasilkan AI " + type);
      }
    } catch {
      alert("Gagal terhubung ke AI service");
    } finally {
      setAiLoading(null);
    }
  }, [id]);

  if (loading) return (
    <div className="space-y-4 py-8">
      {[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-20 rounded-2xl" />)}
    </div>
  );
  if (!ticket || ticket.error) return <div className="text-center py-16 text-danger text-sm">Ticket not found.</div>;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Link to="/tickets" className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary font-medium hover:underline">
          &larr; Back to Tickets
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/tickets/${id}/timeline`}
            className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Timeline &amp; History
          </Link>
          <button onClick={() => setTicketId(ticket.id)} className="text-xs bg-navy text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
            Ask AI about this ticket
          </button>
        </div>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-dark">
              #{String(ticket.freshdeskTicketId)} - {ticket.subject}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Created {new Date(ticket.createdAt).toLocaleString()} &middot; Updated {new Date(ticket.updatedAt).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <InfoBox label="Priority" value={PRIORITY[ticket.priority] || ticket.priority} />
        <InfoBox label="Requester" value={ticket.requesterEmail || "-"} />
        <InfoBox label="Group" value={resolve(ticket.assignedGroup)} />
        <InfoBox label="Agent" value={ticket.assignedAgent || "-"} />
        <InfoBox label="Resolution" value={ticket.resolutionPath || "unknown"} badge />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RecipientBox title="To" emails={getEmails(ticket.participants, "to")} color="#4361ee" />
        <RecipientBox title="CC" emails={getEmails(ticket.participants, "cc")} color="#e85d04" />
      </div>

      {ticket.tags && (
        <Card title="Tags">
          <div className="flex gap-1.5 flex-wrap">
            {ticket.tags.split(",").map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "#e8f4f8", color: "#1a6e8a" }}>
                {tag.trim()}
              </span>
            ))}
          </div>
        </Card>
      )}

      {ticket.description && (
        <Card title="Description">
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
        </Card>
      )}

      {ticket.conversations?.length > 0 && (
        <Card title={`Conversations (${ticket.conversations.length})`}>
          <div className="space-y-3">
            {ticket.conversations.map((c) => (
              <div key={c.id} className="p-4 bg-gray-50 rounded-lg border-l-4" style={{ borderLeftColor: "#4361ee" }}>
                <div className="text-xs text-gray-400 mb-1">
                  {c.senderEmail || "Unknown"} &middot; {new Date(c.createdAt).toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.body || "(no body)"}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {ticket.attachments?.length > 0 && (
        <Card title={`Attachments (${ticket.attachments.length})`}>
          <div className="space-y-1.5">
            {ticket.attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <a href={a.attachmentUrl && !a.attachmentUrl.startsWith("javascript:") ? a.attachmentUrl : "#"} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">{a.filename}</a>
                {a.contentType && <span className="text-gray-400 text-xs">({a.contentType})</span>}
                {a.fileSize && <span className="text-gray-300 text-xs">{formatSize(a.fileSize)}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {ticket.escalations?.length > 0 && (
        <Card title={`Escalations (${ticket.escalations.length})`}>
          <div className="space-y-4">
            {ticket.escalations.map((e) => (
              <div key={e.id}>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-warning">{e.teamName}</span>
                    {e.agentName && <span className="text-xs text-gray-400">- {e.agentName}</span>}
                    <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                  {e.notes && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{e.notes}</p>}
                  {e.attachments?.length > 0 && (
                    <div className="mt-2 pl-3 border-l-2 border-orange-300">
                      <p className="text-xs font-semibold text-gray-400 mb-1">Evidence:</p>
                      {e.attachments.map((a) => (
                        <div key={a.id} className="text-sm py-0.5">
                          <a href={a.attachmentUrl && !a.attachmentUrl.startsWith("javascript:") ? a.attachmentUrl : "#"} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{a.filename}</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <EvidenceForm escalationId={e.id} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {timeline && timeline.length > 0 && (
        <Card title="Timeline">
          <Timeline events={timeline} />
        </Card>
      )}

      {relations && (relations.parentTicket || relations.childTickets?.length > 0) && (
        <Card title="Ticket Relations" subtitle={
          relations.resolutionPath === "spawned" ? "Tiket ini memiliki relasi parent/child"
          : "Tiket terkait"
        }>
          <div className="space-y-4">
            {relations.parentTicket && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">Parent Ticket</p>
                <Link to={`/tickets/${relations.parentTicket.id}`}
                  className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  #{String(relations.parentTicket.freshdeskTicketId)} — {relations.parentTicket.subject}
                </Link>
                <div className="flex gap-3 mt-1.5 text-xs text-gray-400 ml-6">
                  <span>{["", "", "Open", "Pending", "Resolved", "Closed"][relations.parentTicket.status] || relations.parentTicket.status}</span>
                  <span>·</span>
                  <span className={relations.parentTicket.resolutionPath === "in_thread" ? "text-green-500" : "text-orange-500"}>
                    {relations.parentTicket.resolutionPath === "in_thread" ? "In Thread" : relations.parentTicket.resolutionPath === "spawned" ? "Spawned" : "-"}
                  </span>
                </div>
              </div>
            )}
            {relations.childTickets?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Child Tickets ({relations.childTickets.length})
                </p>
                <div className="space-y-2">
                  {relations.childTickets.map((c) => (
                    <div key={c.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <Link to={`/tickets/${c.id}`}
                        className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark font-medium">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        #{String(c.freshdeskTicketId)} — {c.subject}
                      </Link>
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400 ml-6">
                        <span>{["", "", "Open", "Pending", "Resolved", "Closed"][c.status] || c.status}</span>
                        <span>·</span>
                        <span className={c.resolutionPath === "in_thread" ? "text-green-500" : "text-orange-500"}>
                          {c.resolutionPath === "in_thread" ? "In Thread" : c.resolutionPath === "spawned" ? "Spawned" : "-"}
                        </span>
                        <span>·</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="AI Assistance" accent="#4361ee">
        <div className="flex gap-3 mb-4">
          <button onClick={() => handleAi("reply")} disabled={aiLoading !== null}
            className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-all shadow-sm">
            {aiLoading === "reply" ? "Generating..." : "Generate Reply"}
          </button>
          <button onClick={() => handleAi("escalation")} disabled={aiLoading !== null}
            className="px-5 py-2.5 bg-warning text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-sm">
            {aiLoading === "escalation" ? "Generating..." : "Generate Eskalasi"}
          </button>
        </div>
        {aiReply && <AiOutputBox title="Reply to Requester" text={aiReply} color="#eef2ff" borderColor="#c7d2fe" />}
        {aiEscalation && <AiOutputBox title="Escalation to Team" text={aiEscalation} color="#fff8f0" borderColor="#ffe0b2" />}
      </Card>

      {suggestions && suggestions.length > 0 && (
        <Card title={`Suggested Solutions (${suggestions.length})`} subtitle="From similar resolved tickets" accent="#06d6a0">
          <div className="space-y-3">
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} suggestion={s} />
            ))}
          </div>
        </Card>
      )}

      {similar && similar.length > 0 && (
        <Card title={`Similar Tickets (${similar.length})`} subtitle="Matching subject, tags, requester, or group">
          <div className="space-y-2">
            {similar.map((t) => (
              <div key={t.id} className="p-4 bg-gray-50 rounded-lg">
                <Link to={`/tickets/${t.id}`} className="font-semibold text-sm text-primary hover:underline">
                  #{String(t.freshdeskTicketId)} - {t.subject}
                </Link>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>{STATUS[t.status] || t.status}</span>
                  <span>&middot;</span>
                  <span>{PRIORITY[t.priority] || t.priority}</span>
                  {t.assignedGroup && <><span>&middot;</span><span>{resolve(t.assignedGroup)}</span></>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || { color: "#888", bg: "#88815" };
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
      {STATUS[status] || status}
    </span>
  );
}

function InfoBox({ label, value, badge }) {
  const pathColor = value === "in_thread" ? "#06d6a0"
    : value === "spawned" ? "#f8961e"
    : value === "unknown" ? "#adb5bd"
    : null;
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      {badge && pathColor ? (
        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${pathColor}18`, color: pathColor }}>
          {value === "in_thread" ? "In Thread" : value === "spawned" ? "Spawned" : value}
        </span>
      ) : (
        <p className="font-semibold text-sm text-gray-700 mt-1 truncate">{value}</p>
      )}
    </div>
  );
}

function RecipientBox({ title, emails, color }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{title}</p>
      {emails.length > 0 ? emails.map((e, i) => <p key={i} className="text-sm text-gray-600 py-0.5">{e}</p>) : <p className="text-sm text-gray-300">-</p>}
    </div>
  );
}

function EvidenceForm({ escalationId }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/escalations/${escalationId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentUrl: url, filename: name || "evidence" }),
      });
      if (res.ok) { setUrl(""); setName(""); setOpen(false); window.location.reload(); }
    } finally { setSaving(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-xs text-gray-400 border border-dashed border-gray-300 rounded px-3 py-1 hover:border-gray-400 transition-colors">
        + Add Evidence
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2 flex-wrap">
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded text-xs w-24 focus:outline-none focus:ring-1 focus:ring-primary/30" />
      <input placeholder="URL evidence..." value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-xs min-w-[160px] focus:outline-none focus:ring-1 focus:ring-primary/30" />
      <button type="submit" disabled={saving || !url} className="px-3 py-1.5 bg-warning text-white rounded text-xs font-medium disabled:opacity-50">
        {saving ? "..." : "Add"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 bg-gray-400 text-white rounded text-xs">
        Cancel
      </button>
    </form>
  );
}

function SuggestionCard({ suggestion }) {
  const [copied, setCopied] = useState(false);
  const handleUse = async () => {
    if (!suggestion.lastReply?.body) return;
    try {
      await navigator.clipboard.writeText(suggestion.lastReply.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Salin solusi ini:", suggestion.lastReply.body);
    }
  };

  return (
    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/tickets/${suggestion.id}`} className="font-semibold text-sm text-green-700 hover:underline">
          #{String(suggestion.freshdeskTicketId)} - {suggestion.subject}
        </Link>
        <button onClick={handleUse}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${copied ? "bg-success" : "bg-green-600 hover:bg-green-700"}`}>
          {copied ? "Copied!" : "Gunakan"}
        </button>
      </div>
      {suggestion.lastReply?.body && (
        <div className="mt-2 text-xs text-gray-600 leading-relaxed max-h-16 overflow-hidden relative">
          <p className="whitespace-pre-wrap">{suggestion.lastReply.body}</p>
          <div className="absolute bottom-0 left-0 right-0 h-6" style={{ background: "linear-gradient(transparent, #f0fdf4)" }} />
        </div>
      )}
    </div>
  );
}

function getEmails(participants, role) {
  if (!participants) return [];
  return participants.filter((p) => p.role === role).map((p) => p.email);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AiOutputBox({ title, text, color, borderColor }) {
  return (
    <div className="rounded-lg p-4 mt-3 border" style={{ background: color, borderColor }}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold text-gray-500">{title}</span>
        <button onClick={async () => { try { await navigator.clipboard.writeText(text); alert("Copied!"); } catch { prompt("Salin teks ini:", text); } }}
          className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          Gunakan
        </button>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}
