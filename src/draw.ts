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
  canvas.width = 600;
  canvas.height = 600;
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

  document.addEventListener("line", () => {
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

  // Draw lines between control points
  for (let i = 0; i < controlpoints.length; i += 5) {
    if (i + 1 >= controlpoints.length) {
      break;
    }

    let sx = Infinity,
      lx = -Infinity;
    let point1: Point | null = null,
      point2: Point | null = null;

    if (i === 0) {
      for (let j = 0; j < 3; j++) {
        if (i + j >= controlpoints.length) break;

        let x = controlpoints[i + j].x;
        if (x < sx) {
          point1 = controlpoints[i + j];
          sx = x;
        }
        if (x > lx) {
          point2 = controlpoints[i + j];
          lx = x;
        }
      }
    } else if (i === controlpoints.length - 1) {
      for (let j = -2; j <= 0; j++) {
        if (i + j < 0 || i + j >= controlpoints.length) continue;

        let x = controlpoints[i + j].x;
        if (x < sx) {
          point1 = controlpoints[i + j];
          sx = x;
        }
        if (x > lx) {
          point2 = controlpoints[i + j];
          lx = x;
        }
      }
    } else {
      for (let j = -2; j <= 2; j++) {
        if (i + j < 0 || i + j >= controlpoints.length) continue;

        let x = controlpoints[i + j].x;
        if (x < sx) {
          point1 = controlpoints[i + j];
          sx = x;
        }
        if (x > lx) {
          point2 = controlpoints[i + j];
          lx = x;
        }
      }
    }

    if (point1 && point2) {
      drawLine(ctx, point1, point2, "white");
    }
  }
}

/**
 * Draws a path connecting all the provided waypoints.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 */
function drawPath(ctx: CanvasRenderingContext2D) {
  for (let i = 1; i < waypoints.length; i++) {
    drawLine(ctx, waypoints[i - 1], waypoints[i], "rgb(57, 255, 20)");
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
