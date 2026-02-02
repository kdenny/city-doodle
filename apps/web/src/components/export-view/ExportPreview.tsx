import { ReactNode } from "react";

export interface ExportPreviewProps {
  children: ReactNode;
}

export function ExportPreview({ children }: ExportPreviewProps) {
  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
      {/* Preview container with aspect ratio */}
      <div className="aspect-video relative">
        {children}
      </div>

      {/* Preview label */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
        Preview
      </div>
    </div>
  );
}
