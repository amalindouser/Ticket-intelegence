import { useState, useRef, useEffect } from "react";
import { useChat } from "../context/ChatContext";

function FormattedText({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gray-400">•</span>
              <span>{parseBold(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+\.)\s(.*)/);
          if (num) {
            return (
              <div key={i} className="flex gap-1">
                <span className="text-gray-400 min-w-[1.5rem]">{num[1]}</span>
                <span>{parseBold(num[2])}</span>
              </div>
            );
          }
        }
        return <div key={i}>{parseBold(line)}</div>;
      })}
    </div>
  );
}

function parseBold(text) {
  return text.split(/(\*\*.*?\*\*)/).map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function ChatBot() {
  const { ticketId, setTicketId } = useChat();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Halo! Saya asisten helpdesk. Saya bisa bantu:\n- Cek To/CC tiket\n- Ringkasan tiket\n- Rekomendasi solusi\n- Ngobrol santai\n\nKlik **Ask AI about this ticket** di halaman tiket biar saya paham konteksnya." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message: userMsg, history }),
      });
      if (!res.ok) {
        const fallback = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, message: userMsg, history }),
        });
        if (fallback.ok) {
          const data = await fallback.json();
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: data.reply };
            return updated;
          });
        } else {
          throw new Error("Gagal");
        }
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "token") {
              accumulated += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            } else if (data.type === "reply") {
              accumulated = data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            } else if (data.type === "error") {
              throw new Error(data.content);
            }
          } catch (e) { /* skip parse errors */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = { role: "assistant", content: "Maaf, lagi error. Coba lagi nanti." };
        } else {
          updated.push({ role: "assistant", content: "Maaf, lagi error. Coba lagi nanti." });
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-20 sm:right-6 w-full sm:w-96 h-[60vh] sm:h-[500px] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden animate-fadeInScale">
          <div className="flex items-center justify-between px-4 py-3 bg-navy text-white">
            <span className="font-semibold text-sm">AI Assistant {ticketId && `- #${ticketId.slice(0, 8)}`}</span>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fadeIn`} style={{animationDelay: `${i * 0.03}s`}}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-navy text-white rounded-br-md"
                    : "bg-white border border-gray-200 text-gray-700 rounded-bl-md shadow-sm"
                }`}>
                  <FormattedText text={m.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2 text-sm text-gray-400 shadow-sm animate-fadeIn">
                  <span className="animate-pulseSoft">Mengetik...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="border-t border-gray-200 p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanya apa aja..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="px-4 py-2 bg-navy text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-all duration-200 btn-press">
              Kirim
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 bg-navy text-white rounded-full shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-200 btn-press z-50 flex items-center justify-center text-xl"
        title="AI Chat"
      >
        {open ? "\u2715" : "\uD83E\uDD16"}
      </button>
    </>
  );
}
