import { useState, useRef, useEffect } from "react";
import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import TicketDetail from "./pages/TicketDetail";
import TicketTimeline from "./pages/TicketTimeline";
import Analytics from "./pages/Analytics";
import KnowledgeBase from "./pages/KnowledgeBase";
import Groups from "./pages/Groups";
import Evidences from "./pages/Evidences";
import Login from "./pages/Login";
import ChatBot from "./components/ChatBot";
import Footer from "./components/Footer";
import { ChatProvider } from "./context/ChatContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "◈", end: true },
  { to: "/tickets", label: "Tickets", icon: "⊞" },
  { to: "/analytics/clustering", label: "Analytics", icon: "◉" },
  { to: "/kb", label: "KB", icon: "◇" },
  { to: "/evidences", label: "Evidences", icon: "▣" },
  { to: "/groups", label: "Groups", icon: "☰" },
];

function Navbar() {
  const { agent, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setProfileOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-navy/90 backdrop-blur-lg border-b border-white/5 shadow-lg shadow-navy/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
        <span className="text-white font-bold text-sm sm:text-base tracking-tight flex items-center gap-2">
          <span className="w-7 h-7 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-105">TI</span>
          <span className="hidden sm:inline">Ticket Intelligence</span>
        </span>

        <div className="flex items-center gap-1 sm:gap-3">
          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/10 shadow-sm"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="text-[10px] opacity-60">{item.icon}</span>
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-5 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Hamburger mobile */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden flex items-center justify-center w-8 h-8 text-white/70 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Profile */}
          {agent && (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 sm:pl-3 ml-1 sm:ml-2 border-l border-white/10 text-white/70 hover:text-white transition-colors"
              >
                <span className="w-7 h-7 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm transition-transform duration-200 hover:scale-110">
                  {agent.name ? agent.name.charAt(0).toUpperCase() : "?"}
                </span>
                <span className="text-xs font-medium hidden sm:block">{agent.name || agent.email}</span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 animate-fadeIn">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-sm font-semibold text-navy truncate">{agent.name || "Agent"}</p>
                    <p className="text-[11px] text-gray-400 truncate">{agent.email}</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-all duration-200 btn-press flex items-center gap-2 rounded-b-xl"
                  >
                    <span className="text-sm">→</span>
                    Keluar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-navy/95 backdrop-blur-lg animate-slideDown">
          <div className="px-3 pb-3 pt-2 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <span className="text-sm opacity-60 w-5 text-center">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

function ProtectedRoute({ children }) {
  const { agent, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-navy border-t-transparent rounded-full" /></div>;
  if (!agent) return <Navigate to="/login" replace />;
  return children;
}

function AnimatedPages() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fadeIn">
      <Routes location={location}>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
          <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
          <Route path="/tickets/:id/timeline" element={<ProtectedRoute><TicketTimeline /></ProtectedRoute>} />
          <Route path="/analytics" element={<Navigate to="/analytics/clustering" replace />} />
          <Route path="/analytics/:tab" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/kb" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
          <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
          <Route path="/evidences" element={<ProtectedRoute><Evidences /></ProtectedRoute>} />
        </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
    <ChatProvider>
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-1 w-full">
        <AnimatedPages />
      </main>
      <Footer />
      <ChatBot />
    </div>
    </ChatProvider>
    </AuthProvider>
  );
}