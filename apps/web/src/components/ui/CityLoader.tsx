import { useState, useEffect } from "react";

const MESSAGES = [
  "Surveying the land...",
  "Laying the foundations...",
  "Zoning districts...",
  "Paving the streets...",
  "Planting trees in the park...",
  "Opening the coffee shops...",
  "Debating parking minimums...",
  "Running the subway lines...",
  "Approving building permits...",
  "Naming the neighborhoods...",
  "Arguing about bike lanes...",
  "Installing streetlights...",
  "Painting crosswalks...",
  "Scheduling the bus routes...",
  "Rolling out the welcome mat...",
];

interface CityLoaderProps {
  variant?: "page" | "inline";
  message?: string;
}

export function CityLoader({ variant = "page", message }: CityLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(
    () => Math.floor(Math.random() * MESSAGES.length)
  );

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [message]);

  const displayMessage = message || MESSAGES[messageIndex];

  const isPage = variant === "page";
  const svgSize = isPage ? "w-48 h-28" : "w-32 h-20";

  return (
    <div
      className={
        isPage
          ? "min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"
          : "flex flex-col items-center justify-center gap-3 py-6"
      }
    >
      <svg
        className={svgSize}
        viewBox="0 0 200 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ground line */}
        <line
          x1="5"
          y1="105"
          x2="195"
          y2="105"
          stroke="#9ca3af"
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            strokeDasharray: 190,
            ["--dash-length" as string]: 190,
          }}
          className="city-draw"
        />

        {/* Residential building */}
        <rect
          x="15"
          y="60"
          width="28"
          height="45"
          rx="2"
          stroke="#9ca3af"
          strokeWidth={1.5}
          style={{
            strokeDasharray: 146,
            ["--dash-length" as string]: 146,
            animationDelay: "0.3s",
          }}
          className="city-draw"
        />
        <rect
          x="15"
          y="60"
          width="28"
          height="45"
          rx="2"
          fill="#fff3cd"
          style={{ animationDelay: "0.9s" }}
          className="city-fill"
          fillOpacity={0}
        />
        {/* Residential windows */}
        <g className="city-fade-in" style={{ animationDelay: "1.2s" }}>
          <rect x="20" y="68" width="5" height="6" rx="1" fill="#e5dbb5" />
          <rect x="28" y="68" width="5" height="6" rx="1" fill="#e5dbb5" />
          <rect x="20" y="80" width="5" height="6" rx="1" fill="#e5dbb5" />
          <rect x="28" y="80" width="5" height="6" rx="1" fill="#e5dbb5" />
          <rect x="24" y="93" width="6" height="12" rx="1" fill="#e5dbb5" />
        </g>

        {/* Downtown tower */}
        <rect
          x="52"
          y="28"
          width="22"
          height="77"
          rx="2"
          stroke="#9ca3af"
          strokeWidth={1.5}
          style={{
            strokeDasharray: 198,
            ["--dash-length" as string]: 198,
            animationDelay: "0.7s",
          }}
          className="city-draw"
        />
        <rect
          x="52"
          y="28"
          width="22"
          height="77"
          rx="2"
          fill="#d4a5a5"
          style={{ animationDelay: "1.3s" }}
          className="city-fill"
          fillOpacity={0}
        />
        {/* Downtown windows */}
        <g className="city-fade-in" style={{ animationDelay: "1.6s" }}>
          <rect x="56" y="35" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="64" y="35" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="56" y="47" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="64" y="47" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="56" y="59" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="64" y="59" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="56" y="71" width="4" height="5" rx="0.5" fill="#c49090" />
          <rect x="64" y="71" width="4" height="5" rx="0.5" fill="#c49090" />
        </g>

        {/* Commercial building */}
        <rect
          x="83"
          y="50"
          width="26"
          height="55"
          rx="2"
          stroke="#9ca3af"
          strokeWidth={1.5}
          style={{
            strokeDasharray: 162,
            ["--dash-length" as string]: 162,
            animationDelay: "1.1s",
          }}
          className="city-draw"
        />
        <rect
          x="83"
          y="50"
          width="26"
          height="55"
          rx="2"
          fill="#aed9e0"
          style={{ animationDelay: "1.7s" }}
          className="city-fill"
          fillOpacity={0}
        />
        {/* Commercial windows */}
        <g className="city-fade-in" style={{ animationDelay: "2.0s" }}>
          <rect x="87" y="57" width="6" height="7" rx="1" fill="#96c5cc" />
          <rect x="97" y="57" width="6" height="7" rx="1" fill="#96c5cc" />
          <rect x="87" y="70" width="6" height="7" rx="1" fill="#96c5cc" />
          <rect x="97" y="70" width="6" height="7" rx="1" fill="#96c5cc" />
          <rect x="91" y="88" width="8" height="17" rx="1" fill="#96c5cc" />
        </g>

        {/* Park tree */}
        <g
          className="city-fade-in"
          style={{ animationDelay: "1.8s" }}
        >
          <line
            x1="127"
            y1="105"
            x2="127"
            y2="82"
            stroke="#6b7280"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <ellipse
            cx="127"
            cy="75"
            rx="10"
            ry="13"
            fill="#90ee90"
            fillOpacity={0}
            style={{ animationDelay: "2.1s" }}
            className="city-fill"
          />
          <ellipse
            cx="127"
            cy="75"
            rx="10"
            ry="13"
            stroke="#9ca3af"
            strokeWidth={1.5}
            fill="none"
            style={{
              strokeDasharray: 73,
              ["--dash-length" as string]: 73,
              animationDelay: "1.8s",
            }}
            className="city-draw"
          />
        </g>

        {/* University building */}
        <rect
          x="145"
          y="55"
          width="30"
          height="50"
          rx="2"
          stroke="#9ca3af"
          strokeWidth={1.5}
          style={{
            strokeDasharray: 160,
            ["--dash-length" as string]: 160,
            animationDelay: "2.0s",
          }}
          className="city-draw"
        />
        <rect
          x="145"
          y="55"
          width="30"
          height="50"
          rx="2"
          fill="#d4c4fb"
          style={{ animationDelay: "2.6s" }}
          className="city-fill"
          fillOpacity={0}
        />
        {/* University windows */}
        <g className="city-fade-in" style={{ animationDelay: "2.9s" }}>
          <rect x="150" y="62" width="5" height="6" rx="1" fill="#bfaaf0" />
          <rect x="159" y="62" width="5" height="6" rx="1" fill="#bfaaf0" />
          <rect x="150" y="74" width="5" height="6" rx="1" fill="#bfaaf0" />
          <rect x="159" y="74" width="5" height="6" rx="1" fill="#bfaaf0" />
          <rect x="155" y="90" width="7" height="15" rx="1" fill="#bfaaf0" />
        </g>

        {/* Sun */}
        <circle
          cx="180"
          cy="22"
          r="10"
          stroke="#9ca3af"
          strokeWidth={1.5}
          style={{
            strokeDasharray: 63,
            ["--dash-length" as string]: 63,
            animationDelay: "2.8s",
          }}
          className="city-draw"
        />
        <circle
          cx="180"
          cy="22"
          r="10"
          fill="#fbbf24"
          style={{ animationDelay: "3.2s" }}
          className="city-fill"
          fillOpacity={0}
        />
      </svg>

      <p
        className={`font-handwritten text-gray-500 transition-opacity duration-300 ${
          isPage ? "text-xl" : "text-base"
        }`}
      >
        {displayMessage}
      </p>
    </div>
  );
}
