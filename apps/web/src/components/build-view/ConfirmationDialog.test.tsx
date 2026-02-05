import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfirmationDialog } from "./ConfirmationDialog";

describe("ConfirmationDialog", () => {
  const defaultProps = {
    isOpen: true,
    title: "Test Title",
    message: "Test message",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders when isOpen is true", () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.getByTestId("confirmation-dialog")).toBeInTheDocument();
      expect(screen.getByText("Test Title")).toBeInTheDocument();
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(<ConfirmationDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
    });

    it("renders custom button labels", () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          confirmLabel="Yes, do it"
          cancelLabel="No, go back"
        />
      );

      expect(screen.getByText("Yes, do it")).toBeInTheDocument();
      expect(screen.getByText("No, go back")).toBeInTheDocument();
    });

    it("renders details list when provided", () => {
      const details = ["Detail one", "Detail two", "Detail three"];
      render(<ConfirmationDialog {...defaultProps} details={details} />);

      details.forEach((detail) => {
        expect(screen.getByText(detail)).toBeInTheDocument();
      });
    });

    it("does not render details list when empty", () => {
      render(<ConfirmationDialog {...defaultProps} details={[]} />);

      const detailsList = screen.queryByRole("list");
      expect(detailsList).not.toBeInTheDocument();
    });
  });

  describe("variants", () => {
    it("renders info variant with blue styling", () => {
      render(<ConfirmationDialog {...defaultProps} variant="info" />);

      const confirmButton = screen.getByTestId("dialog-confirm-button");
      expect(confirmButton.className).toContain("bg-blue");
    });

    it("renders warning variant with amber styling", () => {
      render(<ConfirmationDialog {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByTestId("dialog-confirm-button");
      expect(confirmButton.className).toContain("bg-amber");
    });

    it("renders danger variant with red styling", () => {
      render(<ConfirmationDialog {...defaultProps} variant="danger" />);

      const confirmButton = screen.getByTestId("dialog-confirm-button");
      expect(confirmButton.className).toContain("bg-red");
    });
  });

  describe("interactions", () => {
    it("calls onConfirm when confirm button is clicked", () => {
      const onConfirm = vi.fn();
      render(<ConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

      fireEvent.click(screen.getByTestId("dialog-confirm-button"));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button is clicked", () => {
      const onCancel = vi.fn();
      render(<ConfirmationDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId("dialog-cancel-button"));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when backdrop is clicked", () => {
      const onCancel = vi.fn();
      render(<ConfirmationDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId("confirmation-dialog"));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel when dialog content is clicked", () => {
      const onCancel = vi.fn();
      render(<ConfirmationDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByTestId("confirmation-dialog-content"));

      expect(onCancel).not.toHaveBeenCalled();
    });

    it("calls onCancel when Escape key is pressed", () => {
      const onCancel = vi.fn();
      render(<ConfirmationDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel for other keys", () => {
      const onCancel = vi.fn();
      render(<ConfirmationDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "a" });

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has role dialog", () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal attribute", () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-labelledby pointing to title", () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
      expect(screen.getByText("Test Title")).toHaveAttribute("id", "dialog-title");
    });
  });

  describe("default values", () => {
    it("uses default button labels when not provided", () => {
      render(<ConfirmationDialog {...defaultProps} />);

      expect(screen.getByText("Confirm")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("uses info variant by default", () => {
      render(<ConfirmationDialog {...defaultProps} />);

      const confirmButton = screen.getByTestId("dialog-confirm-button");
      expect(confirmButton.className).toContain("bg-blue");
    });
  });
});
