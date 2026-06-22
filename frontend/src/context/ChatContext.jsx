import { createContext, useContext, useState } from "react";

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [ticketId, setTicketId] = useState(null);

  return (
    <ChatContext.Provider value={{ ticketId, setTicketId }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
