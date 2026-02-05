/**
 * Seed control component for managing random seeds in procedural generation.
 *
 * Features:
 * - Displays current seed value (or short hash)
 * - Shuffle button (dice icon) to generate new random seed
 * - Copy button to copy seed for sharing
 * - Same seed + settings = deterministic result
 */

import { useCallback, useState } from "react";

interface SeedControlProps {
  /** Current seed value */
  seed: number;
  /** Callback when seed changes */
  onSeedChange: (seed: number) => void;
  /** Optional label to display above the control */
  label?: string;
  /** Compact mode for smaller display */
  compact?: boolean;
  /** Whether the control is disabled */
  disabled?: boolean;
}

/**
 * Generate a random seed value.
 * Uses crypto.getRandomValues for better randomness when available.
 */
export function generateRandomSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0];
  }
  // Fallback for environments without crypto
  return Math.floor(Math.random() * 4294967296);
}

/**
 * Convert a seed number to a short, displayable hash.
 * Returns a 6-character alphanumeric string.
 */
export function seedToHash(seed: number): string {
  // Convert to base 36 for alphanumeric representation
  const hash = Math.abs(seed).toString(36).toUpperCase();
  // Pad or truncate to 6 characters
  return hash.padStart(6, "0").slice(-6);
}

/**
 * Parse a hash string back to a seed number.
 * Returns null if the hash is invalid.
 */
export function hashToSeed(hash: string): number | null {
  const normalized = hash.trim().toUpperCase();
  if (!/^[0-9A-Z]{1,8}$/.test(normalized)) {
    return null;
  }
  const parsed = parseInt(normalized, 36);
  return isNaN(parsed) ? null : parsed;
}

export function SeedControl({
  seed,
  onSeedChange,
  label = "Seed",
  compact = false,
  disabled = false,
}: SeedControlProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const hash = seedToHash(seed);

  const handleShuffle = useCallback(() => {
    if (disabled) return;
    onSeedChange(generateRandomSeed());
  }, [disabled, onSeedChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = hash;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [hash]);

  const handleStartEditing = useCallback(() => {
    if (disabled) return;
    setEditValue(hash);
    setIsEditing(true);
  }, [disabled, hash]);

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValue(e.target.value.toUpperCase().slice(0, 8));
    },
    []
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const newSeed = hashToSeed(editValue);
        if (newSeed !== null) {
          onSeedChange(newSeed);
        }
        setIsEditing(false);
      } else if (e.key === "Escape") {
        setIsEditing(false);
      }
    },
    [editValue, onSeedChange]
  );

  const handleEditBlur = useCallback(() => {
    const newSeed = hashToSeed(editValue);
    if (newSeed !== null) {
      onSeedChange(newSeed);
    }
    setIsEditing(false);
  }, [editValue, onSeedChange]);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">{label}:</span>
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={handleEditChange}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
            className="w-16 px-1.5 py-0.5 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            disabled={disabled}
          />
        ) : (
          <button
            onClick={handleStartEditing}
            className={`
              px-1.5 py-0.5 text-xs font-mono bg-gray-100 rounded
              ${disabled ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-200 cursor-pointer"}
            `}
            title="Click to edit seed"
            disabled={disabled}
          >
            {hash}
          </button>
        )}
        <button
          onClick={handleShuffle}
          className={`
            p-1 rounded transition-colors
            ${disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}
          `}
          title="Generate new random seed"
          aria-label="Shuffle seed"
          disabled={disabled}
          data-testid="seed-shuffle-button"
        >
          <DiceIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={handleEditChange}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditBlur}
              className="w-20 px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              disabled={disabled}
            />
          ) : (
            <button
              onClick={handleStartEditing}
              className={`
                px-2 py-1 text-sm font-mono bg-gray-100 rounded
                ${disabled ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-200 cursor-pointer"}
              `}
              title="Click to edit seed"
              disabled={disabled}
              data-testid="seed-display"
            >
              {hash}
            </button>
          )}
          <button
            onClick={handleCopy}
            className={`
              p-1 rounded transition-colors
              ${copied ? "text-green-600 bg-green-50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}
              ${disabled ? "text-gray-300 cursor-not-allowed" : ""}
            `}
            title={copied ? "Copied!" : "Copy seed"}
            aria-label="Copy seed"
            disabled={disabled}
            data-testid="seed-copy-button"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <CopyIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleShuffle}
            className={`
              p-1 rounded transition-colors
              ${disabled ? "text-gray-300 cursor-not-allowed" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}
            `}
            title="Generate new random seed"
            aria-label="Shuffle seed"
            disabled={disabled}
            data-testid="seed-shuffle-button"
          >
            <DiceIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Same seed = same result
      </p>
    </div>
  );
}

// SVG Icons
function DiceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
