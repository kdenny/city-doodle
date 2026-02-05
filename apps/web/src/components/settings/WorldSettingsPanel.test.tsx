import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorldSettingsPanel } from "./WorldSettingsPanel";
import type { World } from "../../api/types";

// Mock the API hooks
const mockMutateAsync = vi.fn();
vi.mock("../../api", async () => {
  const actual = await vi.importActual("../../api");
  return {
    ...actual,
    useUpdateWorld: () => ({
      mutateAsync: mockMutateAsync,
      isPending: false,
    }),
  };
});

describe("WorldSettingsPanel", () => {
  const mockWorld: World = {
    id: "world-123",
    name: "Test World",
    seed: 12345,
    settings: {
      grid_organic: 0.3,
      sprawl_compact: 0.5,
      historic_modern: 0.7,
      transit_car: 0.2,
    },
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const mockOnClose = vi.fn();
  const mockOnSaved = vi.fn();

  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderPanel = (world: World = mockWorld) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WorldSettingsPanel
          world={world}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      </QueryClientProvider>
    );
  };

  it("renders the panel with world name", () => {
    renderPanel();

    expect(screen.getByText("World Settings")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test World")).toBeInTheDocument();
  });

  it("displays the world seed (read-only)", () => {
    renderPanel();

    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText("Seed cannot be changed after creation")).toBeInTheDocument();
  });

  it("renders personality sliders with current values", () => {
    renderPanel();

    expect(screen.getByText("City Personality")).toBeInTheDocument();
    // Check that slider values are displayed
    expect(screen.getByText("30%")).toBeInTheDocument(); // grid_organic
    expect(screen.getByText("50%")).toBeInTheDocument(); // sprawl_compact
    expect(screen.getByText("70%")).toBeInTheDocument(); // historic_modern
    expect(screen.getByText("20%")).toBeInTheDocument(); // transit_car
  });

  it("closes when close button is clicked", () => {
    renderPanel();

    const closeButton = screen.getByLabelText("Close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes when cancel button is clicked", () => {
    renderPanel();

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("closes when backdrop is clicked", () => {
    const { container } = renderPanel();

    // Find the backdrop (outer div with bg-black)
    const backdrop = container.querySelector(".bg-black");
    expect(backdrop).not.toBeNull();

    // Click on the backdrop itself, not a child
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it("disables save button when no changes made", () => {
    renderPanel();

    const saveButton = screen.getByText("Save Changes");
    expect(saveButton).toBeDisabled();
  });

  it("enables save button when name is changed", () => {
    renderPanel();

    const nameInput = screen.getByDisplayValue("Test World");
    fireEvent.change(nameInput, { target: { value: "New World Name" } });

    const saveButton = screen.getByText("Save Changes");
    expect(saveButton).not.toBeDisabled();
  });

  it("enables save button when slider is changed", () => {
    renderPanel();

    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "50" } });

    const saveButton = screen.getByText("Save Changes");
    expect(saveButton).not.toBeDisabled();
  });

  it("calls updateWorld and callbacks on save", async () => {
    const updatedWorld = { ...mockWorld, name: "Updated World" };
    mockMutateAsync.mockResolvedValueOnce(updatedWorld);

    renderPanel();

    // Change the name
    const nameInput = screen.getByDisplayValue("Test World");
    fireEvent.change(nameInput, { target: { value: "Updated World" } });

    // Click save
    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        worldId: "world-123",
        data: {
          name: "Updated World",
          settings: mockWorld.settings,
        },
      });
    });

    await waitFor(() => {
      expect(mockOnSaved).toHaveBeenCalledWith(updatedWorld);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it("displays error when save fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Network error"));

    renderPanel();

    // Change the name
    const nameInput = screen.getByDisplayValue("Test World");
    fireEvent.change(nameInput, { target: { value: "New Name" } });

    // Click save
    const saveButton = screen.getByText("Save Changes");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows error when trying to save with empty name", async () => {
    renderPanel();

    // Clear the name
    const nameInput = screen.getByDisplayValue("Test World");
    fireEvent.change(nameInput, { target: { value: "" } });

    // The save button should still be enabled because there's a change
    const saveButton = screen.getByText("Save Changes");
    expect(saveButton).not.toBeDisabled();

    // Click save
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText("World name is required")).toBeInTheDocument();
    });

    // Should not call the API
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("updates state when world prop changes", () => {
    const { rerender } = renderPanel();

    const newWorld: World = {
      ...mockWorld,
      id: "world-456",
      name: "Another World",
      settings: {
        grid_organic: 0.8,
        sprawl_compact: 0.2,
        historic_modern: 0.5,
        transit_car: 0.9,
      },
    };

    rerender(
      <QueryClientProvider client={queryClient}>
        <WorldSettingsPanel
          world={newWorld}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />
      </QueryClientProvider>
    );

    expect(screen.getByDisplayValue("Another World")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument(); // grid_organic
    expect(screen.getByText("90%")).toBeInTheDocument(); // transit_car
  });
});
