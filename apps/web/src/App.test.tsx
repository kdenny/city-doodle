import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./contexts";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("App", () => {
  it("renders home page with title", () => {
    renderApp();
    expect(screen.getByText("City Doodle")).toBeInTheDocument();
  });

  it("renders description text", () => {
    renderApp();
    expect(
      screen.getByText("A lo-fi vector city builder")
    ).toBeInTheDocument();
  });

  it("has navigation link to about page", () => {
    renderApp();
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
  });

  it("has navigation link to editor", () => {
    renderApp();
    expect(screen.getByRole("link", { name: /editor/i })).toBeInTheDocument();
  });

  it("shows sign in link when not authenticated", () => {
    renderApp();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows create account link when not authenticated", () => {
    renderApp();
    expect(screen.getByRole("link", { name: /create account/i })).toBeInTheDocument();
  });
});
