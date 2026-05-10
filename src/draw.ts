import { Point } from "chart.js";
import {  pathpoints } from "./globals";
import { canvas, MAX_VELOCITY, ctx, background } from "./globals";
import { controlpoints, pathPoint, controlPoint, sections } from "./globals";
import { fieldToCanvasX, fieldToCanvasY, getFieldView } from "./globals";
import { hoveredSegmentRange, selectedSegmentRange } from "./handling";

function drawFieldBackground() {
  const view = getFieldView();
  const sx = (view.left / 144) * background.naturalWidth;
  const sy = ((144 - view.bottom) / 144) * background.naturalHeight;
  const sWidth = ((view.right - view.left) / 144) * background.naturalWidth;
  const sHeight = ((view.bottom - view.top) / 144) * background.naturalHeight;

  ctx.drawImage(
    background,
    sx,
    sy,
    Math.max(1, sWidth),
    Math.max(1, sHeight),
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height
  );
}

function setupCanvas() {
  background.onload = () => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawFieldBackground();
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
  drawFieldBackground();

  if (pathpoints.length > 1) {
    drawPath(ctx);
  }

  if (controlpoints.length === 0) {
    return;
  }

  if (drawpoints) {
    drawControlPolygons(ctx);
  }

  for (const point of controlpoints) {
    if (!drawpoints) break;
    ctx.beginPath();
    const size = point.size || 5;

    const canvasX = fieldToCanvasX(point.x, canvas.width);
    const canvasY = fieldToCanvasY(point.y, canvas.height);

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

function drawControlPolygons(ctx: CanvasRenderingContext2D) {
  for (const sec of sections) {
    const start = Math.max(0, sec.startcontrol);
    const end = Math.min(controlpoints.length - 1, sec.endcontrol);
    if (start >= end) continue;

    for (let i = start; i < end; i++) {
      drawLine(ctx, controlpoints[i], controlpoints[i + 1], "rgba(255, 255, 255, 0.45)", 1);
    }
  }
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
function drawPath(ctx: CanvasRenderingContext2D) {
  for (let i = 1; i < pathpoints.length; i++) {
    const avgVelocity = (pathpoints[i - 1].velocity + pathpoints[i].velocity) / 2;
    const color = velocityToColor(avgVelocity);
    drawLine(ctx, pathpoints[i - 1], pathpoints[i], color, 2);
  }

  drawHighlightedRange(selectedSegmentRange, "rgba(255, 136, 0, 0.95)", 5);
  drawHighlightedRange(hoveredSegmentRange, "rgba(255, 255, 0, 0.95)", 4);
}

function drawHighlightedRange(
  range: { startIndex: number; endIndex: number } | null,
  color: string,
  thickness: number
) {
  if (!range) return;
  const start = Math.max(0, range.startIndex);
  const end = Math.min(pathpoints.length - 1, range.endIndex);
  if (end <= start) return;

  for (let i = start; i < end; i++) {
    drawLine(ctx, pathpoints[i], pathpoints[i + 1], color, thickness);
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  start: pathPoint | controlPoint | Point,
  end: pathPoint | controlPoint | Point,
  color: string,
  thickness: number = 2
) {

  
  const startX = fieldToCanvasX(start.x, canvas.width);
  const startY = fieldToCanvasY(start.y, canvas.height);
  const endX = fieldToCanvasX(end.x, canvas.width);
  const endY = fieldToCanvasY(end.y, canvas.height);

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
  const view = getFieldView();
  const scale = canvas.width / Math.max(view.right - view.left, 1e-9);

  // convert current field coordinates to screen coordinates
  const canvasX = fieldToCanvasX(x, canvas.width);
  const canvasY = fieldToCanvasY(y, canvas.height);

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
