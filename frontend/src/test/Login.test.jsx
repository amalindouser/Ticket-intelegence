import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Login from "../pages/Login";

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin, agent: null, loading: false }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

global.fetch = vi.fn();

function Wrapper({ children }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form", () => {
    render(<Login />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText("nama@ainosi.co.id")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByText("Masuk")).toBeInTheDocument();
  });

  it("shows error on failed login", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Email atau password salah" }),
    });

    render(<Login />, { wrapper: Wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("nama@ainosi.co.id"), "test@test.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByText("Masuk"));

    await waitFor(() => {
      expect(screen.getByText("Email atau password salah")).toBeInTheDocument();
    });
  });

  it("calls login and navigates on success", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "abc123", agent: { name: "Test", email: "test@test.com" } }),
    });

    render(<Login />, { wrapper: Wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("nama@ainosi.co.id"), "test@test.com");
    await user.type(screen.getByPlaceholderText("Password"), "correct");
    await user.click(screen.getByText("Masuk"));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("abc123", { name: "Test", email: "test@test.com" });
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  it("disables button while loading", async () => {
    global.fetch.mockImplementationOnce(() => new Promise(() => {}));

    render(<Login />, { wrapper: Wrapper });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("nama@ainosi.co.id"), "test@test.com");
    await user.type(screen.getByPlaceholderText("Password"), "pass");
    await user.click(screen.getByText("Masuk"));

    expect(screen.getByText("Memuat...")).toBeInTheDocument();
    expect(screen.getByText("Memuat...").closest("button")).toBeDisabled();
  });
});
