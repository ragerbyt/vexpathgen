import { Point } from "chart.js";
import {  pathpoints } from "./globals";
import { canvas, MAX_VELOCITY, ctx, background } from "./globals";
import { controlpoints, pathPoint, controlPoint } from "./globals";
import { fieldToCanvasX, fieldToCanvasY, getFieldView } from "./globals";
import { drawFieldImage } from "./fieldRenderer";
import { drawRobotOutline } from "./robotRenderer";

function drawFieldBackground() {
  drawFieldImage(ctx, background, {
    mode: "view-window",
    view: getFieldView(),
    fieldSizeInches: 144
  });
}

function setupCanvas() {
  const resizePathCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const sideFromHeight = rect.height > 0 ? rect.height : rect.width;
    const side = Math.max(1, Math.floor(Math.min(rect.width || sideFromHeight, sideFromHeight || rect.width)));
    if (side > 0 && (canvas.width !== side || canvas.height !== side)) {
      canvas.width = side;
      canvas.height = side;
    }
  };

  background.onload = () => {
    resizePathCanvas();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawFieldBackground();
  };

  document.addEventListener("drawpath", () => {
    resizePathCanvas();
    redrawCanvas();
  });

  document.addEventListener("redrawCanvas", () => {
    resizePathCanvas();
    redrawCanvas();
  });

  window.addEventListener("resize", () => {
    resizePathCanvas();
    redrawCanvas();
  });

  resizePathCanvas();
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

  for (let i = 0; i < controlpoints.length-1; i++) {
    if (!drawpoints) break;
    if (controlpoints[i + 1].isMain != controlpoints[i].isMain) {
      drawLine(ctx, controlpoints[i + 1], controlpoints[i], "white", 2);
    }
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
  if(start_hi != -1){
    for(let i = start_hi; i < end_hi; i++){
      drawLine(ctx, pathpoints[i], pathpoints[i+1], "yellow", 4); 
    }
  } 

  for (let i = 1; i < pathpoints.length; i++) {
    const avgVelocity = (pathpoints[i - 1].velocity + pathpoints[i].velocity) / 2;
    const color = velocityToColor(avgVelocity);
    drawLine(ctx, pathpoints[i - 1], pathpoints[i], color, 2);
  }



  if (!sidetrack) return;

  for (let i = 1; i < pathpoints.length; i++) {
    drawLeftRight(ctx, pathpoints[i - 1], pathpoints[i]);
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

function drawLeftRight(
  ctx: CanvasRenderingContext2D,
  start: pathPoint,
  end: pathPoint,
) {

  const thickness = 1;

  let startX = fieldToCanvasX(start.leftx, canvas.width);
  let startY = fieldToCanvasY(start.lefty, canvas.height);
  let endX = fieldToCanvasX(end.leftx, canvas.width);
  let endY = fieldToCanvasY(end.lefty, canvas.height);

  ctx.save(); // Save the current canvas state
  ctx.globalAlpha = 1; // Fully opaque
  ctx.globalCompositeOperation = "source-over"; // Default compositing mode
  ctx.strokeStyle = "red";
  ctx.lineWidth = thickness;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore(); // Restore the previous canvas state

  startX = fieldToCanvasX(start.rightx, canvas.width);
  startY = fieldToCanvasY(start.righty, canvas.height);
  endX = fieldToCanvasX(end.rightx, canvas.width);
  endY = fieldToCanvasY(end.righty, canvas.height);


  ctx.save(); // Save the current canvas state
  ctx.globalAlpha = 1; // Fully opaque
  ctx.globalCompositeOperation = "source-over"; // Default compositing mode
  ctx.strokeStyle = "blue";
  ctx.lineWidth = thickness;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore(); // Restore the previous canvas state
}

import { bot } from "./globals";
import { end_hi, start_hi } from "./handling";

function drawBot(ctx: CanvasRenderingContext2D) {
  const { x, y, o, width, length, trackwidth } = bot;

  drawRobotOutline(
    ctx,
    {
      x,
      y,
      thetaRadians: o,
      length,
      width,
      centerOffsetFromBack: length / 2
    },
    (worldX, worldY) => ({
      x: fieldToCanvasX(worldX, canvas.width),
      y: fieldToCanvasY(worldY, canvas.height)
    }),
    {
      fillStyle: "rgba(0, 0, 255, 0.4)",
      strokeStyle: "blue",
      headingStrokeStyle: "white",
      lineWidth: 2,
      headingLineWidth: 2,
      headingLength: length / 2
    }
  );

  const view = getFieldView();
  const scale = canvas.width / Math.max(view.right - view.left, 1e-9);
  const canvasX = fieldToCanvasX(x, canvas.width);
  const canvasY = fieldToCanvasY(y, canvas.height);
  const l = length * scale;
  const ht = (trackwidth * scale) / 2;

  ctx.save();
  ctx.translate(canvasX, canvasY);
  ctx.rotate(-o);
  ctx.beginPath();
  ctx.moveTo(-l / 2, -ht);
  ctx.lineTo(l / 2, -ht);
  ctx.moveTo(-l / 2, ht);
  ctx.lineTo(l / 2, ht);
  ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
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
