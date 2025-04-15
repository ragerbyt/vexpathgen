export interface Point {
  x: number;
  y: number;
  velocity: number;
  accel: number;
  dist: number;
  time: number;
}

import { graph, MAX_VELOCITY,pathpoints } from "./globals";

// Redraw graph grid, axes, and labels
function redraw(ctx: CanvasRenderingContext2D) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);
}

// Plot the velocity graph with time labels at start and end
export function plot() {
  const ctx = graph.getContext("2d")!;
  
  redraw(ctx); // Draw axes and grid first

  const width = graph.width;
  const height = graph.height;

  const maxVelocity = MAX_VELOCITY * 1.2;
  const minVelocity = 0;

  const velocityData: { x: number; y: number }[] = [];

  // Normalize and scale velocity
  for (let i = 0; i < pathpoints.length; i++) {
    const timeRatio = pathpoints[i].time / pathpoints[pathpoints.length - 1].time;
    const xPos = timeRatio * width;

    const normVel = (pathpoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
    const yVel = height - (normVel * height);
    velocityData.push({ x: xPos, y: yVel });
  }

  // Draw velocity curve
  drawPath(ctx, velocityData, "white");

  // Get the time values
  const startTime = pathpoints[0].time.toFixed(2);
  const endTime = pathpoints[pathpoints.length - 1].time.toFixed(2);

  // Update the time labels dynamically
  const startTimeLabel = document.getElementById("start-time-label") as HTMLDivElement;
  const endTimeLabel = document.getElementById("end-time-label") as HTMLDivElement;

  if (startTimeLabel) {
    startTimeLabel.textContent = startTime;
  }

  if (endTimeLabel) {
    endTimeLabel.textContent = endTime;
  }

  // Update velocity markings in HTML
  const velocityMaxLabel = document.getElementById("velocity-max-label") as HTMLDivElement;
  const velocityZeroLabel = document.getElementById("velocity-zero-label") as HTMLDivElement;

  if (velocityMaxLabel) {
    velocityMaxLabel.textContent = `${maxVelocity.toFixed(1)}`; // Example max velocity
  }

  if (velocityZeroLabel) {
    velocityZeroLabel.textContent = "0";
  }
}

// Helper function to draw paths for velocity data
function drawPath(ctx: CanvasRenderingContext2D, datas: { x: number; y: number }[], color: string) {
  for (let i = 1; i < datas.length; i++) {
    drawLine(ctx, datas[i - 1], datas[i], color);
  }
}

// Helper function to draw a line segment
function drawLine(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}
