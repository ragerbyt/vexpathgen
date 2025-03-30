export const canvas = document.getElementById("path") as HTMLCanvasElement;
export const graph = document.getElementById("graph") as HTMLCanvasElement;

// Constants (all distances in inches)
export const FIELD_WIDTH_INCHES = 144;
export const MAX_VELOCITY = 24;         // Maximum velocity in inches per second
export const MAX_ACCELERATION = 12;      // Maximum acceleration in inches per second squared
export const MAX_JERK = 100;           // Maximum jerk in inches per second cubed