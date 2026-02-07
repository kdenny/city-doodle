/**
 * Reusable confirmation dialog component.
 *
 * Displays a modal with a message and confirm/cancel buttons.
 */

import { useCallback, useEffect, useRef, type ReactNode } from "react";

export interface ConfirmationDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Main message to display */
  message: string;
  /** Additional details (optional) */
  details?: string[];
  /** Text for the confirm button */
  confirmLabel?: string;
  /** Text for the cancel button */
  cancelLabel?: string;
  /** Variant affecting button styling */
  variant?: "info" | "warning" | "danger";
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Callback when user cancels or closes */
  onCancel: () => void;
  /** Optional extra content rendered between details and buttons (e.g. checkboxes) */
  children?: ReactNode;
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  details,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "info",
  onConfirm,
  onCancel,
  children,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const firstButton = dialogRef.current.querySelector("button");
      firstButton?.focus();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  if (!isOpen) return null;

  const variantStyles = {
    info: {
      icon: "i",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      confirmBg: "bg-blue-600 hover:bg-blue-700",
    },
    warning: {
      icon: "!",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      confirmBg: "bg-amber-600 hover:bg-amber-700",
    },
    danger: {
      icon: "!",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      confirmBg: "bg-red-600 hover:bg-red-700",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      data-testid="confirmation-dialog"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-sm w-full"
        data-testid="confirmation-dialog-content"
      >
        <div className="p-6">
          {/* Icon and Title */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`w-10 h-10 rounded-full ${styles.iconBg} ${styles.iconColor} flex items-center justify-center font-bold text-lg shrink-0`}
            >
              {styles.icon}
            </div>
            <div>
              <h3
                id="dialog-title"
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h3>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-4">{message}</p>

          {/* Details list */}
          {details && details.length > 0 && (
            <ul className="text-sm text-gray-500 list-disc list-inside mb-4 space-y-1">
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}

          {/* Extra content (e.g. checkboxes) */}
          {children}

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              data-testid="dialog-cancel-button"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-md transition-colors ${styles.confirmBg}`}
              data-testid="dialog-confirm-button"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
