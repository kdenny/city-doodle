/** Shared color palette for rail transit lines. Used by manual drawing, auto-connect, and properties dialog. */
export const RAIL_LINE_COLORS = [
  { name: "Red", hex: "#B22222" },      // Firebrick Red
  { name: "Green", hex: "#2E8B57" },    // Sea Green
  { name: "Blue", hex: "#4169E1" },     // Royal Blue
  { name: "Gold", hex: "#DAA520" },     // Goldenrod
  { name: "Brown", hex: "#8B4513" },    // Saddle Brown
  { name: "Purple", hex: "#663399" },   // Rebecca Purple
  { name: "Orange", hex: "#FF6600" },   // Orange
  { name: "Teal", hex: "#008080" },     // Teal
];

/** Subway-specific color palette inspired by NYC subway system. */
export const SUBWAY_LINE_COLORS = [
  { name: "Blue", hex: "#0066CC" },
  { name: "Orange", hex: "#FF6600" },
  { name: "Green", hex: "#00933C" },
  { name: "Yellow", hex: "#FCCC0A" },
  { name: "Red", hex: "#EE352E" },
  { name: "Purple", hex: "#A626AA" },
  { name: "Lime", hex: "#6CBE45" },
  { name: "Brown", hex: "#996633" },
];

/** Get hex values only (for auto-generation/collision avoidance). */
export const RAIL_LINE_HEX = RAIL_LINE_COLORS.map(c => c.hex);
export const SUBWAY_LINE_HEX = SUBWAY_LINE_COLORS.map(c => c.hex);
