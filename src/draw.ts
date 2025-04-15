import { pathpoints } from "./globals";
import { canvas, MAX_VELOCITY ,top,left,bottom,right,ctx, background} from "./globals";
import {controlpoints, pathPoint, controlPoint} from "./globals";

/**
 * Initializes the canvas, loads the background image,
 * and sets up the event listeners to redraw the path.
 */
function setupCanvas() {
  // Set canvas dimensions.
  // Set canvas width to be the same as the height to make it square

  // Load background image.
  
  background.onload = () => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
  };


  // Listen for the custom "drawpath" event to update the path.
  document.addEventListener("drawpath", () => {
    canvas.width = canvas.getBoundingClientRect().height;
    canvas.height = canvas.getBoundingClientRect().height;
  
    redrawCanvas();
  });

  document.addEventListener("redrawCanvas", () => {
    canvas.width = canvas.getBoundingClientRect().height;
    canvas.height = canvas.getBoundingClientRect().height;
  
    redrawCanvas();
  });
}

/**
 * Clears the canvas, draws the background, and then draws the path if available.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {HTMLImageElement} background - The background image.
 */
export function redrawCanvas() {
  if (!background.complete || background.naturalWidth === 0) {
    console.warn("Background image not loaded yet.");
    return;
  }
  

  // Clear the canvas and draw the background
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw the path if pathpoints are available
  if (pathpoints.length > 1) {
    drawPath(ctx);
  }

  if (controlpoints.length === 0) {
    return;
  }

  // Draw lines connecting control points
  for (let i = 0; i < controlpoints.length; i += 3) {
    if (controlpoints[i - 1]) {
      drawLine(ctx, controlpoints[i - 1], controlpoints[i], "white");
    }
    if (controlpoints[i + 1]) {
      drawLine(ctx, controlpoints[i + 1], controlpoints[i], "white");
    }
  }

  // Draw control points
  for (const point of controlpoints) {
    ctx.beginPath();
    const size = point.size || 5;

    // Map field coordinates to canvas coordinates
    const canvasX = ((point.x - left) / (right - left)) * canvas.width;
    const canvasY = ((bottom - point.y) / (bottom - top)) * canvas.height; // Adjusted for inverted Y-axis

    // Draw filled circle
    ctx.arc(canvasX, canvasY, size, 0, Math.PI * 2);
    ctx.fillStyle = point.color;
    ctx.fill();

    // Draw border
    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    ctx.stroke();
  }
}

/**
 * Draws a path connecting all the provided pathpoints.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 */
/**
 * Maps a velocity value (assumed range 0 to 20) to a color.
 * Lower velocities are red; higher velocities are green.
 */
function velocityToColor(velocity: number): string {
  const minVel = -5;
  const maxVel = MAX_VELOCITY * 1.2;
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
  for (let i = 1; i < pathpoints.length; i++) {
    // Compute the average velocity between two pathpoints
    const avgVelocity = (pathpoints[i - 1].velocity + pathpoints[i].velocity) / 2;
    const color = velocityToColor(avgVelocity);

    // Draw the line segment
    drawLine(ctx, pathpoints[i - 1], pathpoints[i], color);
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
function drawLine(
  ctx: CanvasRenderingContext2D,
  start: pathPoint | controlPoint,
  end: pathPoint | controlPoint,
  color: string
){const startX = ((start.x - left) / (right - left)) * canvas.width;
  const startY = ((bottom - start.y) / (bottom - top)) * canvas.height; // Adjusted for inverted Y-axis
  const endX = ((end.x - left) / (right - left)) * canvas.width;
  const endY = ((bottom - end.y) / (bottom - top)) * canvas.height; // Adjusted for inverted Y-axis

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
}

setupCanvas();


