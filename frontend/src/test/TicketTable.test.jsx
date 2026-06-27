import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import TicketTable from "../components/TicketTable";

function Wrapper({ children }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe("TicketTable", () => {
  const tickets = [
    {
      id: "abc-123",
      freshdeskTicketId: 1001,
      subject: "Network issue",
      status: 2,
      priority: 3,
      requesterEmail: "user@test.com",
      assignedGroup: "1001",
      createdAt: "2025-01-15T10:00:00Z",
    },
  ];

  it("renders ticket rows", () => {
    render(<TicketTable tickets={tickets} />, { wrapper: Wrapper });
    expect(screen.getByText("#1001")).toBeInTheDocument();
    expect(screen.getByText("Network issue")).toBeInTheDocument();
    expect(screen.getByText("user@test.com")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<TicketTable tickets={[]} />, { wrapper: Wrapper });
    expect(screen.getByText("No tickets found")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<TicketTable tickets={tickets} />, { wrapper: Wrapper });
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<TicketTable tickets={tickets} />, { wrapper: Wrapper });
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("calls resolveGroup function for group column", () => {
    const resolveGroup = vi.fn(() => "IT Support");
    render(<TicketTable tickets={tickets} showGroup resolveGroup={resolveGroup} />, { wrapper: Wrapper });
    expect(screen.getByText("IT Support")).toBeInTheDocument();
    expect(resolveGroup).toHaveBeenCalledWith("1001");
  });

  it("renders group column hidden when showGroup is false", () => {
    render(<TicketTable tickets={tickets} showGroup={false} />, { wrapper: Wrapper });
    expect(screen.queryByText("IT Support")).toBeNull();
  });
});
