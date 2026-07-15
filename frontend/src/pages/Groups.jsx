import { useState, useEffect } from "react";

export default function Groups() {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [escalationEmail, setEscalationEmail] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/groups/mappings");
      setMappings(await res.json());
    } catch {}
    setLoading(false);
  }

  async function syncFromFd() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/groups/sync-from-freshdesk", { method: "POST" });
      const data = await res.json();
      setSyncMsg(`Matched ${data.matched} group(s), ${data.unmatched} unmatched (${data.totalFdGroups} groups from Freshdesk)`);
      await load();
    } catch (err) {
      setSyncMsg("Error: " + err.message);
    }
    setSyncing(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!groupId.trim() || !groupName.trim()) {
      setError("Group ID and Name are required"); return;
    }
    try {
      await fetch("/api/groups/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: groupId.trim(), groupName: groupName.trim(), escalationEmail: escalationEmail.trim() || null }),
      });
      setGroupId(""); setGroupName(""); setEscalationEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(m) {
    setEditing(m.id);
    setGroupId(m.groupId);
    setGroupName(m.groupName);
    setEscalationEmail(m.escalationEmail || "");
  }

  function cancelEdit() {
    setEditing(null);
    setGroupId(""); setGroupName(""); setEscalationEmail("");
  }

  async function handleDelete(id) {
    await fetch(`/api/groups/mappings/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Group Mappings</h1>
          <p className="text-sm text-gray-500">
            Map Freshdesk group IDs to readable names and escalation contact emails. The escalation email will appear in chatbot recommendations.
          </p>
        </div>
        <button onClick={syncFromFd} disabled={syncing}
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:opacity-90 transition-all duration-200 btn-press disabled:opacity-50 whitespace-nowrap">
          {syncing ? "Syncing..." : "Sync from Freshdesk"}
        </button>
      </div>
      {syncMsg && <p className="text-sm text-green-600">{syncMsg}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end flex-wrap">
        <div className="w-full sm:w-44">
          <label className="block text-xs font-medium text-gray-600 mb-1">Group ID</label>
          <input value={groupId} onChange={(e) => setGroupId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" placeholder="2043001158859" />
        </div>
        <div className="w-full sm:w-44">
          <label className="block text-xs font-medium text-gray-600 mb-1">Group Name</label>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" placeholder="DCSA" />
        </div>
        <div className="w-full sm:w-56">
          <label className="block text-xs font-medium text-gray-600 mb-1">Escalation Email</label>
          <input value={escalationEmail} onChange={(e) => setEscalationEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" placeholder="dcsa-team@ainosi.com" />
        </div>
        <div className="flex gap-2">
          <button className="bg-navy text-white px-4 py-2 rounded text-sm hover:opacity-90 transition-all duration-200 btn-press">
            {editing ? "Update" : "Add"}
          </button>
          {editing && (
            <button type="button" onClick={cancelEdit}
              className="bg-gray-400 text-white px-4 py-2 rounded text-sm hover:opacity-90">
              Cancel
            </button>
          )}
        </div>
      </form>
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : mappings.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No mappings yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium">Group ID</th>
                <th className="px-4 py-3 font-medium">Group Name</th>
                <th className="px-4 py-3 font-medium">FD Group ID</th>
                <th className="px-4 py-3 font-medium">Escalation Email</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{m.groupId}</td>
                  <td className="px-4 py-3">{m.groupName}</td>
                  <td className="px-4 py-3 text-xs font-mono">{m.freshdeskGroupId || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-3 text-xs">{m.escalationEmail || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => startEdit(m)} className="text-primary hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
