/**
 * Help modal showing keyboard shortcuts and usage instructions.
 */

interface HelpModalProps {
  onClose: () => void;
}

const KEYBOARD_SHORTCUTS = [
  { key: "Scroll / Pinch", description: "Zoom in/out" },
  { key: "Click + Drag", description: "Pan the map" },
  { key: "Click", description: "Select a feature" },
  { key: "Escape", description: "Cancel current action / deselect" },
  { key: "Delete / Backspace", description: "Delete selected feature" },
];

const PLACEMENT_TIPS = [
  "Click a district type in the palette, then click on the map to place it",
  "Districts cannot overlap with each other or be placed in water",
  "Transit stations must be placed inside a district",
  "Draw neighborhoods by selecting the draw tool and clicking points",
];

export function HelpModal({ onClose }: HelpModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Help & Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
              Keyboard Shortcuts
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <dl className="space-y-2">
                {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-sm font-mono bg-gray-200 px-2 py-0.5 rounded text-gray-700">
                      {key}
                    </dt>
                    <dd className="text-sm text-gray-600">{description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Placement Tips */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
              Placement Tips
            </h3>
            <ul className="space-y-2">
              {PLACEMENT_TIPS.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Getting Started */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-3">
              Getting Started
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>1.</strong> Place districts by selecting from the palette on the left
              </p>
              <p>
                <strong>2.</strong> Add transit stations to connect your city
              </p>
              <p>
                <strong>3.</strong> Draw neighborhoods to label areas of your city
              </p>
              <p>
                <strong>4.</strong> Use the layer controls to toggle visibility
              </p>
            </div>
          </section>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
