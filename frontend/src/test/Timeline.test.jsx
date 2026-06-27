import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Timeline from "../components/Timeline";

describe("Timeline", () => {
  const events = [
    { type: "created", timestamp: "2025-01-15T10:00:00Z" },
    { type: "status_changed", timestamp: "2025-01-15T11:00:00Z", from: "Open", to: "Pending" },
    { type: "assigned", timestamp: "2025-01-15T12:00:00Z", groupName: "IT Support" },
    { type: "agent_assigned", timestamp: "2025-01-15T13:00:00Z", agent: "John Doe" },
  ];

  it("renders all events", () => {
    render(<Timeline events={events} />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Status Changed")).toBeInTheDocument();
    expect(screen.getByText("Assigned to Group")).toBeInTheDocument();
    expect(screen.getByText("Agent Assigned")).toBeInTheDocument();
  });

  it("renders event descriptions", () => {
    render(<Timeline events={events} />);
    expect(screen.getByText(/Changed from/)).toBeInTheDocument();
    const assignedElements = screen.getAllByText(/Assigned to/);
    expect(assignedElements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders empty state as container", () => {
    const { container } = render(<Timeline events={[]} />);
    expect(container.querySelector(".relative")).toBeTruthy();
    expect(container.querySelectorAll(".pb-5").length).toBe(0);
  });

  it("renders unknown event type", () => {
    const unknownEvents = [{ type: "custom_event", timestamp: "2025-01-15T10:00:00Z", from: "A", to: "B" }];
    render(<Timeline events={unknownEvents} />);
    expect(screen.getByText("A → B")).toBeInTheDocument();
  });
});
