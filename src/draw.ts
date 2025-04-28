import { Point } from "chart.js";
import { leftdt, pathpoints, rightdt } from "./globals";
import { canvas, MAX_VELOCITY, top, left, bottom, right, ctx, background } from "./globals";
import { controlpoints, pathPoint, controlPoint } from "./globals";

function setupCanvas() {
  background.onload = () => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
  };

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

let drawpoints = true;

export function redrawCanvas() {

  if (!background.complete || background.naturalWidth === 0) {
    console.warn("Background image not loaded yet.");
    return;
  }

  

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);

  if (pathpoints.length > 1) {
    drawPath(ctx);
  }

  if (controlpoints.length === 0) {
    return;
  }

  for (let i = 0; i < controlpoints.length; i += 3) {
    if (!drawpoints) break;
    if (controlpoints[i - 1]) {
      drawLine(ctx, controlpoints[i - 1], controlpoints[i], "white", 2);
    }
    if (controlpoints[i + 1]) {
      drawLine(ctx, controlpoints[i + 1], controlpoints[i], "white", 2);
    }
  }

  for (const point of controlpoints) {
    if (!drawpoints) break;
    ctx.beginPath();
    const size = point.size || 5;

    const canvasX = (point.x / 144) * canvas.width;
    const canvasY = ((144 - point.y) / 144) * canvas.height;

    ctx.arc(canvasX, canvasY, size, 0, Math.PI * 2);
    ctx.fillStyle = point.color;
    ctx.fill();

    ctx.lineWidth = 1;
    ctx.strokeStyle = "white";
    ctx.stroke();
  }

  if (bot.x == -1) {
    return;
  }
  drawBot(ctx);
}

document.getElementById("togglePoints")?.addEventListener("click", () => {
  drawpoints = !drawpoints;
  redrawCanvas();
});

function velocityToColor(velocity: number): string {
  velocity = Math.abs(velocity)
  const minVel = 0;
  const maxVel = MAX_VELOCITY;
  let norm = (velocity - minVel) / (maxVel - minVel);
  norm = Math.max(0, Math.min(1, norm));
  const r = Math.round(255 * (1 - norm));
  const g = Math.round(255 * norm);
  const b = 0;
  const a = 1; // Increase this for more opacity (max 1.0)
  ctx.globalAlpha = 1.0;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}


let sidetrack = false;

function drawPath(ctx: CanvasRenderingContext2D) {
  for (let i = 1; i < pathpoints.length; i++) {
    const avgVelocity = (pathpoints[i - 1].velocity + pathpoints[i].velocity) / 2;
    const color = velocityToColor(avgVelocity);
    drawLine(ctx, pathpoints[i - 1], pathpoints[i], color, 4);
  }

  if (!sidetrack) return;

  for (let i = 1; i < leftdt.length; i++) {
    drawLine(ctx, leftdt[i - 1], leftdt[i], "red", 1);
  }

  for (let i = 1; i < rightdt.length; i++) {
    drawLine(ctx, rightdt[i - 1], rightdt[i], "blue", 1);
  }
}

document.getElementById("sidepath")?.addEventListener("click", () => {
  sidetrack = !sidetrack;
  redrawCanvas();
});

function drawLine(
  ctx: CanvasRenderingContext2D,
  start: pathPoint | controlPoint | Point,
  end: pathPoint | controlPoint | Point,
  color: string,
  thickness: number = 2
) {

  
  const startX = (start.x / 144) * canvas.width;
  const startY = ((144 - start.y) / 144) * canvas.height;
  const endX = (end.x / 144) * canvas.width;
  const endY = ((144 - end.y) / 144) * canvas.height;

  ctx.save(); // Save the current canvas state
  ctx.globalAlpha = 1; // Fully opaque
  ctx.globalCompositeOperation = "source-over"; // Default compositing mode
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore(); // Restore the previous canvas state
}

import { bot } from "./globals";

function drawBot(ctx: CanvasRenderingContext2D) {
  const { x, y, o, width, length, trackwidth } = bot;

  // convert robot‐coords (0–144) → canvas‐coords
  const canvasX = (x / 144) * canvas.width;
  const canvasY = ((144 - y) / 144) * canvas.height;
  const scale   = canvas.width / 144;

  // body dims in px
  const w = width  * scale;
  const l = length * scale;
  // track‐width in px and half:
  const tw = trackwidth * scale;
  const ht = tw / 2;

  ctx.save();
  ctx.translate(canvasX, canvasY);
  ctx.rotate(-o);

  // draw robot body
  ctx.beginPath();
  ctx.rect(-l / 2, -w / 2, l, w);
  ctx.fillStyle   = "rgba(0, 0, 255, 0.4)";
  ctx.fill();
  ctx.lineWidth   = 2;
  ctx.strokeStyle = "blue";
  ctx.stroke();

  // heading line
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(l / 2, 0);
  ctx.strokeStyle = "white";
  ctx.lineWidth   = 2;
  ctx.stroke();

  // ** new: track‐width “rails” **
  ctx.beginPath();
  // left side
  ctx.moveTo(-l / 2, -ht);
  ctx.lineTo( l / 2, -ht);
  // right side
  ctx.moveTo(-l / 2,  ht);
  ctx.lineTo( l / 2,  ht);
  ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
  ctx.lineWidth   = 1;
  ctx.setLineDash([4,2]);
  ctx.stroke();
  ctx.setLineDash([]);  // back to solid

  ctx.restore();

  // existing: draw nearest‐point velocity dot...
  let closestIndex = 0;
  let minDist = Infinity;
  for (let i = 1; i < pathpoints.length; i++) {
    const px = (pathpoints[i - 1].x + pathpoints[i].x) / 2;
    const py = (pathpoints[i - 1].y + pathpoints[i].y) / 2;
    const dist = Math.hypot(px - x, py - y);
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  if (closestIndex > 0) {
    const p1 = pathpoints[closestIndex - 1];
    const p2 = pathpoints[closestIndex];
    const avgVelocity = (p1.velocity + p2.velocity) / 2;
    const color = velocityToColor(avgVelocity);

    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth   = 1;
    ctx.strokeStyle = "white";
    ctx.stroke();
  }
}


setupCanvas();
