import fieldImageURL from "./assets/vexfield.png";
import { waypoints } from "./curve";
import { canvas } from "./globals";
import { controlpoints, Point } from "./point";

/**
 * Initializes the canvas, loads the background image,
 * and sets up the event listeners to redraw the path.
 */
function setupCanvas() {
  const ctx = canvas.getContext("2d")!;
  // Set canvas dimensions.
  canvas.width = Math.min(window.innerWidth, window.innerHeight) * 0.8;
  canvas.height = Math.min(window.innerWidth, window.innerHeight) * 0.8;
  // Load background image.
  const background = new Image();
  background.src = fieldImageURL;
  background.onload = () => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  // Listen for the custom "drawpath" event to update the path.
  document.addEventListener("drawpath", () => {
    redrawCanvas(ctx, background);
  });

  document.addEventListener("redrawCanvas", () => {
    redrawCanvas(ctx, background);
  });
}

/**
 * Clears the canvas, draws the background, and then draws the path if available.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {HTMLImageElement} background - The background image.
 */
function redrawCanvas(ctx: CanvasRenderingContext2D, background: HTMLImageElement) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
  if (waypoints.length > 1) {
    drawPath(ctx);
  }

  if (controlpoints.length === 0) {
    return;
  }
}

/**
 * Draws a path connecting all the provided waypoints.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 */
/**
 * Maps a velocity value (assumed range 0 to 20) to a color.
 * Lower velocities are red; higher velocities are green.
 */
function velocityToColor(velocity: number): string {
  const minVel = -5;
  const maxVel = 55;
  // Normalize velocity to [0, 1]
  let norm = (velocity - minVel) / (maxVel - minVel);
  norm = Math.max(0, Math.min(1, norm));
  // Interpolate between red (255, 0, 0) and green (0, 255, 0)
  const r = Math.round(255 * (1 - norm));
  const g = Math.round(255 * norm);
  const b = 0;
  return `rgb(${r}, ${g}, ${b})`;
}

function drawPath(ctx: CanvasRenderingContext2D) {
  for (let i = 1; i < waypoints.length; i++) {
    // Compute the average velocity between two waypoints.
    const avgVelocity = (waypoints[i - 1].velocity + waypoints[i].velocity) / 2;
    const color = velocityToColor(avgVelocity);
    drawLine(ctx, waypoints[i - 1], waypoints[i], color);
  }
}


/**
 * Draws a line between two points with specified color.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {Object} start - The starting point { x, y }.
 * @param {Object} end - The ending point { x, y }.
 * @param {string} color - The stroke color.
 */
function drawLine(ctx: CanvasRenderingContext2D, start: any, end: any, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Number(start.x), Number(start.y));
  ctx.lineTo(Number(end.x), Number(end.y));
  ctx.stroke();
}

setupCanvas();


