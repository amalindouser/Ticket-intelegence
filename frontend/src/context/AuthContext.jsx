import { createContext, useContext, useState, useEffect } from "react";

const origFetch = typeof window !== "undefined" ? window.fetch : null;
if (origFetch) {
  window.fetch = function (input, init = {}) {
    const token = localStorage.getItem("token");
    if (token) {
      init.headers = init.headers || {};
      if (!init.headers.Authorization && !init.headers.authorization) {
        init.headers.Authorization = `Bearer ${token}`;
      }
    }
    return origFetch.call(this, input, init);
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data?.agent) setAgent(data.agent); else localStorage.removeItem("token"); })
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function login(token, agentData) {
    localStorage.setItem("token", token);
    setAgent(agentData);
  }

  function logout() {
    localStorage.removeItem("token");
    setAgent(null);
  }

  return (
    <AuthContext.Provider value={{ agent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}