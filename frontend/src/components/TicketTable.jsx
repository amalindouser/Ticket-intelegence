import { Link } from "react-router-dom";

const STATUS_STYLE = {
  2: { label: "Open", bg: "#f7258520", color: "#f72585" },
  3: { label: "Pending", bg: "#4361ee20", color: "#4361ee" },
  4: { label: "Resolved", bg: "#06d6a020", color: "#06d6a0" },
  5: { label: "Closed", bg: "#6c757d20", color: "#6c757d" },
};

const PRIORITY_STYLE = {
  1: { label: "Low", bg: "#6c757d15", color: "#6c757d" },
  2: { label: "Medium", bg: "#4361ee15", color: "#4361ee" },
  3: { label: "High", bg: "#e85d0415", color: "#e85d04" },
  4: { label: "Urgent", bg: "#ef476f15", color: "#ef476f" },
};

function Badge({ style, label }) {
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {label}
    </span>
  );
}

export default function TicketTable({ tickets, showGroup = true, resolveGroup }) {
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Requester</th>
            {showGroup && <th>Group</th>}
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr><td colSpan={showGroup ? 7 : 6} className="text-center text-gray-400 py-8">No tickets found</td></tr>
          ) : tickets.map((t) => (
            <tr key={t.id}>
              <td className="font-mono text-xs">
                <Link to={`/tickets/${t.id}`} className="text-primary font-semibold no-underline hover:underline">
                  #{String(t.freshdeskTicketId)}
                </Link>
              </td>
              <td className="max-w-xs truncate font-medium">
                <Link to={`/tickets/${t.id}`} className="text-gray-700 no-underline hover:text-primary">
                  {t.subject || "(no subject)"}
                </Link>
              </td>
              <td><Badge style={STATUS_STYLE[t.status] || { bg: "#88820", color: "#888" }} label={STATUS_STYLE[t.status]?.label || t.status} /></td>
              <td><Badge style={PRIORITY_STYLE[t.priority] || { bg: "#88820", color: "#888" }} label={PRIORITY_STYLE[t.priority]?.label || t.priority} /></td>
              <td className="text-sm text-gray-500 truncate max-w-[140px]">{t.requesterEmail || "-"}</td>
              {showGroup && <td className="text-sm text-gray-500">{resolveGroup ? resolveGroup(t.assignedGroup) : (t.assignedGroup || "-")}</td>}
              <td className="text-sm text-gray-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
