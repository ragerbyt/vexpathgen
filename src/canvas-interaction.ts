import { controlPoint, section, FlagModel } from "./editor-state";

let isDraggingGlobal = false;
let activeDragPoint: controlPoint | null = null;
let dragHistoryCaptured = false;
let suppressNextPathRowClick = false;

type HistorySnapshot = {
  controlpoints: controlPoint[];
  sections: typeof sections;
  flags: FlagModel[];
};

const historyPast: HistorySnapshot[] = [];
const historyFuture: HistorySnapshot[] = [];
const HISTORY_LIMIT = 100;


const state = false;

//so if top = 20; left = 20 ;then top left is chopped off.


const pointdisplay = document.getElementById("point-coordinates") as HTMLDivElement | null;

import { computePathProfile } from "./path-profile";
import { canvas, controlpoints, sections, pathpoints, paths, activePathIndex, createPathModel, getActivePath, replacePaths, setActivePathIndex, PathModel, resetFieldView, FIELD_WIDTH_INCHES, flags, MAX_VELOCITY } from "./editor-state";
import { canvasToFieldX, canvasToFieldY, getFieldView, panFieldView, zoomFieldView } from "./editor-state";
import { clampFlagPathDistance, sortFlagsByDerivedTime } from "./path-flags";
import { clearFlagState, clearSegmentState, clearSelectedSegment, deselectSegment, hoveredFlagId, hoveredSegmentIndex, refreshSegmentRanges, resetsegment, selectSegment, selectedFlagId, selectedSegmentIndex, setHoveredFlag, setSelectedFlag, setSelectedSegment } from "./interaction-state";
import { clearGraphInteractionState, getPreferredNewFlagDistance, plot, renderGraphHoverOverlay } from "./velocity-graph";
import { MODE } from "./drawing-mode";
import { PI } from "chart.js/helpers";
document.addEventListener("DOMContentLoaded", initCanvas);
document.addEventListener("capture-editor-history", () => captureHistoryState());
document.addEventListener("refresh-path-tree", () => rebuildPathTree());
document.addEventListener("path-profile-updated", () => rebuildPathTree());
document.addEventListener("recompute-path-profile", () => dispatchPathGeneration());

document.addEventListener("DOMContentLoaded", () => {
  rebuildPathTree();
  updatePathNameInput();

  addPathButton?.addEventListener("click", () => {
    const newPath = createPathModel(getDefaultPathName(paths.length));
    paths.push(newPath);
    setActivePath(paths.length - 1);
  });

  pathNameInput?.addEventListener("input", () => {
    if (paths.length === 0) {
      pathNameInput.value = "";
      return;
    }
    const active = getActivePath();
    const nextValue = pathNameInput.value.trim();
    if (nextValue.length > 0) {
      active.name = nextValue;
    } else {
      updatePathNameInput();
    }
    rebuildPathTree();
  });
});

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
  if (paths.length === 0) {
    const newPath = createPathModel(getDefaultPathName(0));
    paths.push(newPath);
    setActivePath(0);
  }
  // If a drag event just occurred, do not create new points.
  if (isDraggingGlobal) {
    isDraggingGlobal = false;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Convert canvas coordinates to field coordinates (center-origin)
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
    if (pointdisplay) {
      pointdisplay.innerText = temptext;
    }
  }else{
    if (pointdisplay) {
      pointdisplay.innerText = "No controlPoint selected";
    }
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
    updateDrag(activeDragPoint, newFieldX, newFieldY, e.shiftKey);
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

const pathTree = document.getElementById("path-tree");
const addPathButton = document.getElementById("addPath") as HTMLButtonElement | null;
const pathNameInput = document.getElementById("pathNameInput") as HTMLInputElement | null;
const deletePathModal = document.getElementById("path-delete-modal") as HTMLDivElement | null;
const deletePathMessage = document.getElementById("path-delete-message") as HTMLParagraphElement | null;
const deletePathConfirm = document.getElementById("path-delete-confirm") as HTMLButtonElement | null;
const deletePathCancel = document.getElementById("path-delete-cancel") as HTMLButtonElement | null;
const deletePathScrim = document.getElementById("path-delete-scrim") as HTMLDivElement | null;
let pendingDeletePathIndex: number | null = null;

function openDeletePathModal(pathIndex: number) {
  const path = paths[pathIndex];
  if (!path) return;
  if (!deletePathModal || !deletePathMessage || !deletePathConfirm || !deletePathCancel) {
    deletePathAtIndex(pathIndex);
    return;
  }

  pendingDeletePathIndex = pathIndex;
  deletePathMessage.textContent = `Delete "${path.name}"? This will remove the path and its segments.`;
  deletePathModal.classList.remove("is-hidden");
  deletePathConfirm.focus();
}

function closeDeletePathModal() {
  pendingDeletePathIndex = null;
  deletePathModal?.classList.add("is-hidden");
}

deletePathCancel?.addEventListener("click", () => {
  closeDeletePathModal();
});

deletePathScrim?.addEventListener("click", () => {
  closeDeletePathModal();
});

deletePathConfirm?.addEventListener("click", () => {
  if (pendingDeletePathIndex === null) return;
  deletePathAtIndex(pendingDeletePathIndex);
  closeDeletePathModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!deletePathModal || deletePathModal.classList.contains("is-hidden")) return;
  closeDeletePathModal();
});

function getDefaultPathName(index: number): string {
  return `Path ${index + 1}`;
}

function getDefaultSegmentName(index: number): string {
  return `Segment ${index + 1}`;
}

function ensurePathName(index: number) {
  if (!paths[index].name || paths[index].name.trim().length === 0) {
    paths[index].name = getDefaultPathName(index);
  }
}

function ensureSegmentName(segmentIndex: number, sectionList: section[]) {
  if (!sectionList[segmentIndex].name || sectionList[segmentIndex].name!.trim().length === 0) {
    sectionList[segmentIndex].name = getDefaultSegmentName(segmentIndex);
  }
}

function sortFlags(
  flagList: FlagModel[],
  sectionList: section[] = sections,
  pathpointList = pathpoints
) {
  sortFlagsByDerivedTime(flagList, sectionList, pathpointList);
}

function cloneFlags(items: FlagModel[]): FlagModel[] {
  return items.map((flag) => ({ ...flag }));
}

function normalizeFlag(flag: FlagModel, pathpointList = pathpoints): FlagModel {
  return {
    id: flag.id,
    pathDistance: clampFlagPathDistance(flag.pathDistance, pathpointList),
    type: flag.type ?? "string",
    label: flag.label ?? "",
    velocityLimit: flag.type === "velocity" ? (flag.velocityLimit ?? MAX_VELOCITY) : null,
  };
}

function createFlagId(): string {
  return `flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getClampedFlagDistance(pathDistance: number): number {
  return clampFlagPathDistance(pathDistance, pathpoints);
}

function updatePathNameInput() {
  if (!pathNameInput) return;
  if (paths.length === 0) {
    pathNameInput.value = "";
    pathNameInput.disabled = true;
    return;
  }
  pathNameInput.disabled = false;
  ensurePathName(activePathIndex);
  const active = getActivePath();
  pathNameInput.value = active.name;
}

function startInlineRename(
  label: HTMLSpanElement,
  initialValue: string,
  onCommit: (nextValue: string) => void
) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = initialValue;
  input.className = "rename-input";

  const finalize = (save: boolean) => {
    const nextValue = input.value.trim();
    if (save && nextValue.length > 0) {
      onCommit(nextValue);
    }
    input.replaceWith(label);
  };

  input.addEventListener("blur", () => finalize(true));
  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      finalize(true);
    } else if (event.key === "Escape") {
      input.value = initialValue;
      finalize(false);
    }
  });

  label.replaceWith(input);
  input.focus();
  input.select();
}

function reindexControlPoints() {
  for (let i = 0; i < controlpoints.length; i++) {
    controlpoints[i].index = i;
  }
}


function getSectionAngles(start: number, end: number, type: "bezier" | "line"): { startAngle: number; endAngle: number } {
  if (type === "line") {
    const angle = Math.atan2(controlpoints[end].y - controlpoints[start].y, controlpoints[end].x - controlpoints[start].x);
    return { startAngle: angle, endAngle: angle };
  }

  const startHandle = controlpoints[start + 1] ?? controlpoints[start];
  const endHandle = controlpoints[end - 1] ?? controlpoints[end];
  const startAngle = Math.atan2(startHandle.y - controlpoints[start].y, startHandle.x - controlpoints[start].x);
  const endAngle = Math.atan2(controlpoints[end].y - endHandle.y, controlpoints[end].x - endHandle.x);
  return { startAngle, endAngle };
}


type BezierIndices = {
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
};

function getBezierIndices(sec: section): BezierIndices | null {
  if (sec.type !== "bezier") return null;
  const span = sec.endcontrol - sec.startcontrol;
  if (span < 5) return null;
  return {
    p0: sec.startcontrol,
    p1: sec.startcontrol + 1,
    p2: sec.startcontrol + 2,
    p3: sec.endcontrol - 2,
    p4: sec.endcontrol - 1,
    p5: sec.endcontrol,
  };
}

function getHandlesForAnchor(anchorIndex: number): number[] {
  const handles: number[] = [];
  for (const sec of sections) {
    if (sec.type !== "bezier") continue;
    if (sec.startcontrol === anchorIndex) {
      handles.push(sec.startcontrol + 1, sec.startcontrol + 2);
    }
    if (sec.endcontrol === anchorIndex) {
      handles.push(sec.endcontrol - 2, sec.endcontrol - 1);
    }
  }
  return Array.from(new Set(handles.filter((idx) => idx >= 0 && idx < controlpoints.length)));
}

function enforceG2Forward(prevSec: section, nextSec: section) {
  const prev = getBezierIndices(prevSec);
  const next = getBezierIndices(nextSec);
  if (!prev || !next) return;

  const p3 = controlpoints[prev.p3];
  const p4 = controlpoints[prev.p4];
  const p5 = controlpoints[prev.p5];
  const q0 = controlpoints[next.p0];
  const q1 = controlpoints[next.p1];
  const q2 = controlpoints[next.p2];

  q0.x = p5.x;
  q0.y = p5.y;
  q1.x = 2 * p5.x - p4.x;
  q1.y = 2 * p5.y - p4.y;

  const seamSecond = {
    x: p5.x - 2 * p4.x + p3.x,
    y: p5.y - 2 * p4.y + p3.y,
  };
  q2.x = seamSecond.x + 2 * q1.x - q0.x;
  q2.y = seamSecond.y + 2 * q1.y - q0.y;
}

function enforceG2Backward(prevSec: section, nextSec: section) {
  const prev = getBezierIndices(prevSec);
  const next = getBezierIndices(nextSec);
  if (!prev || !next) return;

  const p3 = controlpoints[prev.p3];
  const p4 = controlpoints[prev.p4];
  const p5 = controlpoints[prev.p5];
  const q0 = controlpoints[next.p0];
  const q1 = controlpoints[next.p1];
  const q2 = controlpoints[next.p2];

  p5.x = q0.x;
  p5.y = q0.y;
  p4.x = 2 * p5.x - q1.x;
  p4.y = 2 * p5.y - q1.y;

  const seamSecond = {
    x: q2.x - 2 * q1.x + q0.x,
    y: q2.y - 2 * q1.y + q0.y,
  };
  p3.x = seamSecond.x + 2 * p4.x - p5.x;
  p3.y = seamSecond.y + 2 * p4.y - p5.y;
}

function enforceG2ForDragIndex(index: number) {
  let secIndex = -1;
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (sec.type !== "bezier") continue;
    if (index >= sec.startcontrol && index <= sec.endcontrol) {
      secIndex = i;
      break;
    }
  }
  if (secIndex === -1) return;

  const sec = sections[secIndex];
  const indices = getBezierIndices(sec);
  if (!indices) return;

  const isNearStart = index <= indices.p2;
  const isNearEnd = index >= indices.p3;

  const prev = secIndex > 0 ? sections[secIndex - 1] : null;
  const next = secIndex < sections.length - 1 ? sections[secIndex + 1] : null;

  if (isNearStart && prev && prev.type === "bezier" && prev.endcontrol === sec.startcontrol && prev.rev === sec.rev) {
    enforceG2Backward(prev, sec);
  }
  if (isNearEnd && next && next.type === "bezier" && next.startcontrol === sec.endcontrol && next.rev === sec.rev) {
    enforceG2Forward(sec, next);
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
  }

  if (!createdSegment) {
    redrawPoints();
    return;
  }

  rebuildPathTree();

  console.log(controlpoints);
  console.log(sections);

  dispatchPathGeneration();
  redrawPoints();
}

function computeHandleSimilarity(anchor: controlPoint, near: controlPoint, far: controlPoint): { ratio: number; angle: number } {
  const ax = near.x - anchor.x;
  const ay = near.y - anchor.y;
  const bx = far.x - anchor.x;
  const by = far.y - anchor.y;
  const lenA = Math.hypot(ax, ay);
  const lenB = Math.hypot(bx, by);
  const ratio = lenA > 1e-9 ? lenB / lenA : 0;
  const dot = ax * bx + ay * by;
  const cross = ax * by - ay * bx;
  const angle = lenA > 1e-9 && lenB > 1e-9 ? Math.atan2(cross, dot) : 0;
  return { ratio, angle };
}

function getShiftHandleLink(index: number): {
  anchor: controlPoint;
  near: controlPoint;
  far: controlPoint;
  ratio: number;
  angle: number;
  draggedIsNear: boolean;
} | null {
  for (const sec of sections) {
    if (sec.type !== "bezier") continue;
    const indices = getBezierIndices(sec);
    if (!indices) continue;

    if (index === indices.p1 || index === indices.p2) {
      const anchor = controlpoints[indices.p0];
      const near = controlpoints[indices.p1];
      const far = controlpoints[indices.p2];
      const { ratio, angle } = computeHandleSimilarity(anchor, near, far);
      return { anchor, near, far, ratio, angle, draggedIsNear: index === indices.p1 };
    }

    if (index === indices.p4 || index === indices.p3) {
      const anchor = controlpoints[indices.p5];
      const near = controlpoints[indices.p4];
      const far = controlpoints[indices.p3];
      const { ratio, angle } = computeHandleSimilarity(anchor, near, far);
      return { anchor, near, far, ratio, angle, draggedIsNear: index === indices.p4 };
    }
  }

  return null;
}

function updateDrag(controlPoint: controlPoint, newX: number, newY: number, keepRatio: boolean) {
  if (!dragHistoryCaptured) {
    captureHistoryState();
    dragHistoryCaptured = true;
  }

  const index = controlPoint.index;
  const link = keepRatio ? getShiftHandleLink(index) : null;

  if (controlPoint.isMain) {
    const dx = newX - controlPoint.x;
    const dy = newY - controlPoint.y;
    controlPoint.x = newX;
    controlPoint.y = newY;

    const attachedHandles = getHandlesForAnchor(index);
    for (const handleIndex of attachedHandles) {
      const handle = controlpoints[handleIndex];
      handle.x += dx;
      handle.y += dy;
    }
  } else {
    if (link && link.ratio > 0) {
      if (link.draggedIsNear) {
        link.near.x = newX;
        link.near.y = newY;
        const vx = link.near.x - link.anchor.x;
        const vy = link.near.y - link.anchor.y;
        const cosA = Math.cos(link.angle);
        const sinA = Math.sin(link.angle);
        const rx = vx * cosA - vy * sinA;
        const ry = vx * sinA + vy * cosA;
        link.far.x = link.anchor.x + link.ratio * rx;
        link.far.y = link.anchor.y + link.ratio * ry;
      } else {
        link.far.x = newX;
        link.far.y = newY;
        const vx = link.far.x - link.anchor.x;
        const vy = link.far.y - link.anchor.y;
        const cosA = Math.cos(-link.angle);
        const sinA = Math.sin(-link.angle);
        const rx = vx * cosA - vy * sinA;
        const ry = vx * sinA + vy * cosA;
        if (link.ratio > 1e-6) {
          link.near.x = link.anchor.x + rx / link.ratio;
          link.near.y = link.anchor.y + ry / link.ratio;
        }
      }
    } else {
      controlPoint.x = newX;
      controlPoint.y = newY;
    }
  }

  enforceG2ForDragIndex(index);
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
  if (paths.length === 0) return;
  computePathProfile();
  refreshSegmentRanges();
  document.dispatchEvent(new CustomEvent("drawpath", { detail: { controlpoints } }));
}

function captureHistoryState() {
  historyPast.push({
    controlpoints: cloneControlPoints(controlpoints),
    sections: cloneSections(sections),
    flags: cloneFlags(flags),
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

function resetHistoryState() {
  historyPast.length = 0;
  historyFuture.length = 0;
  dragHistoryCaptured = false;
  activeDragPoint = null;
}

function restoreHistoryState(snapshot: HistorySnapshot) {
  activeDragPoint = null;
  isDraggingGlobal = false;
  isPanningField = false;
  hasPannedField = false;
  dragHistoryCaptured = false;

  controlpoints.splice(0, controlpoints.length, ...cloneControlPoints(snapshot.controlpoints));
  sections.splice(0, sections.length, ...cloneSections(snapshot.sections));
  flags.splice(0, flags.length, ...cloneFlags(snapshot.flags));
  reindexControlPoints();
  clearSegmentState();
  clearFlagState();

  if (pointdisplay) {
    pointdisplay.innerText = controlpoints.length > 0 ? "controlPoint selection restored" : "No controlPoint selected";
  }
  dispatchPathGeneration();
  flags.splice(0, flags.length, ...flags.map((flag) => normalizeFlag(flag)));
  sortFlags(flags);
  rebuildPathTree();
  redrawPoints();
}

function undoHistory() {
  if (historyPast.length === 0) return;

  const currentSnapshot: HistorySnapshot = {
    controlpoints: cloneControlPoints(controlpoints),
    sections: cloneSections(sections),
    flags: cloneFlags(flags),
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
    flags: cloneFlags(flags),
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

function setActivePath(pathIndex: number) {
  if (paths.length === 0) return;
  setActivePathIndex(pathIndex);
  resetHistoryState();
  clearSegmentState();
  clearFlagState();
  clearGraphInteractionState();
  updatePathNameInput();
  rebuildPathTree();
  dispatchPathGeneration();
  redrawPoints();
}

function deletePathAtIndex(pathIndex: number) {
  if (pathIndex < 0 || pathIndex >= paths.length) return;

  const wasActive = pathIndex === activePathIndex;
  paths.splice(pathIndex, 1);

  resetHistoryState();
  clearSegmentState();
  clearFlagState();
  clearGraphInteractionState();

  if (paths.length === 0) {
    setActivePathIndex(0);
    updatePathNameInput();
    rebuildPathTree();
    renderGraphHoverOverlay();
    redrawPoints();
    return;
  }

  let nextActiveIndex = activePathIndex;
  if (wasActive) {
    nextActiveIndex = Math.max(0, pathIndex - 1);
  } else if (pathIndex < activePathIndex) {
    nextActiveIndex = activePathIndex - 1;
  }

  setActivePathIndex(Math.min(nextActiveIndex, paths.length - 1));
  updatePathNameInput();
  rebuildPathTree();
  dispatchPathGeneration();
  renderGraphHoverOverlay();
  redrawPoints();
}

function clearPathAtIndex(pathIndex: number) {
  const path = paths[pathIndex];
  if (!path) return;

  if (pathIndex === activePathIndex) {
    captureHistoryState();
    controlpoints.length = 0;
    sections.length = 0;
    pathpoints.length = 0;
    flags.length = 0;
    clearSegmentState();
    clearFlagState();
    rebuildPathTree();
    renderGraphHoverOverlay();
    plot();
    redrawPoints();
    dispatchPathGeneration();
    return;
  }

  path.controlpoints.length = 0;
  path.sections.length = 0;
  path.pathpoints.length = 0;
  path.flags.length = 0;
}

export function replaceEditorPaths(nextPaths: PathModel[], activeIndex = 0) {
  for (const path of nextPaths) {
    path.flags = path.flags.map((flag) => normalizeFlag(flag, path.pathpoints));
    sortFlags(path.flags, path.sections, path.pathpoints);
  }

  resetHistoryState();
  clearSegmentState();
  clearFlagState();
  clearGraphInteractionState();
  resetFieldView();
  isDraggingGlobal = false;
  isPanningField = false;
  hasPannedField = false;
  suppressNextPathRowClick = false;

  replacePaths(nextPaths);

  if (paths.length === 0) {
    updatePathNameInput();
    rebuildPathTree();
    refreshSegmentRanges();
    if (pointdisplay) {
      pointdisplay.innerText = "No controlPoint selected";
    }
    renderGraphHoverOverlay();
    redrawPoints();
    return;
  }

  for (let i = 0; i < paths.length; i++) {
    setActivePathIndex(i);
    computePathProfile();
    paths[i].flags = paths[i].flags.map((flag) => normalizeFlag(flag, pathpoints));
    sortFlags(paths[i].flags, paths[i].sections, pathpoints);
  }

  const nextActiveIndex = Math.max(0, Math.min(activeIndex, paths.length - 1));
  setActivePathIndex(nextActiveIndex);
  updatePathNameInput();
  rebuildPathTree();
  refreshSegmentRanges();
  if (pointdisplay) {
    pointdisplay.innerText = controlpoints.length > 0 ? "controlPoint selection restored" : "No controlPoint selected";
  }
  renderGraphHoverOverlay();
  redrawPoints();
}

function activatePathForSegment(pathIndex: number) {
  if (pathIndex !== activePathIndex) {
    setActivePath(pathIndex);
  }
}

function buildSegmentEntry(pathIndex: number, segmentIndex: number, sectionList: section[]): HTMLDivElement {
  const segment = document.createElement("div");
  segment.className = "segment";

  const nameWrap = document.createElement("div");
  nameWrap.className = "segment-name";

  const nameLabel = document.createElement("span");
  nameLabel.className = "segment-label";

  const typeLabel = document.createElement("span");
  typeLabel.className = "segment-type";

  const reverseButton = document.createElement("button");
  reverseButton.className = "segment-reverse";
  reverseButton.textContent = "Reverse Direction";

  nameWrap.append(nameLabel);
  segment.append(nameWrap, typeLabel, reverseButton);

  ensureSegmentName(segmentIndex, sectionList);
  nameLabel.textContent = sectionList[segmentIndex].name || getDefaultSegmentName(segmentIndex);
  typeLabel.textContent = sectionList[segmentIndex].type === "bezier" ? "Bezier" : "Line";

  if (pathIndex !== activePathIndex) {
    segment.classList.add("is-inactive");
  }
  if (pathIndex === activePathIndex && segmentIndex === selectedSegmentIndex) {
    segment.classList.add("is-selected");
  }
  if (pathIndex === activePathIndex && segmentIndex === hoveredSegmentIndex) {
    segment.classList.add("is-hovered");
  }

  reverseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    activatePathForSegment(pathIndex);
    if (pathIndex !== activePathIndex || !sectionList[segmentIndex]) return;
    captureHistoryState();
    sectionList[segmentIndex].rev = !sectionList[segmentIndex].rev;
    updatesections();
    dispatchPathGeneration();
    rebuildPathTree();
    renderGraphHoverOverlay();
    redrawPoints();
  });

  segment.addEventListener("click", (event) => {
    event.stopPropagation();
    activatePathForSegment(pathIndex);
    clearFlagState();
    if (pathIndex === activePathIndex && segmentIndex === selectedSegmentIndex) {
      clearSelectedSegment();
    } else {
      setSelectedSegment(segmentIndex);
    }
    resetsegment();
    rebuildPathTree();
    renderGraphHoverOverlay();
    redrawPoints();
  });

  nameLabel.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    suppressNextPathRowClick = true;
    activatePathForSegment(pathIndex);
    if (pathIndex !== activePathIndex) return;
    startInlineRename(nameLabel, nameLabel.textContent || "", (nextValue) => {
      sectionList[segmentIndex].name = nextValue;
      nameLabel.textContent = nextValue;
      rebuildPathTree();
    });
  });

  segment.addEventListener("mouseenter", () => {
    if (pathIndex !== activePathIndex) return;
    setHoveredFlag(null);
    selectSegment(segmentIndex);
    plot();
    renderGraphHoverOverlay();
    redrawPoints();
  });

  segment.addEventListener("mouseleave", () => {
    if (pathIndex !== activePathIndex) return;
    deselectSegment(segmentIndex);
    plot();
    renderGraphHoverOverlay();
    redrawPoints();
  });

  return segment;
}

function buildFlagEntry(pathIndex: number, flag: FlagModel, flagIndex: number): HTMLDivElement {
  const normalizedFlag = normalizeFlag(flag);
  Object.assign(flag, normalizedFlag);

  const flagEntry = document.createElement("div");
  flagEntry.className = "flag";
  flagEntry.classList.add(flag.type === "velocity" ? "is-velocity" : "is-string");

  if (pathIndex !== activePathIndex) {
    flagEntry.classList.add("is-inactive");
  }
  if (pathIndex === activePathIndex && flag.id === selectedFlagId) {
    flagEntry.classList.add("is-selected");
  }
  if (pathIndex === activePathIndex && flag.id === hoveredFlagId) {
    flagEntry.classList.add("is-hovered");
  }

  const badge = document.createElement("span");
  badge.className = "flag-badge";
  badge.textContent = String(flagIndex + 1);

  const typeSelect = document.createElement("select");
  typeSelect.className = "flag-type-select";
  typeSelect.innerHTML = `
    <option value="string">String</option>
    <option value="velocity">Velocity</option>
  `;
  typeSelect.value = flag.type;

  const input = document.createElement("input");
  input.className = "flag-input";
  input.type = flag.type === "velocity" ? "number" : "text";
  input.placeholder = flag.type === "velocity" ? "Velocity limit" : "Flag code";
  input.value = flag.type === "velocity" ? String(flag.velocityLimit ?? MAX_VELOCITY) : flag.label;

  let committedValue = input.value;
  let inputHistoryCaptured = false;

  input.addEventListener("focus", (event) => {
    event.stopPropagation();
    committedValue = input.value;
    inputHistoryCaptured = false;
    activatePathForSegment(pathIndex);
    setSelectedFlag(flag.id);
    clearSelectedSegment();
    plot();
  });

  typeSelect.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  typeSelect.addEventListener("change", (event) => {
    event.stopPropagation();
    captureHistoryState();
    flag.type = typeSelect.value === "velocity" ? "velocity" : "string";
    if (flag.type === "velocity") {
      flag.velocityLimit = flag.velocityLimit ?? MAX_VELOCITY;
      input.type = "number";
      input.placeholder = "Velocity limit";
      input.value = String(flag.velocityLimit);
    } else {
      flag.velocityLimit = null;
      input.type = "text";
      input.placeholder = "Flag code";
      input.value = flag.label;
    }
    committedValue = input.value;
    inputHistoryCaptured = false;
    dispatchPathGeneration();
    rebuildPathTree();
    plot();
    renderGraphHoverOverlay();
  });

  input.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  input.addEventListener("input", (event) => {
    event.stopPropagation();
    if (!inputHistoryCaptured && input.value !== committedValue) {
      captureHistoryState();
      inputHistoryCaptured = true;
    }
    if (flag.type === "velocity") {
      const nextValue = Number(input.value);
      flag.velocityLimit = Number.isFinite(nextValue) ? nextValue : null;
      dispatchPathGeneration();
      plot();
      renderGraphHoverOverlay();
    } else {
      flag.label = input.value;
    }
  });

  input.addEventListener("change", (event) => {
    event.stopPropagation();
    committedValue = input.value;
    if (flag.type === "velocity") {
      const nextValue = Number(input.value);
      flag.velocityLimit = Number.isFinite(nextValue) ? nextValue : MAX_VELOCITY;
      input.value = String(flag.velocityLimit);
      dispatchPathGeneration();
      plot();
      renderGraphHoverOverlay();
    } else {
      flag.label = input.value;
    }
  });

  flagEntry.addEventListener("click", (event) => {
    event.stopPropagation();
    activatePathForSegment(pathIndex);
    clearSelectedSegment();
    setSelectedFlag(flag.id === selectedFlagId ? null : flag.id);
    resetsegment();
    rebuildPathTree();
    plot();
    renderGraphHoverOverlay();
    redrawPoints();
  });

  flagEntry.addEventListener("mouseenter", () => {
    if (pathIndex !== activePathIndex) return;
    setHoveredFlag(flag.id);
    plot();
    renderGraphHoverOverlay();
  });

  flagEntry.addEventListener("mouseleave", () => {
    if (pathIndex !== activePathIndex) return;
    setHoveredFlag(null);
    plot();
    renderGraphHoverOverlay();
  });

  flagEntry.append(badge, typeSelect, input);
  return flagEntry;
}

function buildFlagSection(pathIndex: number, flagList: FlagModel[]): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "flag-section";

  const title = document.createElement("div");
  title.className = "subsection-title";
  title.textContent = "Flags";

  const list = document.createElement("div");
  list.className = "flag-list";

  for (let i = 0; i < flagList.length; i++) {
    list.append(buildFlagEntry(pathIndex, flagList[i], i));
  }

  wrapper.append(title, list);
  return wrapper;
}

function buildPathEntry(pathIndex: number): HTMLDivElement {
  const pathEntry = document.createElement("div");
  pathEntry.className = "path-item";

  const pathRow = document.createElement("div");
  pathRow.className = "path-row";

  const label = document.createElement("span");
  label.className = "path-label";

  const flagButton = document.createElement("button");
  flagButton.textContent = "Make Flag";
  flagButton.className = "make-Flag-button";

  const clearButton = document.createElement("button");
  clearButton.textContent = "Clear";
  clearButton.className = "path-clearButton";

  const delButton = document.createElement("button");
  delButton.textContent = "Delete";
  delButton.className = "path-deleteButton";

  const segmentList = document.createElement("div");
  segmentList.className = "segment-list";

  const segmentSection = document.createElement("div");
  segmentSection.className = "segment-section";

  const segmentTitle = document.createElement("div");
  segmentTitle.className = "subsection-title";
  segmentTitle.textContent = "Segments";

  pathRow.append(label);
  pathRow.append(flagButton);

  pathRow.append(clearButton);
  pathRow.append(delButton);
  pathEntry.append(pathRow);

  ensurePathName(pathIndex);
  label.textContent = paths[pathIndex].name;

  if (pathIndex === activePathIndex) {
    pathEntry.classList.add("is-active");
  }

  clearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    clearPathAtIndex(pathIndex);
  });

  delButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openDeletePathModal(pathIndex);
  });

  flagButton.addEventListener("click", (event) => {
    event.stopPropagation();
    activatePathForSegment(pathIndex);
    if (pathIndex !== activePathIndex) return;
    captureHistoryState();
    const nextFlag: FlagModel = {
      id: createFlagId(),
      pathDistance: getClampedFlagDistance(getPreferredNewFlagDistance()),
      type: "string",
      label: "",
      velocityLimit: null,
    };
    flags.push(nextFlag);
    sortFlags(flags);
    clearSelectedSegment();
    resetsegment();
    setSelectedFlag(nextFlag.id);
    rebuildPathTree();
    plot();
    renderGraphHoverOverlay();
  });

  pathRow.addEventListener("click", () => {
    if (suppressNextPathRowClick) {
      suppressNextPathRowClick = false;
      return;
    }
    if (pathIndex === activePathIndex) return;
    setActivePath(pathIndex);
  });

  label.addEventListener("dblclick", (event) => {
    event.stopPropagation();
    suppressNextPathRowClick = true;
    startInlineRename(label, label.textContent || "", (nextValue) => {
      paths[pathIndex].name = nextValue;
      label.textContent = nextValue;
      if (pathIndex === activePathIndex) {
        updatePathNameInput();
      }
      rebuildPathTree();
    });
  });

  const sectionList = paths[pathIndex].sections;
  sortFlags(paths[pathIndex].flags);
  if (pathIndex === activePathIndex) {
    for (let i = 0; i < sectionList.length; i++) {
      segmentList.append(buildSegmentEntry(pathIndex, i, sectionList));
    }

    segmentSection.append(segmentTitle, segmentList);
    pathEntry.append(segmentSection);
    pathEntry.append(buildFlagSection(pathIndex, paths[pathIndex].flags));
  }

  return pathEntry;
}

function rebuildPathTree() {
  if (!pathTree) return;
  pathTree.innerHTML = "";

  for (let i = 0; i < paths.length; i++) {
    pathTree.append(buildPathEntry(i));
  }
}

function redrawPoints() {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear canvas (and any other canvas reset you need)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dispatch event to redraw background if needed
  document.dispatchEvent(new CustomEvent("redrawCanvas"));

}
// Export controlpoints for other modules


function insertbezier(fieldX: number, fieldY: number): boolean {
  const startIndex = controlpoints.length - 1;
  const startPoint = controlpoints[startIndex];
  const segDx = fieldX - startPoint.x;
  const segDy = fieldY - startPoint.y;
  const segLen = Math.hypot(segDx, segDy);
  const dirX = segLen > 1e-6 ? segDx / segLen : (startPoint.anglex ?? 1);
  const dirY = segLen > 1e-6 ? segDy / segLen : (startPoint.angley ?? 0);

  const baseOffset = (100 / 3) * FIELD_WIDTH_INCHES / canvas.width;
  const offset1 = Math.min(baseOffset, segLen * 0.25);
  const offset2 = Math.min(baseOffset * 2, segLen * 0.5);

  const p1: controlPoint = {
    x: startPoint.x + offset1 * dirX,
    y: startPoint.y + offset1 * dirY,
    index: controlpoints.length,
    color: "blue",
    dist: offset1,
    size: 6,
  };
  controlpoints.push(p1);

  const p2: controlPoint = {
    x: startPoint.x + offset2 * dirX,
    y: startPoint.y + offset2 * dirY,
    index: controlpoints.length,
    color: "blue",
    dist: offset2,
    size: 6,
  };
  controlpoints.push(p2);

  const p3: controlPoint = {
    x: fieldX - offset2 * dirX,
    y: fieldY - offset2 * dirY,
    index: controlpoints.length,
    color: "blue",
    dist: offset2,
    size: 6,
  };
  controlpoints.push(p3);

  const p4: controlPoint = {
    x: fieldX - offset1 * dirX,
    y: fieldY - offset1 * dirY,
    index: controlpoints.length,
    color: "blue",
    dist: offset1,
    size: 6,
  };
  controlpoints.push(p4);

  const endPoint: controlPoint = {
    x: fieldX,
    y: fieldY,
    index: controlpoints.length,
    color: "red",
    dist: 0,
    isMain: true,
    anglex: dirX,
    angley: dirY,
    size: 8,
    rev: state,
  };
  controlpoints.push(endPoint);

  pushSection(startIndex, endPoint.index, "bezier", false);
  const newSectionIndex = sections.length - 1;
  if (newSectionIndex > 0) {
    const prev = sections[newSectionIndex - 1];
    const next = sections[newSectionIndex];
    if (prev.type === "bezier" && next.type === "bezier" && prev.endcontrol === next.startcontrol) {
      enforceG2Forward(prev, next);
    }
  }
  updatesections();
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

function pushSection(start: number, end: number, type: "bezier" | "line", rev: boolean){
  const angles = getSectionAngles(start, end, type);
  const nextName = getDefaultSegmentName(sections.length);

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
    name: nextName,
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
      name: sections[i].name || getDefaultSegmentName(i),
    }

    if(sections[i].rev){
      sections[i].startangle += PI;
      sections[i].endangle += PI;
    }
  }
}
