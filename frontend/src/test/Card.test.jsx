import { render, screen } from "@testing-library/react";
import Card from "../components/Card";

describe("Card", () => {
  it("renders title and children", () => {
    render(<Card title="Test Card"><p>child content</p></Card>);
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<Card title="Title" subtitle="Subtitle"><p>content</p></Card>);
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
  });

  it("does not render title when not provided", () => {
    const { container } = render(<Card><p>content</p></Card>);
    expect(container.querySelector("h3")).toBeNull();
  });

  it("applies accent border color", () => {
    const { container } = render(<Card accent="#ff0000"><p>content</p></Card>);
    expect(container.firstChild.style.borderLeft).toBe("4px solid #ff0000");
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom-class"><p>content</p></Card>);
    expect(container.firstChild.className).toContain("custom-class");
  });
});
