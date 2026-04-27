import { controlPoint } from "./globals";

let isDraggingGlobal = false;
let activeDragPoint: controlPoint | null = null;
let selectedPoint: controlPoint | null = null;
let dragHistoryCaptured = false;

type HistorySnapshot = {
  controlpoints: controlPoint[];
  sections: typeof sections;
};

const historyPast: HistorySnapshot[] = [];
const historyFuture: HistorySnapshot[] = [];
const HISTORY_LIMIT = 100;


const state = false;

//so if top = 20; left = 20 ;then top left is chopped off.


const pointdisplay = document.getElementById("point-coordinates")!

import { computeBezierWaypoints } from "./curve";
import { canvas,controlpoints, sections } from "./globals";
import { canvasToFieldX, canvasToFieldY, getFieldView, panFieldView, zoomFieldView } from "./globals";
import { deselectSegment, hi_seg, selectSegment } from "./handling";

import { resetsegment } from "./handling";
import { MODE } from "./sidebar";
import { color, PI } from "chart.js/helpers";
import { Normalize } from "./plot";
document.addEventListener("DOMContentLoaded", initCanvas);

function initCanvas() {
  canvas.addEventListener("click", (e: MouseEvent) => handleCanvasClick(e));
  canvas.addEventListener("mousedown", (e: MouseEvent) => handleMouseDown(e));
  canvas.addEventListener("auxclick", (e: MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  });
  canvas.addEventListener("wheel", (e: WheelEvent) => handleFieldWheel(e), { passive: false });
  document.addEventListener("mousemove", (e: MouseEvent) => handleMouseMove(e));
  document.addEventListener("mouseup", () => handleMouseUp());
  document.addEventListener("keydown", (e: KeyboardEvent) => handleHistoryShortcut(e));

  // Initial render of the canvas
  redrawPoints();
  // createPointSet(100,100)
  // createPointSet(120,120)
}


function handleCanvasClick(e: MouseEvent) {
  // If a drag event just occurred, do not create new points.
  if (isDraggingGlobal) {
    isDraggingGlobal = false;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Convert canvas coordinates to field coordinates (0-144)
  const fieldX = canvasToFieldX(clickX, rect.width);
  const fieldY = canvasToFieldY(clickY, rect.height);

  captureHistoryState();
  createPointSet(fieldX, fieldY);
}

let isPanningField = false;
let panLastClientX = 0;
let panLastClientY = 0;
let hasPannedField = false;

function handleMouseDown(e: MouseEvent) {
  if (e.button === 1) {
    isPanningField = true;
    hasPannedField = false;
    panLastClientX = e.clientX;
    panLastClientY = e.clientY;
    e.preventDefault();
    return;
  }

  if (e.button !== 0) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Convert to field coordinates
  const fieldX = canvasToFieldX(mouseX, rect.width);
  const fieldY = canvasToFieldY(mouseY, rect.height);

  // Check if we're clicking on an existing controlPoint (using field coordinates)
  const clickedPoint = getPointAtPosition(fieldX, fieldY);
  if (clickedPoint) {
    e.stopPropagation();
    activeDragPoint = clickedPoint;
    isDraggingGlobal = true;
    dragHistoryCaptured = false;
    let temptext = "controlPoint selected X: ";
    temptext += clickedPoint.x.toFixed(1);
    temptext += " Y: ";
    temptext += clickedPoint.y.toFixed(1);
    pointdisplay.innerText = temptext;
  }else{
    pointdisplay.innerText = "No controlPoint selected";
  }
}

let canrun = true;

async function paws(){
  await new Promise(resolve => setTimeout(resolve, 1));
  canrun = true
}

function handleMouseMove(e: MouseEvent) {
  // if(!canrun){return}
  // canrun = false;
  // paws()

  const rect = canvas.getBoundingClientRect();
  let newCanvasX = e.clientX - rect.left;
  let newCanvasY = e.clientY - rect.top;

  if (isPanningField) {
    const view = getFieldView();
    const spanX = view.right - view.left;
    const spanY = view.bottom - view.top;
    const dx = e.clientX - panLastClientX;
    const dy = e.clientY - panLastClientY;

    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      hasPannedField = true;
      isDraggingGlobal = true;
      panFieldView(
        -(dx / Math.max(rect.width, 1)) * spanX,
        (dy / Math.max(rect.height, 1)) * spanY
      );
      redrawPoints();
    }

    panLastClientX = e.clientX;
    panLastClientY = e.clientY;
    return;
  }

  // Clamp canvas values to ensure they don't exceed canvas boundaries
  newCanvasX = Math.max(0, Math.min(rect.width, newCanvasX));
  newCanvasY = Math.max(0, Math.min(rect.height, newCanvasY));

  // Convert new canvas coordinates to field coordinates
  const newFieldX = canvasToFieldX(newCanvasX, rect.width);
  const newFieldY = canvasToFieldY(newCanvasY, rect.height);



  const point = getPointAtPosition(newFieldX, newFieldY)

  if (activeDragPoint){
    updateDrag(activeDragPoint, newFieldX, newFieldY);
    redrawPoints();
  }


}

function handleMouseUp() {
  if (isPanningField) {
    isPanningField = false;
    if (hasPannedField) {
      setTimeout(() => {
        isDraggingGlobal = false;
      }, 10);
    }
    hasPannedField = false;
  }

  activeDragPoint = null;
  dragHistoryCaptured = false;
  if (isDraggingGlobal) {
    setTimeout(() => {
      isDraggingGlobal = false;
    }, 10);
  }
}

function getPointAtPosition(fieldX: number, fieldY: number): controlPoint | null {
  const view = getFieldView();
  const hitRadius = 10 * (view.right - view.left) / Math.max(canvas.width, 1); // in field units
  for (let i = controlpoints.length - 1; i >= 0; i--) {
    const controlPoint = controlpoints[i];
    const pointSize = controlPoint.size || 5;
    const dx = fieldX - controlPoint.x;
    const dy = fieldY - controlPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= hitRadius) {
      return controlPoint;
    }
  }
  return null;
}

function handleFieldWheel(e: WheelEvent) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const view = getFieldView();
  const spanX = view.right - view.left;
  const spanY = view.bottom - view.top;

  e.preventDefault();

  const panGesture = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
  if (panGesture) {
    const deltaX = (e.deltaX / Math.max(rect.width, 1)) * spanX;
    const deltaY = (e.deltaY / Math.max(rect.height, 1)) * spanY;
    panFieldView(deltaX, deltaY);
    redrawPoints();
    return;
  }

  const zoomScale = Math.exp(e.deltaY * 0.0015);
  const pointerX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const pointerY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
  const anchorX = canvasToFieldX(pointerX, rect.width);
  const anchorY = canvasToFieldY(pointerY, rect.height);
  zoomFieldView(zoomScale, anchorX, anchorY);
  redrawPoints();
}

const segcontainer = document.getElementById("segment-config")
const exampleseg = document.getElementById("exampleseg")!

const selectedSegments : Boolean[] = []; // key: idx, value: true/false

function reindexControlPoints() {
  for (let i = 0; i < controlpoints.length; i++) {
    controlpoints[i].index = i;
  }
}

function normalizeAngle(angle: number): number {
  while (angle > PI) angle -= 2 * PI;
  while (angle < -PI) angle += 2 * PI;
  return angle;
}

function ccwDelta(from: number, to: number): number {
  let d = to - from;
  while (d < 0) d += 2 * PI;
  while (d >= 2 * PI) d -= 2 * PI;
  return d;
}

function getArcTangents(start: controlPoint, mid: controlPoint, end: controlPoint): { startAngle: number; endAngle: number } {
  const x1 = start.x;
  const y1 = start.y;
  const x2 = mid.x;
  const y2 = mid.y;
  const x3 = end.x;
  const y3 = end.y;

  const det = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(det) < 1e-6) {
    const fallback = Math.atan2(end.y - start.y, end.x - start.x);
    return { startAngle: fallback, endAngle: fallback };
  }

  const ux =
    ((x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2)) /
    det;
  const uy =
    ((x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1)) /
    det;

  const a0 = Math.atan2(y1 - uy, x1 - ux);
  const a1 = Math.atan2(y2 - uy, x2 - ux);
  const a2 = Math.atan2(y3 - uy, x3 - ux);

  const totalCCW = ccwDelta(a0, a2);
  const midCCW = ccwDelta(a0, a1);
  const isCCW = midCCW <= totalCCW + 1e-6;

  const startAngle = normalizeAngle(a0 + (isCCW ? PI / 2 : -PI / 2));
  const endAngle = normalizeAngle(a2 + (isCCW ? PI / 2 : -PI / 2));
  return { startAngle, endAngle };
}

function getSectionAngles(start: number, end: number, type: "bezier" | "bezier3" | "line" | "arc"): { startAngle: number; endAngle: number } {
  if (type === "arc") {
    const mid = start + 1;
    if (!controlpoints[start] || !controlpoints[mid] || !controlpoints[end]) {
      const fallback = Math.atan2(controlpoints[end].y - controlpoints[start].y, controlpoints[end].x - controlpoints[start].x);
      return { startAngle: fallback, endAngle: fallback };
    }
    return getArcTangents(controlpoints[start], controlpoints[mid], controlpoints[end]);
  }

  if (type === "line") {
    const angle = Math.atan2(controlpoints[end].y - controlpoints[start].y, controlpoints[end].x - controlpoints[start].x);
    return { startAngle: angle, endAngle: angle };
  }

  const startAngle = Math.atan2(controlpoints[start + 1].y - controlpoints[start].y, controlpoints[start + 1].x - controlpoints[start].x);
  const endAngle = Math.atan2(controlpoints[end].y - controlpoints[end - 1].y, controlpoints[end].x - controlpoints[end - 1].x);
  return { startAngle, endAngle };
}

function getAutoMiddleControlPoint(start: controlPoint, endX: number, endY: number, bendScale: number): { x: number; y: number } {
  const dx = endX - start.x;
  const dy = endY - start.y;
  const length = Math.hypot(dx, dy);

  const midX = (start.x + endX) / 2;
  const midY = (start.y + endY) / 2;
  if (length < 1e-6) {
    return { x: midX, y: midY };
  }

  const perpX = -dy / length;
  const perpY = dx / length;
  let side = 1;

  if (typeof start.anglex === "number" && typeof start.angley === "number") {
    const dot = start.anglex * perpX + start.angley * perpY;
    side = dot >= 0 ? 1 : -1;
  }

  const bend = length * bendScale;
  return {
    x: midX + perpX * bend * side,
    y: midY + perpY * bend * side,
  };
}

function getAnchorDirection(anchor: controlPoint, fallbackX: number, fallbackY: number): { x: number; y: number } {
  const ax = anchor.anglex ?? 0;
  const ay = anchor.angley ?? 0;
  const amag = Math.hypot(ax, ay);
  if (amag > 1e-6) {
    return { x: ax / amag, y: ay / amag };
  }

  const dx = fallbackX - anchor.x;
  const dy = fallbackY - anchor.y;
  const dmag = Math.hypot(dx, dy);
  if (dmag > 1e-6) {
    return { x: dx / dmag, y: dy / dmag };
  }

  return { x: 1, y: 0 };
}

type HandleRelation = {
  anchorIndex: number;
  handleIndex: number;
  sign: 1 | -1;
};

type RelationGraph = {
  anchorToRelations: Map<number, HandleRelation[]>;
  handleToRelations: Map<number, HandleRelation[]>;
};

function buildRelationGraph(): RelationGraph {
  const anchorToRelations = new Map<number, HandleRelation[]>();
  const handleToRelations = new Map<number, HandleRelation[]>();

  function addRelation(anchorIndex: number, handleIndex: number, sign: 1 | -1) {
    if (anchorIndex < 0 || anchorIndex >= controlpoints.length) return;
    if (handleIndex < 0 || handleIndex >= controlpoints.length) return;
    if (controlpoints[handleIndex].isMain) return;

    const rel: HandleRelation = { anchorIndex, handleIndex, sign };

    if (!anchorToRelations.has(anchorIndex)) anchorToRelations.set(anchorIndex, []);
    anchorToRelations.get(anchorIndex)!.push(rel);

    if (!handleToRelations.has(handleIndex)) handleToRelations.set(handleIndex, []);
    handleToRelations.get(handleIndex)!.push(rel);
  }

  for (const sec of sections) {
    if (sec.type === "bezier") {
      addRelation(sec.startcontrol, sec.startcontrol + 1, 1);
      addRelation(sec.endcontrol, sec.endcontrol - 1, -1);
    }

    if (sec.type === "bezier3") {
      const handleIdx = sec.startcontrol + 1;
      addRelation(sec.startcontrol, handleIdx, 1);
      addRelation(sec.endcontrol, handleIdx, -1);
    }
  }

  return { anchorToRelations, handleToRelations };
}

function setAnchorDirectionFromHandle(anchorIndex: number, handleIndex: number, sign: 1 | -1): boolean {
  const anchor = controlpoints[anchorIndex];
  const handle = controlpoints[handleIndex];
  const dx = handle.x - anchor.x;
  const dy = handle.y - anchor.y;
  const mag = Math.hypot(dx, dy);
  if (mag <= 1e-6) return false;

  anchor.anglex = (dx / mag) * sign;
  anchor.angley = (dy / mag) * sign;
  return true;
}

function moveHandleFromAnchorRelation(rel: HandleRelation): boolean {
  const anchor = controlpoints[rel.anchorIndex];
  const handle = controlpoints[rel.handleIndex];
  const length = Math.hypot(handle.x - anchor.x, handle.y - anchor.y);
  if (length <= 1e-6) return false;

  const dirX = anchor.anglex ?? 0;
  const dirY = anchor.angley ?? 0;
  const dirMag = Math.hypot(dirX, dirY);
  if (dirMag <= 1e-6) return false;

  const nx = dirX / dirMag;
  const ny = dirY / dirMag;

  handle.x = anchor.x + length * rel.sign * nx;
  handle.y = anchor.y + length * rel.sign * ny;

  if (rel.sign === 1) {
    handle.dist = Math.abs(handle.dist || length);
  }

  return true;
}

function getAnchorHandleIndices(anchorIndex: number): number[] {
  const graph = buildRelationGraph();
  const rels = graph.anchorToRelations.get(anchorIndex) ?? [];
  const unique = new Set<number>();
  for (const rel of rels) {
    unique.add(rel.handleIndex);
  }
  return Array.from(unique);
}

function propagateHandleChain(activeHandleIndex: number) {
  const graph = buildRelationGraph();
  const activeRels = graph.handleToRelations.get(activeHandleIndex);
  if (!activeRels || activeRels.length === 0) return;

  const anchorQueue: number[] = [];
  const inQueue = new Set<number>();

  for (const rel of activeRels) {
    if (setAnchorDirectionFromHandle(rel.anchorIndex, rel.handleIndex, rel.sign) && !inQueue.has(rel.anchorIndex)) {
      anchorQueue.push(rel.anchorIndex);
      inQueue.add(rel.anchorIndex);
    }
  }

  let iter = 0;
  const MAX_ITERS = 2000;
  while (anchorQueue.length > 0 && iter < MAX_ITERS) {
    iter++;
    const anchorIndex = anchorQueue.shift()!;
    inQueue.delete(anchorIndex);
    const rels = graph.anchorToRelations.get(anchorIndex) ?? [];

    for (const rel of rels) {
      if (rel.handleIndex === activeHandleIndex) continue;
      if (!moveHandleFromAnchorRelation(rel)) continue;

      const neighborRels = graph.handleToRelations.get(rel.handleIndex) ?? [];
      for (const nrel of neighborRels) {
        if (nrel.anchorIndex === anchorIndex) continue;
        if (!setAnchorDirectionFromHandle(nrel.anchorIndex, nrel.handleIndex, nrel.sign)) continue;
        if (!inQueue.has(nrel.anchorIndex)) {
          anchorQueue.push(nrel.anchorIndex);
          inQueue.add(nrel.anchorIndex);
        }
      }
    }
  }
}

function createPointSet(fieldX: number, fieldY: number) {
  if (controlpoints.length === 0) {
    const mainPoint: controlPoint = {
      x: fieldX,
      y: fieldY,
      index: 0,
      color: "red",
      dist: 0,
      isMain: true,
      anglex: 1,
      angley: 0,
      size: 8,
      rev: state,
    };
    controlpoints.push(mainPoint);
    redrawPoints();
    return;
  }

  let createdSegment = false;

  if (MODE == "Line") {
    createdSegment = insertline(fieldX, fieldY);
  } else if (MODE == "Bezier") {
    createdSegment = insertbezier(fieldX, fieldY);
  } else if (MODE == "Bezier3") {
    createdSegment = insertbezier3(fieldX, fieldY);
  } else if (MODE == "Arc") {
    createdSegment = insertarc(fieldX, fieldY);
  }

  if (!createdSegment) {
    redrawPoints();
    return;
  }

  appendSegmentEntry(sections.length - 1);

  console.log(controlpoints);
  console.log(sections);

  dispatchPathGeneration();
  redrawPoints();
}

function updateDrag(controlPoint: controlPoint, newX: number, newY: number) {
  if (!dragHistoryCaptured) {
    captureHistoryState();
    dragHistoryCaptured = true;
  }

  const index = controlPoint.index;

  const arcSection = sections.find(sec => sec.type === "arc" && sec.startcontrol + 1 === index);

  if (!controlPoint.isMain && arcSection) {
    controlPoint.x = newX;
    controlPoint.y = newY;
    updatesections();
    dispatchPathGeneration();
    return;
  }

  // Determine the index of the main controlPoint for this group (main points are at indexes that are multiples of 3)
  const groupStartIndex = Math.round(index / 3) * 3;
  const mainPoint = controlpoints[groupStartIndex];
  const deltaX = controlPoint.x - newX;
  const deltaY = controlPoint.y - newY;

  if (controlPoint.isMain) {
    const dx = newX - controlPoint.x;
    const dy = newY - controlPoint.y;

    controlPoint.x = newX;
    controlPoint.y = newY;

    // Keep attached handles translated with the anchor, then propagate the chain.
    const attachedHandles = getAnchorHandleIndices(index);
    for (const handleIndex of attachedHandles) {
      const handle = controlpoints[handleIndex];
      handle.x += dx;
      handle.y += dy;
    }

    for (const handleIndex of attachedHandles) {
      propagateHandleChain(handleIndex);
    }
  } else {
    const graph = buildRelationGraph();
    if (graph.handleToRelations.has(index)) {
      const primaryRel = graph.handleToRelations.get(index)![0];
      const anchorPoint = controlpoints[primaryRel.anchorIndex];
      controlPoint.x = newX;
      controlPoint.y = newY;
      controlPoint.dist = calculateSignedDistance(anchorPoint, controlPoint);

      propagateHandleChain(index);
    } else {
      // Fallback for non-sectioned handles.
      controlPoint.x = newX;
      controlPoint.y = newY;

      controlPoint.dist = calculateSignedDistance(mainPoint, controlPoint);
      const mag = Math.abs(controlPoint.dist);
      if (mag > 1e-6) {
        mainPoint.anglex = (controlPoint.x - mainPoint.x) / controlPoint.dist;
        mainPoint.angley = (controlPoint.y - mainPoint.y) / controlPoint.dist;
      }

      for (let i = -1; i <= 1; i++) {
        const controlPointIndex = groupStartIndex + i;
        if (controlPointIndex >= 0 && controlPointIndex < controlpoints.length) {
          if(controlpoints[controlPointIndex].isMain != true){
            updateControlPosition(mainPoint, controlpoints[controlPointIndex]);
          }
        }
      }
    }
  }

  updatesections();
  dispatchPathGeneration();
}

function calculateSignedDistance(pointA: controlPoint, pointB: controlPoint) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  const rawDist = Math.sqrt(dx * dx + dy * dy);
  const sign = pointB.dist !== 0 ? Math.abs(pointB.dist) / pointB.dist : 1;
  return rawDist * sign;
}

function updateControlPosition(mainPoint: controlPoint, controlPoint: controlPoint) {
  controlPoint.x = mainPoint.x + controlPoint.dist * (mainPoint.anglex || 0);
  controlPoint.y = mainPoint.y + controlPoint.dist * (mainPoint.angley || 0);
}

function dispatchPathGeneration() {
  computeBezierWaypoints();
  document.dispatchEvent(new CustomEvent("drawpath", { detail: { controlpoints } }));
}

function captureHistoryState() {
  historyPast.push({
    controlpoints: cloneControlPoints(controlpoints),
    sections: cloneSections(sections),
  });

  if (historyPast.length > HISTORY_LIMIT) {
    historyPast.shift();
  }

  historyFuture.length = 0;
}

function cloneControlPoints(points: controlPoint[]): controlPoint[] {
  return points.map((point) => ({ ...point }));
}

function cloneSections(items: typeof sections): typeof sections {
  return items.map((section) => ({ ...section }));
}

function restoreHistoryState(snapshot: HistorySnapshot) {
  activeDragPoint = null;
  isDraggingGlobal = false;
  isPanningField = false;
  hasPannedField = false;
  dragHistoryCaptured = false;

  controlpoints.splice(0, controlpoints.length, ...cloneControlPoints(snapshot.controlpoints));
  sections.splice(0, sections.length, ...cloneSections(snapshot.sections));
  reindexControlPoints();
  rebuildSegmentSidebar();
  resetsegment();

  pointdisplay.innerText = controlpoints.length > 0 ? "controlPoint selection restored" : "No controlPoint selected";
  dispatchPathGeneration();
  redrawPoints();
}

function undoHistory() {
  if (historyPast.length === 0) return;

  const currentSnapshot: HistorySnapshot = {
    controlpoints: cloneControlPoints(controlpoints),
    sections: cloneSections(sections),
  };
  const previousSnapshot = historyPast.pop();
  if (!previousSnapshot) return;

  historyFuture.push(currentSnapshot);
  restoreHistoryState(previousSnapshot);
}

function redoHistory() {
  const nextSnapshot = historyFuture.pop();
  if (!nextSnapshot) return;

  historyPast.push({
    controlpoints: cloneControlPoints(controlpoints),
    sections: cloneSections(sections),
  });
  restoreHistoryState(nextSnapshot);
}

function handleHistoryShortcut(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
    return;
  }

  const key = e.key.toLowerCase();
  const undoShortcut = (e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey;
  const redoShortcut = (e.ctrlKey || e.metaKey) && (key === "y" || (key === "z" && e.shiftKey));

  if (undoShortcut) {
    e.preventDefault();
    undoHistory();
  } else if (redoShortcut) {
    e.preventDefault();
    redoHistory();
  }
}

function appendSegmentEntry(segmentIndex: number) {
  if (!segcontainer || !exampleseg) return;

  const newSeg = exampleseg.cloneNode(true) as HTMLDivElement;
  newSeg.id = "segment" + segmentIndex;
  newSeg.hidden = false;

  const label = newSeg.querySelector("label");
  label!.textContent = "Segment" + (segmentIndex + 1);

  const button = newSeg.querySelector("button");
  button?.addEventListener("click", () => {
    if (!sections[segmentIndex]) return;
    sections[segmentIndex].rev = !sections[segmentIndex].rev;
    updatesections();
    computeBezierWaypoints();
  });

  newSeg.addEventListener("mouseenter", () => {
    newSeg.style.backgroundColor = "lightgrey";
    selectSegment(segmentIndex);
  });

  newSeg.addEventListener("mouseleave", () => {
    deselectSegment(segmentIndex);
    newSeg.style.backgroundColor = "grey";
  });

  segcontainer.append(newSeg);
}

function rebuildSegmentSidebar() {
  if (!segcontainer || !exampleseg) return;

  const existingSegments = Array.from(segcontainer.querySelectorAll(".segment"));
  for (const segment of existingSegments) {
    if (segment.id !== "exampleseg") {
      segment.remove();
    }
  }

  for (let i = 0; i < sections.length; i++) {
    appendSegmentEntry(i);
  }
}

let showPoints = true; // Flag to track visibility

document.getElementById("togglePoints")?.addEventListener("click", () => {
  showPoints = !showPoints;
  redrawPoints();
});

function redrawPoints() {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas (and any other canvas reset you need)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dispatch event to redraw background if needed
  document.dispatchEvent(new CustomEvent("redrawCanvas"));

}
// Export controlpoints for other modules

document.getElementById("clear")?.addEventListener("click", () => {
  captureHistoryState();
  controlpoints.length = 0;
  redrawPoints();
  dispatchPathGeneration();
});


function insertbezier(fieldX: number, fieldY: number): boolean {

  let idx = controlpoints.length - 1;
  let prevx = controlpoints[idx].x;
  let prevy = controlpoints[idx].y;
  let offset = (100 / 3) * 144 / canvas.width; // now in field units (0-144 range)
  const segDx = fieldX - prevx;
  const segDy = fieldY - prevy;
  const segLen = Math.hypot(segDx, segDy);
  const dirX = segLen > 1e-6 ? segDx / segLen : (controlpoints[idx].anglex ?? 1);
  const dirY = segLen > 1e-6 ? segDy / segLen : (controlpoints[idx].angley ?? 0);

  // Create first 2 control points
  const controlPoint1: controlPoint = {
    x: prevx + offset * controlpoints[idx].anglex!,
    y: prevy + offset * controlpoints[idx].angley!,
    index: controlpoints.length,
    color: "blue",
    dist: offset,
    size: 6,
  };
  controlpoints.push(controlPoint1);

  const controlPoint2: controlPoint = {
    x: fieldX - offset * dirX,
    y: fieldY - offset * dirY,
    index: controlpoints.length,
    color: "blue",
    dist: -offset,
    size: 6,
  };
  controlpoints.push(controlPoint2);

  const mainPoint: controlPoint = {
    x: fieldX,
    y: fieldY,
    index: controlpoints.length,
    color: "red",
    dist: 0,
    isMain: true,
    anglex: dirX,
    angley: dirY,
    size: 8,
    rev: state

  };
  controlpoints.push(mainPoint);

  pushSection(idx, idx+ 3, "bezier", false);
  return true;

}

function insertline(fieldX: number, fieldY: number): boolean {

  let idx = controlpoints.length - 1;
  const prev = controlpoints[idx];
  const dx = fieldX - prev.x;
  const dy = fieldY - prev.y;
  const mag = Math.hypot(dx, dy);
  const dirX = mag > 1e-6 ? dx / mag : (prev.anglex ?? 1);
  const dirY = mag > 1e-6 ? dy / mag : (prev.angley ?? 0);

  const mainPoint: controlPoint = {
    x: fieldX,
    y: fieldY,
    index: controlpoints.length,
    color: "red",
    dist: 0,
    isMain: true,
    anglex: dirX,
    angley: dirY,
    size: 8,
    rev: state
  };
  controlpoints.push(mainPoint);

  pushSection(idx, idx+ 1, "line", false);
  return true;

}

function insertbezier3(fieldX: number, fieldY: number): boolean {
  const startIndex = controlpoints.length - 1;
  const startPoint = controlpoints[startIndex];
  const dx = fieldX - startPoint.x;
  const dy = fieldY - startPoint.y;
  const length = Math.hypot(dx, dy);
  const dir = getAnchorDirection(startPoint, fieldX, fieldY);
  const defaultHandle = (100 / 3) * 144 / canvas.width;
  const handleDist = Math.min(defaultHandle, length * 0.75);
  const autoMid = {
    x: startPoint.x + dir.x * handleDist,
    y: startPoint.y + dir.y * handleDist,
  };

  const midControl: controlPoint = {
    x: autoMid.x,
    y: autoMid.y,
    index: controlpoints.length,
    color: "blue",
    dist: handleDist,
    size: 7,
    isMain: false,
  };
  controlpoints.push(midControl);

  const endPoint: controlPoint = {
    x: fieldX,
    y: fieldY,
    index: controlpoints.length,
    color: "red",
    dist: 0,
    isMain: true,
    anglex: dir.x,
    angley: dir.y,
    size: 8,
    rev: state
  };
  controlpoints.push(endPoint);
  pushSection(startIndex, endPoint.index, "bezier3", false);
  return true;
}

function insertarc(fieldX: number, fieldY: number): boolean {
  const startIndex = controlpoints.length - 1;
  const startPoint = controlpoints[startIndex];
  const autoMid = getAutoMiddleControlPoint(startPoint, fieldX, fieldY, 0.35);

  const midControl: controlPoint = {
    x: autoMid.x,
    y: autoMid.y,
    index: controlpoints.length,
    color: "orange",
    dist: 0,
    size: 7,
    isMain: false,
  };
  controlpoints.push(midControl);

  const endPoint: controlPoint = {
    x: fieldX,
    y: fieldY,
    index: controlpoints.length,
    color: "red",
    dist: 0,
    isMain: true,
    anglex: fieldX - autoMid.x,
    angley: fieldY - autoMid.y,
    size: 8,
    rev: state
  };

  const endMag = Math.hypot(endPoint.anglex ?? 0, endPoint.angley ?? 0);
  if (endMag > 1e-6) {
    endPoint.anglex = (endPoint.anglex ?? 0) / endMag;
    endPoint.angley = (endPoint.angley ?? 0) / endMag;
  } else {
    endPoint.anglex = 1;
    endPoint.angley = 0;
  }
  controlpoints.push(endPoint);
  pushSection(startIndex, endPoint.index, "arc", false);
  return true;
}

function pushSection(start: number, end: number, type: "bezier" | "bezier3" | "line" | "arc", rev: boolean){
  const angles = getSectionAngles(start, end, type);

  sections.push(
  { startcontrol: start,
    endcontrol: end,
    type: type,
    rev: rev,

    startangle: angles.startAngle,
    endangle: angles.endAngle,

    startx: controlpoints[start].x,
    starty: controlpoints[start].y,
    endx: controlpoints[end].x,
    endy: controlpoints[end].y,
  });
}

function updatesections(){
  for(let i = 0; i < sections.length; i++){
    let start = sections[i].startcontrol;
    let end = sections[i].endcontrol
    let type = sections[i].type;
    let rev= sections[i].rev
    const angles = getSectionAngles(start, end, type);
    
    sections[i] = 
    { startcontrol: start,
      endcontrol: end,
      type: type,
      rev: rev,
  
      startangle: angles.startAngle,
      endangle: angles.endAngle,
  
      startx: controlpoints[start].x,
      starty: controlpoints[start].y,
      endx: controlpoints[end].x,
      endy: controlpoints[end].y,
    }

    if(sections[i].rev){
      sections[i].startangle += PI;
      sections[i].endangle += PI;
    }
  }
}