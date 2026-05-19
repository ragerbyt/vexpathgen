export let GRAPHMODE = "time";

import { redrawCanvas } from "./draw";
import { bot, flags, graph, MAX_VELOCITY, overlay, pathpoints, sections } from "./globals";
import { getDerivedFlagPlacement, getPathDistanceForTime, sortFlagsByDerivedTime } from "./flags";
import {
  clearSelectedSegment,
  hoveredFlagId,
  hoveredSegmentRange,
  selectedFlagId,
  selectedSegmentRange,
  setHoveredFlag,
  setSelectedFlag,
} from "./handling";
import { PI } from "chart.js/helpers";

const MIN_VIEW_SPAN_RATIO = 0.03;
const FLAG_LANE_HEIGHT = 34;
const MIN_FLAG_AREA_HEIGHT = 42;
const MAIN_GRAPH_TOP = 8;
const MAIN_GRAPH_BOTTOM_GAP = 12;
const FLAG_MARKER_WIDTH = 22;
const FLAG_MARKER_HEIGHT = 22;
const NEGATIVE_GRAPH_RATIO = 0.25;
const SELECTED_FLAG_LIFT = 8;

type ViewWindow = { start: number; end: number };
type LockedGraphProbe = { domainValue: number; yRatio: number };
type GraphLayout = {
  width: number;
  height: number;
  mainTop: number;
  mainHeight: number;
  zeroY: number;
  flagsTop: number;
  flagsHeight: number;
  flagBandCenterY: number;
};

const viewWindow: ViewWindow = { start: 0, end: 1 };
let lastDomainMax = 0;

let isPanningGraph = false;
let panStartX = 0;
let panStartDomainStart = 0;
let panStartDomainEnd = 0;

let draggedFlagId: string | null = null;
let flagDragHistoryCaptured = false;

let disable = false;
let velocityDisplayMode: "center" | "left" | "right" = "center";
let lockedGraphProbe: LockedGraphProbe | null = null;

const startTimeLabel = document.getElementById("start-time-label") as HTMLDivElement;
const endTimeLabel = document.getElementById("end-time-label") as HTMLDivElement;
const unitlabel = document.getElementById("unit-label") as HTMLDivElement;
const overlayCtx = overlay.getContext("2d")!;
const currtime = document.getElementById("currtime-label") as HTMLDivElement;
const currVelocity = document.getElementById("currvel-label") as HTMLDivElement;
const playButton = document.getElementById("play") as HTMLButtonElement | null;
const pauseButton = document.getElementById("pause") as HTMLButtonElement | null;

let isRunningPlayback = false;
let playbackStartPerf = 0;
let playbackElapsed = 0;
let playbackFrameHandle: number | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function syncGraphCanvasSize() {
  const graphRect = graph.getBoundingClientRect();
  const width = Math.max(1, Math.round(graphRect.width));
  const height = Math.max(1, Math.round(graphRect.height));

  if (graph.width !== width) graph.width = width;
  if (graph.height !== height) graph.height = height;
  if (overlay.width !== width) overlay.width = width;
  if (overlay.height !== height) overlay.height = height;
}

function getDomainMax(): number {
  if (pathpoints.length === 0) return 0;
  return pathpoints[pathpoints.length - 1].time;
}

function getXValueAtPoint(index: number): number {
  return pathpoints[index].time;
}

function getViewDomain(): ViewWindow {
  const max = getDomainMax();
  if (max <= 0) return { start: 0, end: 1 };

  const previousMax = lastDomainMax;

  if (previousMax <= 1e-6 && max > 1e-6) {
    viewWindow.start = 0;
    viewWindow.end = max;
  }

  if (previousMax > 0 && max > previousMax + 1e-6) {
    const wasAtFullRange =
      Math.abs(viewWindow.start) < 1e-6 &&
      Math.abs(viewWindow.end - previousMax) < 1e-6;

    if (wasAtFullRange) {
      viewWindow.start = 0;
      viewWindow.end = max;
    }
  }

  lastDomainMax = max;
  const minSpan = max * MIN_VIEW_SPAN_RATIO;
  let start = clamp(viewWindow.start, 0, max);
  let end = clamp(viewWindow.end, 0, max);

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

  viewWindow.start = start;
  viewWindow.end = end;
  return { start, end };
}

function setViewDomain(start: number, end: number) {
  viewWindow.start = start;
  viewWindow.end = end;
}

function xToDomain(xPx: number, widthPx: number): number {
  const view = getViewDomain();
  const ratio = clamp(xPx / Math.max(widthPx, 1), 0, 1);
  return view.start + ratio * (view.end - view.start);
}

function domainToX(domainValue: number, widthPx: number): number {
  const view = getViewDomain();
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

function getSortedFlags() {
  const sorted = [...flags];
  sortFlagsByDerivedTime(sorted, sections, pathpoints);
  return sorted;
}

function getGraphLayout(height: number, width: number, flagCount: number): GraphLayout {
  const flagsHeight = Math.max(MIN_FLAG_AREA_HEIGHT, FLAG_LANE_HEIGHT + 12);
  const mainHeight = Math.max(120, height - MAIN_GRAPH_TOP - flagsHeight - MAIN_GRAPH_BOTTOM_GAP);

  return {
    width,
    height,
    mainTop: MAIN_GRAPH_TOP,
    mainHeight,
    zeroY: MAIN_GRAPH_TOP + mainHeight * (1 - NEGATIVE_GRAPH_RATIO),
    flagsTop: MAIN_GRAPH_TOP + mainHeight + MAIN_GRAPH_BOTTOM_GAP,
    flagsHeight,
    flagBandCenterY: MAIN_GRAPH_TOP + mainHeight + MAIN_GRAPH_BOTTOM_GAP + flagsHeight / 2,
  };
}

function getFlagCenterY(layout: GraphLayout, isSelected: boolean): number {
  return layout.flagBandCenterY - (isSelected ? SELECTED_FLAG_LIFT : 0);
}

function getDomainRangeForSegmentRange(
  range: { startIndex: number; endIndex: number } | null
): { start: number; end: number } | null {
  if (!range || pathpoints.length === 0) return null;
  const lastIndex = pathpoints.length - 1;
  const startIndex = Math.max(0, Math.min(range.startIndex, lastIndex));
  const endIndex = Math.max(0, Math.min(range.endIndex, lastIndex));
  const startValue = getXValueAtPoint(startIndex);
  const endValue = getXValueAtPoint(endIndex);
  if (!isFinite(startValue) || !isFinite(endValue)) return null;
  return {
    start: Math.min(startValue, endValue),
    end: Math.max(startValue, endValue),
  };
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: string,
  width = 2
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

function redrawGrid(ctx: CanvasRenderingContext2D, layout: GraphLayout) {
  const width = layout.width;
  ctx.clearRect(0, 0, width, layout.height);

  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;

  for (let i = 1; i < 4; i++) {
    const y = layout.mainTop + (i / 4) * layout.mainHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (pathpoints.length > 1) {
    const view = getViewDomain();
    const span = Math.max(view.end - view.start, 1e-9);
    const step = getNiceGridStep(span);
    const firstTick = Math.ceil(view.start / step) * step;

    for (let tick = firstTick; tick <= view.end + 1e-9; tick += step) {
      const x = domainToX(tick, width);
      ctx.beginPath();
      ctx.moveTo(x, layout.mainTop);
      ctx.lineTo(x, layout.mainTop + layout.mainHeight);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.beginPath();
  ctx.moveTo(0, layout.flagsTop - 6);
  ctx.lineTo(width, layout.flagsTop - 6);
  ctx.stroke();
}

function drawPathSeries(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string) {
  for (let i = 1; i < points.length; i++) {
    drawLine(ctx, points[i - 1], points[i], color);
  }
}

function drawFlagMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  number: number,
  type: "string" | "velocity",
  isSelected: boolean,
  isHovered: boolean
) {
  const topY = centerY - FLAG_MARKER_HEIGHT / 2;
  const bottomY = centerY + FLAG_MARKER_HEIGHT / 2;
  const leftX = x - FLAG_MARKER_WIDTH / 2;
  const rightX = x + FLAG_MARKER_WIDTH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(rightX - 4, centerY - 2);
  ctx.lineTo(rightX, bottomY);
  ctx.lineTo(leftX, bottomY);
  ctx.lineTo(leftX + 4, centerY - 2);
  ctx.closePath();
  const baseColor = type === "velocity" ? "#dc3c3c" : "#2d7dd2";
  const hoverColor = type === "velocity" ? "#ff6b6b" : "#58a6ff";
  const selectedColor = type === "velocity" ? "#ff944d" : "#7bc3ff";
  ctx.fillStyle = isSelected ? selectedColor : isHovered ? hoverColor : baseColor;
  ctx.fill();
  ctx.lineWidth = isSelected ? 2 : 1.5;
  ctx.strokeStyle = isSelected ? "#fff2d9" : "rgba(255, 255, 255, 0.9)";
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), x, centerY + 3);
  ctx.restore();
}

function mapSignedValueToY(value: number, maxMagnitude: number, layout: GraphLayout) {
  if (maxMagnitude <= 1e-9) return layout.zeroY;
  const positiveHeight = layout.zeroY - layout.mainTop;
  const negativeHeight = layout.mainTop + layout.mainHeight - layout.zeroY;

  if (value >= 0) {
    const ratio = clamp(value / maxMagnitude, 0, 1);
    return layout.zeroY - ratio * positiveHeight;
  }

  const ratio = clamp(Math.abs(value) / maxMagnitude, 0, 1);
  return layout.zeroY + ratio * negativeHeight;
}

function drawFlags(ctx: CanvasRenderingContext2D, layout: GraphLayout) {
  const sortedFlags = getSortedFlags();
  if (sortedFlags.length === 0) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("No flags yet", 12, layout.flagsTop + layout.flagsHeight / 2);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.fillRect(0, layout.flagBandCenterY - FLAG_LANE_HEIGHT / 2, layout.width, FLAG_LANE_HEIGHT);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.moveTo(0, layout.flagBandCenterY + FLAG_LANE_HEIGHT / 2);
  ctx.lineTo(layout.width, layout.flagBandCenterY + FLAG_LANE_HEIGHT / 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Flags", 10, layout.flagBandCenterY);
  ctx.restore();

  const selectedIndex = sortedFlags.findIndex((flag) => flag.id === selectedFlagId);
  const drawOrder = selectedIndex >= 0
    ? [...sortedFlags.slice(0, selectedIndex), ...sortedFlags.slice(selectedIndex + 1), sortedFlags[selectedIndex]]
    : sortedFlags;

  const draggedFlag = draggedFlagId ? sortedFlags.find((flag) => flag.id === draggedFlagId) : null;
  if (draggedFlag) {
    const dragX = domainToX(getDerivedFlagPlacement(draggedFlag, sections, pathpoints).time, layout.width);
    drawLine(
      ctx,
      { x: dragX, y: layout.mainTop },
      { x: dragX, y: layout.flagBandCenterY + FLAG_LANE_HEIGHT / 2 },
      "rgba(255, 88, 88, 0.95)",
      1.5
    );
  }

  for (const flag of drawOrder) {
    const flagIndex = sortedFlags.findIndex((candidate) => candidate.id === flag.id);
    const x = domainToX(getDerivedFlagPlacement(flag, sections, pathpoints).time, layout.width);
    const isSelected = flag.id === selectedFlagId;
    const isHovered = flag.id === hoveredFlagId;
    const centerY = getFlagCenterY(layout, isSelected);

    if (x >= -FLAG_MARKER_WIDTH && x <= layout.width + FLAG_MARKER_WIDTH) {
      drawLine(
        ctx,
        { x, y: layout.flagBandCenterY - FLAG_LANE_HEIGHT / 2 + 4 },
        { x, y: layout.flagBandCenterY + FLAG_LANE_HEIGHT / 2 - 4 },
        flag.type === "velocity"
          ? (isSelected ? "rgba(255, 196, 160, 0.9)" : "rgba(255, 140, 140, 0.5)")
          : (isSelected ? "rgba(180, 225, 255, 0.95)" : "rgba(140, 190, 255, 0.45)"),
        1
      );
      drawFlagMarker(ctx, x, centerY, flagIndex + 1, flag.type, isSelected, isHovered);
    }
  }
}

export function plot() {
  syncGraphCanvasSize();
  const ctx = graph.getContext("2d")!;
  const width = graph.width;
  const height = graph.height;
  const layout = getGraphLayout(height, width, flags.length);

  redrawGrid(ctx, layout);

  const view = getViewDomain();
  const maxVelocity = Math.round(MAX_VELOCITY);
  const maxAngVel = 5;
  const minAngVel = -5;

  const velocityData: { x: number; y: number }[] = [];
  const leftVelocityData: { x: number; y: number }[] = [];
  const rightVelocityData: { x: number; y: number }[] = [];
  const angularVelData: { x: number; y: number }[] = [];

  for (let i = 0; i < pathpoints.length; i++) {
    const xValue = getXValueAtPoint(i);
    if (xValue < view.start || xValue > view.end) continue;
    const xPos = domainToX(xValue, width);

    velocityData.push({ x: xPos, y: mapSignedValueToY(pathpoints[i].velocity, maxVelocity, layout) });
    leftVelocityData.push({ x: xPos, y: mapSignedValueToY(pathpoints[i].leftvel, maxVelocity, layout) });
    rightVelocityData.push({ x: xPos, y: mapSignedValueToY(pathpoints[i].rightvel, maxVelocity, layout) });
    angularVelData.push({ x: xPos, y: mapSignedValueToY(pathpoints[i].angularVelocity, Math.max(maxAngVel, Math.abs(minAngVel)), layout) });
  }

  drawPathSeries(ctx, velocityData, "white");
  drawPathSeries(ctx, leftVelocityData, "red");
  drawPathSeries(ctx, rightVelocityData, "blue");
  drawPathSeries(ctx, angularVelData, "black");
  drawFlags(ctx, layout);

  startTimeLabel.textContent = view.start.toFixed(2);
  endTimeLabel.textContent = view.end.toFixed(2);
  unitlabel.textContent = "TIME (S)";

  const velocityMaxLabel = document.getElementById("velocity-max-label") as HTMLDivElement;
  velocityMaxLabel.textContent = `${maxVelocity.toFixed(0)}`;

  renderLockedGraphProbe();
}

function renderDomainBand(
  rect: DOMRect,
  range: { start: number; end: number } | null,
  color: string
) {
  if (!range) return;
  const view = getViewDomain();
  const start = Math.max(range.start, view.start);
  const end = Math.min(range.end, view.end);
  if (end <= start) return;

  const xStart = domainToX(start, rect.width);
  const xEnd = domainToX(end, rect.width);

  overlayCtx.save();
  overlayCtx.fillStyle = color;
  overlayCtx.fillRect(xStart, 0, xEnd - xStart, overlay.height);
  overlayCtx.restore();
}

function renderHoverBand(rect: DOMRect) {
  renderDomainBand(rect, getDomainRangeForSegmentRange(selectedSegmentRange), "rgba(255, 136, 0, 0.16)");
  renderDomainBand(rect, getDomainRangeForSegmentRange(hoveredSegmentRange), "rgba(255, 255, 0, 0.18)");
}

function clearGraphProbeDisplay() {
  const rect = graph.getBoundingClientRect();
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  renderHoverBand(rect);
  bot.x = -1;
  bot.y = -1;
  bot.o = -1;
  redrawCanvas();
  currtime.style.display = "none";
  currVelocity.style.display = "block";
  currVelocity.innerText = pathpoints.length > 0
    ? "time: 0.00s  x: 0.00  y: 0.00  heading: 0.00  speed: 0.0 in/s"
    : "time: 0.00s  x: --  y: --  heading: --  speed: --";
}

function updateGraphReadout(time: number, displayedVel: number) {
  currtime.style.display = "none";
  currVelocity.style.display = "block";
  currVelocity.innerText =
    `time: ${time.toFixed(2)}s  `
    + `x: ${bot.x.toFixed(2)}  `
    + `y: ${bot.y.toFixed(2)}  `
    + `heading: ${(bot.o * 360 / (2 * PI)).toFixed(2)}  `
    + `speed: ${displayedVel.toFixed(1)} in/s`;
}

function getInterpolatedPathState(time: number) {
  let displayedVel = 0;
  bot.x = -1;
  bot.y = -1;
  bot.o = -1;

  for (let i = 1; i < pathpoints.length; i++) {
    if (time > pathpoints[i].time) continue;
    const frac = (time - pathpoints[i - 1].time) / Math.max(pathpoints[i].time - pathpoints[i - 1].time, 1e-9);

    bot.x = pathpoints[i - 1].x + (pathpoints[i].x - pathpoints[i - 1].x) * frac;
    bot.y = pathpoints[i - 1].y + (pathpoints[i].y - pathpoints[i - 1].y) * frac;
    bot.o = pathpoints[i - 1].orientation + Normalize(pathpoints[i].orientation - pathpoints[i - 1].orientation) * frac;

    if (velocityDisplayMode === "center") {
      displayedVel = pathpoints[i - 1].velocity + (pathpoints[i].velocity - pathpoints[i - 1].velocity) * frac;
    } else if (velocityDisplayMode === "left") {
      displayedVel = pathpoints[i - 1].leftvel + (pathpoints[i].leftvel - pathpoints[i - 1].leftvel) * frac;
    } else {
      displayedVel = pathpoints[i - 1].rightvel + (pathpoints[i].rightvel - pathpoints[i - 1].rightvel) * frac;
    }
    return displayedVel;
  }

  if (pathpoints.length > 0) {
    const last = pathpoints[pathpoints.length - 1];
    bot.x = last.x;
    bot.y = last.y;
    bot.o = last.orientation;
    return velocityDisplayMode === "center" ? last.velocity : velocityDisplayMode === "left" ? last.leftvel : last.rightvel;
  }

  return displayedVel;
}

function renderProbeAt(domainValue: number, yRatio: number, rect: DOMRect) {
  renderProbeAtWithOptions(domainValue, yRatio, rect, true, true);
}

function renderProbeAtWithOptions(
  domainValue: number,
  yRatio: number,
  rect: DOMRect,
  drawVerticalLine: boolean,
  drawHorizontalLine: boolean
) {
  if (pathpoints.length === 0) return;

  const layout = getGraphLayout(rect.height, rect.width, flags.length);
  const xPx = domainToX(domainValue, rect.width);
  const yPx = clamp(yRatio, 0, 1) * rect.height;

  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  renderHoverBand(rect);

  if (drawVerticalLine && xPx >= 0 && xPx <= rect.width) {
    drawLine(overlayCtx, { x: xPx, y: 0 }, { x: xPx, y: overlay.height }, "red");
  }

  if (drawHorizontalLine && yPx <= layout.mainTop + layout.mainHeight) {
    drawLine(overlayCtx, { x: 0, y: yPx }, { x: overlay.width, y: yPx }, "red");
  }

  const time = clamp(domainValue, 0, getDomainMax());
  const displayedVel = getInterpolatedPathState(time);
  updateGraphReadout(time, displayedVel);
  redrawCanvas();
  return;

  currtime.style.display = "block";
  currtime.innerText = `${time.toFixed(2)}s`;
  currVelocity.style.display = "block";
  currVelocity.innerText =
    `${displayedVel.toFixed(1)} in/s, ` +
    `x: ${bot.x.toFixed(2)}, ` +
    `y: ${bot.y.toFixed(2)}, ` +
    `orientation: ${(bot.o * 360 / (2 * PI)).toFixed(2)}°`;

  redrawCanvas();
}

export function renderGraphHoverOverlay() {
  if (disable || isPanningGraph || draggedFlagId) return;
  if (lockedGraphProbe) {
    renderLockedGraphProbe();
    return;
  }
  clearGraphProbeDisplay();
}

export function clearGraphInteractionState() {
  stopPlayback();
  lockedGraphProbe = null;
  draggedFlagId = null;
  flagDragHistoryCaptured = false;
  setHoveredFlag(null);
  clearGraphProbeDisplay();
}

function renderLockedGraphProbe() {
  if (!lockedGraphProbe || disable || isPanningGraph || draggedFlagId) return;
  const rect = graph.getBoundingClientRect();
  renderProbeAt(lockedGraphProbe.domainValue, lockedGraphProbe.yRatio, rect);
}

function getFlagHitTarget(clientX: number, clientY: number): { id: string } | null {
  if (flags.length === 0) return null;

  const rect = graph.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const layout = getGraphLayout(rect.height, rect.width, flags.length);
  const sortedFlags = getSortedFlags();

  const hitCandidates = sortedFlags.filter((flag) => {
    const isSelected = flag.id === selectedFlagId;
    const markerX = domainToX(getDerivedFlagPlacement(flag, sections, pathpoints).time, rect.width);
    const markerY = getFlagCenterY(layout, isSelected);
    return Math.abs(x - markerX) <= FLAG_MARKER_WIDTH / 2 + 4 && Math.abs(y - markerY) <= FLAG_MARKER_HEIGHT / 2 + 4;
  });

  if (hitCandidates.length === 0) {
    return null;
  }

  const selectedHit = hitCandidates.find((flag) => flag.id === selectedFlagId);
  if (selectedHit) {
    return { id: selectedHit.id };
  }

  return { id: hitCandidates[hitCandidates.length - 1].id };

}

function updateHoveredFlagFromPointer(clientX: number, clientY: number) {
  const hit = getFlagHitTarget(clientX, clientY);
  const nextId = hit?.id ?? null;
  if (nextId === hoveredFlagId) return;
  setHoveredFlag(nextId);
  plot();
}

function lockGraphProbeAtMouse(e: MouseEvent) {
  if (disable || isPanningGraph || pathpoints.length === 0 || draggedFlagId) return;

  const hit = getFlagHitTarget(e.clientX, e.clientY);
  if (hit) {
    clearSelectedSegment();
    setSelectedFlag(hit.id === selectedFlagId ? null : hit.id);
    document.dispatchEvent(new CustomEvent("refresh-path-tree"));
    plot();
    renderGraphHoverOverlay();
    return;
  }

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

  lockedGraphProbe = {
    domainValue: xToDomain(newCanvasX, rect.width),
    yRatio: clamp(newCanvasY / Math.max(rect.height, 1), 0, 1),
  };
  renderLockedGraphProbe();
}

function handleMouseMove(e: MouseEvent) {
  if (draggedFlagId) {
    const rect = graph.getBoundingClientRect();
    const max = getDomainMax();
    const nextTime = clamp(xToDomain(e.clientX - rect.left, rect.width), 0, max);

    if (!flagDragHistoryCaptured) {
      document.dispatchEvent(new CustomEvent("capture-editor-history"));
      flagDragHistoryCaptured = true;
    }

    const activeFlag = flags.find((flag) => flag.id === draggedFlagId);
    if (!activeFlag) return;

    activeFlag.pathDistance = getPathDistanceForTime(nextTime, pathpoints);
    sortFlagsByDerivedTime(flags, sections, pathpoints);
    setHoveredFlag(draggedFlagId);
    setSelectedFlag(draggedFlagId);
    document.dispatchEvent(new CustomEvent("recompute-path-profile"));
    renderProbeAtWithOptions(
      nextTime,
      (e.clientY - rect.top) / Math.max(rect.height, 1),
      rect,
      false,
      false
    );
    return;
  }

  if (disable || isPanningGraph || lockedGraphProbe) return;

  const rect = graph.getBoundingClientRect();
  const newCanvasX = e.clientX - rect.left;
  const newCanvasY = e.clientY - rect.top;

  if (newCanvasX < 0 || newCanvasX > rect.width || newCanvasY < 0 || newCanvasY > rect.height) {
    if (hoveredFlagId) {
      setHoveredFlag(null);
      plot();
    }
    clearGraphProbeDisplay();
    return;
  }

  updateHoveredFlagFromPointer(e.clientX, e.clientY);
  clearGraphProbeDisplay();

  if (pathpoints.length === 0) return;

  const domainValue = xToDomain(newCanvasX, rect.width);
  const yRatio = newCanvasY / Math.max(rect.height, 1);
  renderProbeAt(domainValue, yRatio, rect);
}

document.addEventListener("mousemove", handleMouseMove);

function renderPlaybackAtTime(time: number) {
  if (pathpoints.length === 0) return;

  const clampedTime = Math.max(0, Math.min(time, pathpoints[pathpoints.length - 1].time));

  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  const displayedVel = getInterpolatedPathState(clampedTime);
  updateGraphReadout(clampedTime, displayedVel);
  const playbackTotalTime = Math.max(pathpoints[pathpoints.length - 1].time, 1e-9);
  const playbackX = (clampedTime / playbackTotalTime) * overlay.width;
  drawLine(overlayCtx, { x: playbackX, y: 0 }, { x: playbackX, y: overlay.height }, "red");
  redrawCanvas();
  return;
  currtime.style.display = "block";
  currtime.innerText = `${clampedTime.toFixed(2)}s`;

  getInterpolatedPathState(clampedTime);
  const totalTime = Math.max(pathpoints[pathpoints.length - 1].time, 1e-9);
  const x = (clampedTime / totalTime) * overlay.width;
  drawLine(overlayCtx, { x, y: 0 }, { x, y: overlay.height }, "red");
  redrawCanvas();
}

function stopPlayback(clearOverlay = true) {
  isRunningPlayback = false;
  disable = false;

  if (playbackFrameHandle !== null) {
    cancelAnimationFrame(playbackFrameHandle);
    playbackFrameHandle = null;
  }

  if (clearOverlay) {
    playbackElapsed = 0;
    clearGraphProbeDisplay();
  }
}

function tickPlayback(now: number) {
  if (!isRunningPlayback || pathpoints.length === 0) return;

  const totalTime = pathpoints[pathpoints.length - 1].time;
  playbackElapsed = (now - playbackStartPerf) / 1000;

  if (playbackElapsed >= totalTime) {
    renderPlaybackAtTime(totalTime);
    stopPlayback(false);
    return;
  }

  renderPlaybackAtTime(playbackElapsed);
  playbackFrameHandle = requestAnimationFrame(tickPlayback);
}

playButton?.addEventListener("click", () => {
  if (pathpoints.length === 0) return;

  if (playbackElapsed >= pathpoints[pathpoints.length - 1].time) {
    playbackElapsed = 0;
  }

  if (isRunningPlayback) return;

  disable = true;
  isRunningPlayback = true;
  playbackStartPerf = performance.now() - playbackElapsed * 1000;
  playbackFrameHandle = requestAnimationFrame(tickPlayback);
});

pauseButton?.addEventListener("click", () => {
  if (!isRunningPlayback) return;
  stopPlayback(false);
});

function handleGraphWheel(e: WheelEvent) {
  if (pathpoints.length < 2) return;

  const max = getDomainMax();
  if (max <= 0) return;

  const rect = graph.getBoundingClientRect();
  const xPx = clamp(e.clientX - rect.left, 0, rect.width);
  const current = getViewDomain();
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

    setViewDomain(start, end);
    plot();
    return;
  }

  const zoomScale = Math.exp(e.deltaY * 0.0015);
  const minSpan = max * MIN_VIEW_SPAN_RATIO;
  const maxSpan = max;
  const newSpan = clamp(span * zoomScale, minSpan, maxSpan);

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
  setViewDomain(newStart, newEnd);
  plot();
}

function startGraphPan(e: MouseEvent) {
  const hit = getFlagHitTarget(e.clientX, e.clientY);

  if (e.button === 0 && hit) {
    draggedFlagId = hit.id;
    flagDragHistoryCaptured = false;
    clearSelectedSegment();
    setSelectedFlag(hit.id);
    setHoveredFlag(hit.id);
    document.dispatchEvent(new CustomEvent("refresh-path-tree"));
    lockedGraphProbe = null;
    clearGraphProbeDisplay();
    plot();
    e.preventDefault();
    return;
  }

  if (e.button !== 1 || pathpoints.length < 2) return;

  const current = getViewDomain();
  isPanningGraph = true;
  panStartX = e.clientX;
  panStartDomainStart = current.start;
  panStartDomainEnd = current.end;

  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  graph.style.cursor = "grabbing";
  overlay.style.cursor = "grabbing";
  e.preventDefault();
}

graph.addEventListener("wheel", handleGraphWheel, { passive: false });
overlay.addEventListener("wheel", handleGraphWheel, { passive: false });
graph.addEventListener("click", lockGraphProbeAtMouse);
overlay.addEventListener("click", lockGraphProbeAtMouse);
graph.addEventListener("mousedown", startGraphPan);
overlay.addEventListener("mousedown", startGraphPan);
graph.addEventListener("auxclick", (e: MouseEvent) => {
  if (e.button === 1) e.preventDefault();
});
overlay.addEventListener("auxclick", (e: MouseEvent) => {
  if (e.button === 1) e.preventDefault();
});

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key !== "Escape") return;
  stopPlayback();
  lockedGraphProbe = null;
  draggedFlagId = null;
  clearGraphProbeDisplay();
});

document.addEventListener("mouseup", () => {
  const wasDraggingFlag = Boolean(draggedFlagId);
  draggedFlagId = null;
  flagDragHistoryCaptured = false;
  isPanningGraph = false;
  graph.style.cursor = "none";
  overlay.style.cursor = "none";
  if (wasDraggingFlag) {
    document.dispatchEvent(new CustomEvent("refresh-path-tree"));
    plot();
  }
  renderLockedGraphProbe();
});

document.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isPanningGraph || pathpoints.length < 2 || draggedFlagId) return;

  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  const max = getDomainMax();
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

  setViewDomain(start, end);
  plot();
  renderLockedGraphProbe();
});

export function getPreferredNewFlagDistance() {
  if (lockedGraphProbe) {
    return getPathDistanceForTime(lockedGraphProbe.domainValue, pathpoints);
  }
  if (pathpoints.length === 0) return 0;
  return pathpoints[pathpoints.length - 1].dist;
}

export function Normalize(n1: number) {
  if (n1 > Math.PI) {
    n1 -= 2 * Math.PI;
  }

  if (n1 < -Math.PI) {
    n1 += 2 * Math.PI;
  }

  if (n1 > Math.PI) {
    n1 -= 2 * Math.PI;
  }

  if (n1 < -Math.PI) {
    n1 += 2 * Math.PI;
  }
  if (n1 > Math.PI) {
    n1 -= 2 * Math.PI;
  }

  if (n1 < -Math.PI) {
    n1 += 2 * Math.PI;
  }
  return n1;
}
