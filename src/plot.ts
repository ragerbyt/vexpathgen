export interface Point {
  x: number;
  y: number;
  velocity: number;
  accel: number;
  dist: number;
  time: number;
}

const marginLeft = 50;
const marginRight = 20;
const marginTop = 20;
const marginBottom = 50;

import { MAX_VELOCITY, MAX_ACCELERATION } from "./globals";

// Function to redraw graph axes and grid lines
function redraw(ctx: CanvasRenderingContext2D) {
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw the axes (solid white lines)
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  // X-axis
  ctx.beginPath();
  ctx.moveTo(marginLeft, canvasHeight - marginBottom);
  ctx.lineTo(canvasWidth - marginRight, canvasHeight - marginBottom);
  ctx.stroke();

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(marginLeft, canvasHeight - marginBottom);
  ctx.lineTo(marginLeft, marginTop);
  ctx.stroke();

  // Draw grid lines (dashed gray)
  ctx.strokeStyle = "gray";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  // Vertical grid lines
  const numVLines = 5;
  const graphWidth = canvasWidth - marginLeft - marginRight;
  const vSpacing = graphWidth / numVLines;
  for (let i = 1; i <= numVLines; i++) {
      ctx.beginPath();
      ctx.moveTo(marginLeft + i * vSpacing, canvasHeight - marginBottom);
      ctx.lineTo(marginLeft + i * vSpacing, marginTop);
      ctx.stroke();
  }

  // Horizontal grid lines
  const numHLines = 4;
  const graphHeight = canvasHeight - marginTop - marginBottom;
  const hSpacing = graphHeight / numHLines;
  for (let i = 1; i <= numHLines; i++) {
      ctx.beginPath();
      ctx.moveTo(marginLeft, canvasHeight - marginBottom - i * hSpacing);
      ctx.lineTo(canvasWidth - marginRight, canvasHeight - marginBottom - i * hSpacing);
      ctx.stroke();
  }
}

// Function to plot both velocity and acceleration on the same graph
export function plot(chart: HTMLCanvasElement, waypoints: Point[]) {
  const ctx = chart.getContext("2d")!;
  redraw(ctx); // Draw axes and grid first

  const canvasWidth = chart.width;
  const canvasHeight = chart.height;
  const graphWidth = canvasWidth - marginLeft - marginRight;
  const graphHeight = canvasHeight - marginTop - marginBottom;

  // Define scaling ranges
  const maxVelocity = MAX_VELOCITY * 1.2;
  const minVelocity = -0.2 * MAX_VELOCITY;
  const maxAccel = MAX_ACCELERATION * 1.2;
  const minAccel = -MAX_ACCELERATION * 1.2;

  const velocityData: { x: number; y: number }[] = [];
  const accelData: { x: number; y: number }[] = [];

  for (let i = 0; i < waypoints.length; i++) {
      const timeRatio = waypoints[i].time / waypoints[waypoints.length - 1].time;
      const xPos = marginLeft + timeRatio * graphWidth;

      // Normalize and scale velocity
      const normVel = (waypoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      const yVel = marginTop + (1 - normVel) * graphHeight;
      velocityData.push({ x: xPos, y: yVel });

      // Normalize and scale acceleration
      const normAccel = (waypoints[i].accel - minAccel) / (maxAccel - minAccel);
      const yAccel = marginTop + (1 - normAccel) * graphHeight;
      accelData.push({ x: xPos, y: yAccel });
  }

  // Draw both velocity and acceleration curves
  drawPath(ctx, velocityData, "magenta"); // Velocity in magenta
  //drawPath(ctx, accelData, "cyan"); // Acceleration in cyan
  const timeLabel = document.getElementById("time-label");
  if (timeLabel) {
      timeLabel.textContent = `Time: ${waypoints[waypoints.length - 1].time.toFixed(2)} s`;
  }
  
  
}

// Helper function to draw paths for both datasets
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
