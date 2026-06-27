import { render, screen } from "@testing-library/react";
import Footer from "../components/Footer";

describe("Footer", () => {
  it("renders Ticket Intelligence text", () => {
    render(<Footer />);
    expect(screen.getByText("Ticket Intelligence")).toBeInTheDocument();
  });

  it("renders Amalindo credit", () => {
    render(<Footer />);
    expect(screen.getByText("Amalindo")).toBeInTheDocument();
  });
});
