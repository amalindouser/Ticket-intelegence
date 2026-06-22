import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import TicketTable from "../components/TicketTable";
import useGroupMappings from "../hooks/useGroupMappings";

export default function Tickets() {
  const { resolve } = useGroupMappings();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const perPage = 20;

  useEffect(() => {
    setLoading(true);
    const url = search
      ? `/api/search?q=${encodeURIComponent(search)}&page=${page}&perPage=${perPage}`
      : `/api/tickets?page=${page}&perPage=${perPage}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setTickets(data.tickets || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(query);
  };

  const clearSearch = () => {
    setQuery("");
    setSearch("");
    setPage(1);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-dark">Tickets</h1>
        <span className="text-xs sm:text-sm text-gray-400">{total} total</span>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search by ID, subject, or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 btn-press">
            Search
          </button>
          {search && (
            <button type="button" onClick={clearSearch} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">
              Clear
            </button>
          )}
        </form>
      </Card>

      <Card>
          {loading ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-navy border-t-transparent rounded-full" />
            <span className="text-gray-400 text-sm">Memuat tiket...</span>
          </div>
        ) : (
          <>
            <TicketTable tickets={tickets} resolveGroup={resolve} />

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
