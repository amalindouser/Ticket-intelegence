import { render, screen } from "@testing-library/react";
import StatCard from "../components/StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Tickets" value="42" />);
    expect(screen.getByText("Total Tickets")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("applies custom color", () => {
    const { container } = render(<StatCard label="Test" value="5" color="#ff0000" />);
    expect(container.firstChild.style.borderLeft).toBe("4px solid #ff0000");
  });

  it("uses default color when not provided", () => {
    const { container } = render(<StatCard label="Test" value="5" />);
    expect(container.firstChild.style.borderLeft).toBe("4px solid #4361ee");
  });
});
