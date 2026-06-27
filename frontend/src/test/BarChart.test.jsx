import { render, screen } from "@testing-library/react";
import BarChart from "../components/BarChart";

describe("BarChart", () => {
  const data = [
    { day: "Mon", count: 10 },
    { day: "Tue", count: 20 },
    { day: "Wed", count: 15 },
  ];

  it("renders all data values", () => {
    render(<BarChart data={data} labelKey="day" valueKey="count" />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("renders labels", () => {
    render(<BarChart data={data} labelKey="day" valueKey="count" />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
  });

  it("handles empty data", () => {
    const { container } = render(<BarChart data={[]} labelKey="day" valueKey="count" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
