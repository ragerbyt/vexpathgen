

export let GRAPHMODE = "time"

import { leftVel, rightVel } from "./curve"; // Assuming they're exported there

import { redrawCanvas } from "./draw";
import {graph, MAX_ACCELERATION, MAX_VELOCITY,pathpoints } from "./globals";

let startime = 0; 
let endtime = 0;

const MIN_VIEW_SPAN_RATIO = 0.03;
type GraphMode = "time" | "dist";
const viewWindow: Record<GraphMode, { start: number; end: number }> = {
  time: { start: 0, end: 1 },
  dist: { start: 0, end: 1 },
};
const lastDomainMax: Record<GraphMode, number> = {
  time: 0,
  dist: 0,
};

let isPanningGraph = false;
let panStartX = 0;
let panStartDomainStart = 0;
let panStartDomainEnd = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDomainMax(mode: GraphMode): number {
  if (pathpoints.length === 0) return 0;
  const last = pathpoints[pathpoints.length - 1];
  return mode === "time" ? last.time : last.dist;
}

function getXValueAtPoint(index: number, mode: GraphMode): number {
  return mode === "time" ? pathpoints[index].time : pathpoints[index].dist;
}

function getViewDomain(mode: GraphMode): { start: number; end: number } {
  const max = getDomainMax(mode);
  if (max <= 0) return { start: 0, end: 1 };

  const stored = viewWindow[mode];
  const previousMax = lastDomainMax[mode];

  // First segment/path: always show full range.
  if (previousMax <= 1e-6 && max > 1e-6) {
    stored.start = 0;
    stored.end = max;
  }

  if (previousMax > 0 && max > previousMax + 1e-6) {
    const wasAtFullRange =
      Math.abs(stored.start) < 1e-6 &&
      Math.abs(stored.end - previousMax) < 1e-6;

    // New segment/path extension: auto-fit only when user wasn't zoomed in.
    if (wasAtFullRange) {
      stored.start = 0;
      stored.end = max;
    }
  }

  lastDomainMax[mode] = max;
  const minSpan = max * MIN_VIEW_SPAN_RATIO;
  let start = clamp(stored.start, 0, max);
  let end = clamp(stored.end, 0, max);

  if (end - start < minSpan) {
    const center = (start + end) / 2;
    start = center - minSpan / 2;
    end = center + minSpan / 2;
  }
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > max) {
    const over = end - max;
    start -= over;
    end = max;
  }
  start = clamp(start, 0, Math.max(0, max - minSpan));
  end = clamp(end, Math.min(max, start + minSpan), max);

  if (end <= start) {
    start = 0;
    end = max;
  }

  viewWindow[mode] = { start, end };
  return { start, end };
}

function setViewDomain(mode: GraphMode, start: number, end: number): void {
  viewWindow[mode] = { start, end };
}

function resetViewDomain(mode: GraphMode): void {
  const max = getDomainMax(mode);
  if (max <= 0) {
    setViewDomain(mode, 0, 1);
    return;
  }
  setViewDomain(mode, 0, max);
}

function xToDomain(xPx: number, widthPx: number, mode: GraphMode): number {
  const view = getViewDomain(mode);
  const ratio = clamp(xPx / Math.max(widthPx, 1), 0, 1);
  return view.start + ratio * (view.end - view.start);
}

function domainToX(domainValue: number, widthPx: number, mode: GraphMode): number {
  const view = getViewDomain(mode);
  const span = Math.max(view.end - view.start, 1e-9);
  return ((domainValue - view.start) / span) * widthPx;
}

function getNiceGridStep(span: number): number {
  if (span <= 0) return 1;
  const targetLines = 6;
  const rawStep = span / targetLines;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

// Redraw graph grid, axes, and labels
function redraw(ctx: CanvasRenderingContext2D) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Draw dotted horizontal grid lines to divide into 4 sections
  ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
  ctx.strokeStyle = "#555"; // Gray color for the grid lines
  ctx.lineWidth = 1;

  for (let i = 1; i < 4; i++) {
    if(i == 2){
      ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
      ctx.strokeStyle = "#888"; // Gray color for the grid lines
    }
    const y = (i / 4) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if(i == 2){
      ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
      ctx.strokeStyle = "#555"; // Gray color for the grid lines
    }
  }

  ctx.setLineDash([]); // Reset to solid for future drawing

  if (pathpoints.length > 1) {
    const mode = GRAPHMODE as GraphMode;
    const view = getViewDomain(mode);
    const span = Math.max(view.end - view.start, 1e-9);
    const step = getNiceGridStep(span);
    const firstTick = Math.ceil(view.start / step) * step;

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#555";

    for (let tick = firstTick; tick <= view.end + 1e-9; tick += step) {
      const x = domainToX(tick, width, mode);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ctx.canvas.height);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

}

const startTimeLabel = document.getElementById("start-time-label") as HTMLDivElement;
  const endTimeLabel = document.getElementById("end-time-label") as HTMLDivElement;
  const unitlabel = document.getElementById("unit-label") as HTMLDivElement;
// Plot the velocity graph with time labels at start and end
export function plot() {
  const ctx = graph.getContext("2d")!;
  
  redraw(ctx); // Draw axes and grid first

  const mode = GRAPHMODE as GraphMode;
  const view = getViewDomain(mode);

  const width = graph.width;
  const height = graph.height;

  const maxVelocity = Math.round(MAX_VELOCITY);
  const minVelocity = -Math.round(MAX_VELOCITY);

  const maxAccel = MAX_ACCELERATION;
  const minAccel = -MAX_ACCELERATION;

  const maxAngVel = 5;
  const minAngVel = -5;

  const velocityData: { x: number; y: number }[] = [];
  const accelData: {x: number; y: number}[] = [];
  const leftVelocityData: { x: number; y: number }[] = [];
  const rightVelocityData: { x: number; y: number }[] = [];
  const AngularVelData: {x: number; y: number}[] = [];

  for (let i = 0; i < pathpoints.length; i++) {
      const xValue = getXValueAtPoint(i, mode);
      if (xValue < view.start || xValue > view.end) continue;
      const xPos = domainToX(xValue, width, mode);
  
      const normVel = (pathpoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      const yVel = height - (normVel * height);
      velocityData.push({ x: xPos, y: yVel });

      const normAccel = (pathpoints[i].accel - minAccel) / (maxAccel - minAccel);
      const yAccel = height - (normAccel * height);
      accelData.push({ x: xPos, y: yAccel });

      const normLeft = (pathpoints[i].leftvel - minVelocity) / (maxVelocity - minVelocity);
      const yLeft = height - (normLeft * height);
      leftVelocityData.push({ x: xPos, y: yLeft });

      const normRight = (pathpoints[i].rightvel - minVelocity) / (maxVelocity - minVelocity);
      const yRight = height - (normRight * height);
      rightVelocityData.push({ x: xPos, y: yRight });

      const normCurve = (pathpoints[i].angularVelocity - minAngVel) / (maxAngVel - minAngVel);
      const yCurve = height - (normCurve * height);
      AngularVelData.push({x: xPos, y: yCurve})
  }

  // Draw velocity curve
  drawPath(ctx, velocityData, "white");   // center velocity



  drawPath(ctx, leftVelocityData, "red"); // left wheel
  drawPath(ctx, rightVelocityData, "blue"); // right wheel
  drawPath(ctx, AngularVelData, "black"); // right wheel

  // Get the time values
  const startLabelValue = view.start.toFixed(2);
  const endLabelValue = view.end.toFixed(2);

  if(GRAPHMODE == "time"){
    unitlabel.textContent = "TIME (S)"
  }else{
    unitlabel.textContent = "DIST (IN)"
  }

  // Update the time labels dynamically
  

  startTimeLabel.textContent = startLabelValue;
  endTimeLabel.textContent = endLabelValue;


  // Update velocity markings in HTML
  const velocityMaxLabel = document.getElementById("velocity-max-label") as HTMLDivElement;
  const velocityZeroLabel = document.getElementById("velocity-zero-label") as HTMLDivElement;

  velocityMaxLabel.textContent = `${maxVelocity.toFixed(0)}`; // Example max velocity
  velocityZeroLabel.textContent = "0";
  renderLockedGraphProbe();
  
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

document.addEventListener("mousemove", (e: MouseEvent) => handleMouseMove(e));

const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const octx = overlay.getContext("2d")!
const currtime = document.getElementById("currtime-label") as HTMLDivElement;

import { bot } from "./globals";

let disable = false;
let velocityDisplayMode: "center" | "left" | "right" = "center";
const currVelocity = document.getElementById("currvel-label") as HTMLDivElement;

type LockedGraphProbe = {
  mode: GraphMode;
  domainValue: number;
  yRatio: number;
};

let lockedGraphProbe: LockedGraphProbe | null = null;

function clearGraphProbeDisplay() {
  octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
  bot.x = -1;
  bot.y = -1;
  bot.o = -1;
  redrawCanvas();
  currtime.style.display = "none";
  currVelocity.style.display = "none";
}

function renderProbeAt(domainValue: number, yRatio: number, rect: DOMRect) {
  if (!pathpoints || pathpoints.length === 0) return;

  const mode = GRAPHMODE as GraphMode;
  const xPx = domainToX(domainValue, rect.width, mode);
  const yPx = clamp(yRatio, 0, 1) * rect.height;

  octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);

  if (xPx >= 0 && xPx <= rect.width) {
    drawLine(
      octx,
      { x: (xPx * octx.canvas.width) / Math.max(rect.width, 1), y: 0 },
      { x: (xPx * octx.canvas.width) / Math.max(rect.width, 1), y: octx.canvas.height },
      "red"
    );
  }
  drawLine(
    octx,
    { x: 0, y: (yPx * octx.canvas.height) / Math.max(rect.height, 1) },
    { x: octx.canvas.width, y: (yPx * octx.canvas.height) / Math.max(rect.height, 1) },
    "red"
  );

  bot.x = -1;
  bot.y = -1;
  bot.o = -1;

  let time = 0;
  let displayedVel = 0;

  if (GRAPHMODE === "time") {
    time = domainValue;

    for (let i = 1; i < pathpoints.length; i++) {
      if (time < pathpoints[i].time) {
        const frac = (time - pathpoints[i - 1].time) / (pathpoints[i].time - pathpoints[i - 1].time);

        bot.x = pathpoints[i - 1].x + (pathpoints[i].x - pathpoints[i - 1].x) * frac;
        bot.y = pathpoints[i - 1].y + (pathpoints[i].y - pathpoints[i - 1].y) * frac;
        bot.o = pathpoints[i - 1].orientation + Normalize(pathpoints[i].orientation - pathpoints[i - 1].orientation) * frac;

        if (velocityDisplayMode === "center") {
          displayedVel = pathpoints[i - 1].velocity + (pathpoints[i].velocity - pathpoints[i - 1].velocity) * frac;
        } else if (velocityDisplayMode === "left") {
          displayedVel = pathpoints[i - 1].leftvel + (pathpoints[i].leftvel - pathpoints[i - 1].leftvel) * frac;
        } else if (velocityDisplayMode === "right") {
          displayedVel = pathpoints[i - 1].rightvel + (pathpoints[i].rightvel - pathpoints[i - 1].rightvel) * frac;
        }
        break;
      }
    }

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;
  } else {
    const dist = domainValue;

    for (let i = 1; i < pathpoints.length; i++) {
      const p1 = pathpoints[i - 1];
      const p2 = pathpoints[i];

      if (dist >= p1.dist && dist <= p2.dist) {
        const frac = (dist - p1.dist) / (p2.dist - p1.dist);

        bot.x = p1.x + (p2.x - p1.x) * frac;
        bot.y = p1.y + (p2.y - p1.y) * frac;
        bot.o = p1.orientation + Normalize((p2.orientation - p1.orientation)) * frac;

        time = p1.time + (p2.time - p1.time) * frac;

        if (velocityDisplayMode === "center") {
          displayedVel = p1.velocity + (p2.velocity - p1.velocity) * frac;
        } else if (velocityDisplayMode === "left") {
          displayedVel = pathpoints[i - 1].leftvel + (pathpoints[i].leftvel - pathpoints[i - 1].leftvel) * frac;
        } else if (velocityDisplayMode === "right") {
          displayedVel = pathpoints[i - 1].rightvel + (pathpoints[i].rightvel - pathpoints[i - 1].rightvel) * frac;
        }

        break;
      }
    }

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;
  }

  currVelocity.style.display = "block";
  currVelocity.innerText = `${displayedVel.toFixed(1)} in/s`;

  redrawCanvas();
}

function renderLockedGraphProbe() {
  if (!lockedGraphProbe || disable || isPanningGraph) return;
  if (lockedGraphProbe.mode !== (GRAPHMODE as GraphMode)) {
    lockedGraphProbe = null;
    clearGraphProbeDisplay();
    return;
  }

  const rect = graph.getBoundingClientRect();
  renderProbeAt(lockedGraphProbe.domainValue, lockedGraphProbe.yRatio, rect);
}

function lockGraphProbeAtMouse(e: MouseEvent) {
  if (disable || isPanningGraph || !pathpoints || pathpoints.length === 0) return;

  if (lockedGraphProbe) {
    lockedGraphProbe = null;
    clearGraphProbeDisplay();
    return;
  }

  const rect = graph.getBoundingClientRect();
  const newCanvasX = e.clientX - rect.left;
  const newCanvasY = e.clientY - rect.top;

  if (newCanvasX < 0 || newCanvasX > rect.width) return;
  if (newCanvasY < 0 || newCanvasY > rect.height) return;

  const mode = GRAPHMODE as GraphMode;
  lockedGraphProbe = {
    mode,
    domainValue: xToDomain(newCanvasX, rect.width, mode),
    yRatio: clamp(newCanvasY / Math.max(rect.height, 1), 0, 1),
  };
  renderLockedGraphProbe();
}

function handleMouseMove(e: MouseEvent) {
  if (disable || isPanningGraph || lockedGraphProbe) return;

  clearGraphProbeDisplay();

  if (!pathpoints || pathpoints.length === 0) return;

  const rect = graph.getBoundingClientRect();
  let newCanvasX = e.clientX - rect.left;
  let newCanvasY = e.clientY - rect.top;

  if (newCanvasX < 0 || newCanvasX > rect.width) return;
  if (newCanvasY < 0 || newCanvasY > rect.height) return;

  const mode = GRAPHMODE as GraphMode;
  const domainValue = xToDomain(newCanvasX, rect.width, mode);
  const yRatio = newCanvasY / Math.max(rect.height, 1);
  renderProbeAt(domainValue, yRatio, rect);
}

const run = document.getElementById("run");

run!.addEventListener("click", async () => {
  const startTime = performance.now(); // Time in milliseconds
  disable = true;
  let i = 1;

  console.log("run");

  while (true) {
    const now = performance.now();
    const time = (now - startTime) / 1000; // Convert to seconds

    if (time >= pathpoints[pathpoints.length - 1].time) break;

    octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;

    for (let i  = 0; i < pathpoints.length; i++) {
      if (time < pathpoints[i].time) {
        const frac = (time - pathpoints[i - 1].time) / (pathpoints[i].time - pathpoints[i - 1].time);

        bot.x = pathpoints[i - 1].x + (pathpoints[i].x - pathpoints[i - 1].x) * frac;
        bot.y = pathpoints[i - 1].y + (pathpoints[i].y - pathpoints[i - 1].y) * frac;
        bot.o = pathpoints[i - 1].orientation + Normalize(pathpoints[i].orientation - pathpoints[i - 1].orientation) * frac;

        break;
      }
    }

    drawLine(
      octx,
      { x: (time / pathpoints[pathpoints.length - 1].time) * octx.canvas.width, y: 0 },
      { x: (time / pathpoints[pathpoints.length - 1].time) * octx.canvas.width, y: octx.canvas.height },
      "red"
    );

    redrawCanvas();
    await new Promise(resolve => setTimeout(resolve, 5)); // Sleep just to yield, not to control time
  }

  await new Promise(resolve => setTimeout(resolve, 200));
  disable = false;
});


document.getElementById("dist")?.addEventListener("click", () => {
  GRAPHMODE = "dist";
  lockedGraphProbe = null;
  if (getDomainMax("dist") > 0 && (viewWindow.dist.end <= viewWindow.dist.start || viewWindow.dist.end === 1)) {
    resetViewDomain("dist");
  }
  clearGraphProbeDisplay();
  plot(); 
});

document.getElementById("time")?.addEventListener("click", () => {
  GRAPHMODE = "time";
  lockedGraphProbe = null;
  if (getDomainMax("time") > 0 && (viewWindow.time.end <= viewWindow.time.start || viewWindow.time.end === 1)) {
    resetViewDomain("time");
  }
  clearGraphProbeDisplay();
  plot(); 
});

function handleGraphWheel(e: WheelEvent) {
  if (pathpoints.length < 2) return;

  const mode = GRAPHMODE as GraphMode;
  const max = getDomainMax(mode);
  if (max <= 0) return;

  const rect = graph.getBoundingClientRect();
  const xPx = clamp(e.clientX - rect.left, 0, rect.width);
  const current = getViewDomain(mode);
  const span = Math.max(current.end - current.start, max * MIN_VIEW_SPAN_RATIO);

  e.preventDefault();

  const panGesture = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
  if (panGesture) {
    const panPx = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY;
    const deltaDomain = (panPx / Math.max(rect.width, 1)) * span;
    let start = current.start + deltaDomain;
    let end = current.end + deltaDomain;

    if (start < 0) {
      end -= start;
      start = 0;
    }
    if (end > max) {
      const over = end - max;
      start -= over;
      end = max;
    }

    setViewDomain(mode, start, end);
    plot();
    return;
  }

  const zoomScale = Math.exp(e.deltaY * 0.0015);
  const minSpan = max * MIN_VIEW_SPAN_RATIO;
  const maxSpan = max;
  let newSpan = clamp(span * zoomScale, minSpan, maxSpan);

  const cursorRatio = xPx / Math.max(rect.width, 1);
  const cursorDomain = current.start + cursorRatio * span;

  let newStart = cursorDomain - cursorRatio * newSpan;
  let newEnd = newStart + newSpan;

  if (newStart < 0) {
    newEnd -= newStart;
    newStart = 0;
  }
  if (newEnd > max) {
    const over = newEnd - max;
    newStart -= over;
    newEnd = max;
  }

  newStart = clamp(newStart, 0, Math.max(0, max - newSpan));
  newEnd = clamp(newEnd, Math.min(max, newStart + newSpan), max);

  setViewDomain(mode, newStart, newEnd);
  plot();
}

graph.addEventListener("wheel", handleGraphWheel, { passive: false });
overlay.addEventListener("wheel", handleGraphWheel, { passive: false });
graph.addEventListener("click", lockGraphProbeAtMouse);
overlay.addEventListener("click", lockGraphProbeAtMouse);

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key !== "Escape") return;
  lockedGraphProbe = null;
  clearGraphProbeDisplay();
});

function startGraphPan(e: MouseEvent) {
  if (e.button !== 1 || pathpoints.length < 2) return;

  const mode = GRAPHMODE as GraphMode;
  const current = getViewDomain(mode);
  isPanningGraph = true;
  panStartX = e.clientX;
  panStartDomainStart = current.start;
  panStartDomainEnd = current.end;

  // Hide hover guides while panning.
  octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
  currtime.style.display = "none";
  currVelocity.style.display = "none";

  graph.style.cursor = "grabbing";
  overlay.style.cursor = "grabbing";
  e.preventDefault();
}

graph.addEventListener("mousedown", startGraphPan);
overlay.addEventListener("mousedown", startGraphPan);
graph.addEventListener("auxclick", (e: MouseEvent) => {
  if (e.button === 1) e.preventDefault();
});
overlay.addEventListener("auxclick", (e: MouseEvent) => {
  if (e.button === 1) e.preventDefault();
});

document.addEventListener("mouseup", () => {
  isPanningGraph = false;
  graph.style.cursor = "none";
  overlay.style.cursor = "none";
  renderLockedGraphProbe();
});

document.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isPanningGraph || pathpoints.length < 2) return;

  // Ensure no crosshair artifacts while panning.
  octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
  currtime.style.display = "none";
  currVelocity.style.display = "none";

  const mode = GRAPHMODE as GraphMode;
  const max = getDomainMax(mode);
  const rect = graph.getBoundingClientRect();
  const span = panStartDomainEnd - panStartDomainStart;
  const dx = e.clientX - panStartX;
  const deltaDomain = (dx / Math.max(rect.width, 1)) * span;

  let start = panStartDomainStart - deltaDomain;
  let end = panStartDomainEnd - deltaDomain;

  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > max) {
    const over = end - max;
    start -= over;
    end = max;
  }

  setViewDomain(mode, start, end);
  plot();
  renderLockedGraphProbe();
});

export function Normalize(n1: number){
  if(n1 > Math.PI){
    n1 -= 2*Math.PI
  }

  if(n1 < -Math.PI){
    n1 += 2*Math.PI
  }
  
  if(n1 > Math.PI){
    n1 -= 2*Math.PI
  }

  if(n1 < -Math.PI){
    n1 += 2*Math.PI
  }
  if(n1 > Math.PI){
    n1 -= 2*Math.PI
  }

  if(n1 < -Math.PI){
    n1 += 2*Math.PI
  }
  return n1

}