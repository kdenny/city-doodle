import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders home page with title", () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByText("City Doodle")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(
      screen.getByText("A lo-fi vector city builder")
    ).toBeInTheDocument();
  });

  it("has navigation link to about page", () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
  });
});
