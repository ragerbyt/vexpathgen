interface Point {
  x: number;
  y: number;
  index: number;
  color: string;
  dist: number;
  isMain?: boolean;
  anglex?: number;
  angley?: number;
  size?: number;
}

let controlpoints: Point[] = [];
let isDraggingGlobal = false;
let activeDragPoint: Point | null = null;

import { computeBezierWaypoints } from "./curve";
import { canvas } from "./globals";

document.addEventListener("DOMContentLoaded", initCanvas);

function initCanvas() {
  canvas.addEventListener("click", (e: MouseEvent) => handleCanvasClick(e));
  canvas.addEventListener("mousedown", (e: MouseEvent) => handleMouseDown(e));
  document.addEventListener("mousemove", (e: MouseEvent) => handleMouseMove(e));
  document.addEventListener("mouseup", () => handleMouseUp());

  // Initial render of the canvas
  redrawPoints();
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

  createPointSet(clickX, clickY);
}

function handleMouseDown(e: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Check if we're clicking on an existing point
  const clickedPoint = getPointAtPosition(mouseX, mouseY);
  if (clickedPoint) {
    e.stopPropagation();
    activeDragPoint = clickedPoint;
    isDraggingGlobal = true;
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!activeDragPoint) return;

  const rect = canvas.getBoundingClientRect();
  const newX = e.clientX - rect.left;
  const newY = e.clientY - rect.top;

  updateDrag(activeDragPoint, newX, newY);
  redrawPoints();
}

function handleMouseUp() {
  activeDragPoint = null;
  if (isDraggingGlobal) {
    setTimeout(() => {
      isDraggingGlobal = false;
    }, 10);
  }
}

function getPointAtPosition(x: number, y: number): Point | null {
  const hitRadius = 10; // Size to detect clicks on points

  // Check points in reverse order to prioritize points drawn on top
  for (let i = controlpoints.length - 1; i >= 0; i--) {
    const point = controlpoints[i];
    const pointSize = point.size || 5;
    const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));

    // If the mouse is within the point's hit area, return this point
    if (distance <= pointSize + hitRadius) {
      return point;
    }
  }

  return null;
}

function createPointSet(centerX: number, centerY: number) {
  // Create a set of 5 points (1 main point and 4 control points) centered around the click location.
  if (controlpoints.length === 0) {
    const mainPoint: Point = {
      x: centerX,
      y: centerY,
      index: 0,
      color: "blue",
      dist: 0,
      isMain: true,
      anglex: 1,
      angley: 0,
      size: 5,
    };
    controlpoints.push(mainPoint);
    redrawPoints();
    return;
  }

  let idx = controlpoints.length - 1;
  let prevx = controlpoints[idx].x;
  let prevy = controlpoints[idx].y;

  // Create first 2 control points
  for (let offset = 1; offset <= 2; offset++) {
    const color = offset === 1 ? "rgb(0, 255, 0)" : "rgb(255, 0, 0)";
    const controlPoint: Point = {
      x: prevx + offset * 20,
      y: prevy,
      index: controlpoints.length,
      color: color,
      dist: offset * 20,
    };
    controlpoints.push(controlPoint);
    updateControlPosition(controlpoints[idx], controlPoint);
  }

  // Update the curve line immediately
  line();

  // Create next 2 control points
  for (let offset = -1; offset >= -2; offset--) {
    const color = offset === -1 ? "rgb(0, 255, 0)" : "rgb(255, 0, 0)";
    const controlPoint: Point = {
      x: centerX + offset * 20,
      y: centerY,
      index: controlpoints.length,
      color: color,
      dist: offset * 20,
    };
    controlpoints.push(controlPoint);
  }

  const mainPoint: Point = {
    x: centerX,
    y: centerY,
    index: controlpoints.length,
    color: "blue",
    dist: 0,
    isMain: true,
    anglex: 1,
    angley: 0,
    size: 5,
  };
  controlpoints.push(mainPoint);

  line();
  dispatchPathGeneration([idx / 5]);
  redrawPoints();
}

function updateDrag(point: Point, newX: number, newY: number) {
  const index = point.index;
  // Determine the index of the main point for this group (main points are at indexes that are multiples of 5)
  const groupStartIndex = Math.round(index / 5) * 5;
  const mainPoint = controlpoints[groupStartIndex];
  const deltaX = point.x - newX;
  const deltaY = point.y - newY;

  if (point.isMain) {
    // Main point: update the entire group of points.
    for (let i = -2; i < 3; i++) {
      const groupPointIndex = index + i;
      if (groupPointIndex >= 0 && groupPointIndex < controlpoints.length) {
        controlpoints[groupPointIndex].x -= deltaX;
        controlpoints[groupPointIndex].y -= deltaY;
      }
    }
  } else {
    // Control point: update only its own position.
    point.x = newX;
    point.y = newY;

    point.dist = calculateSignedDistance(mainPoint, point);
    mainPoint.anglex = (point.x - mainPoint.x) / point.dist;
    mainPoint.angley = (point.y - mainPoint.y) / point.dist;

    // Update control points positions based on the new angle.
    for (let i = -2; i < 3; i++) {
      const controlPointIndex = groupStartIndex + i;
      if (controlPointIndex >= 0 && controlPointIndex < controlpoints.length) {
        updateControlPosition(mainPoint, controlpoints[controlPointIndex]);
      }
    }
  }

  let segmentIndexes: number[];

  if (groupStartIndex === 0) {
    // First control point belongs to the first segment only
    segmentIndexes = [0];
  } else if (groupStartIndex === controlpoints.length - 1) {
    // Last control point belongs to the last segment only
    segmentIndexes = [groupStartIndex / 5 - 1];
  } else {
    // Intermediate control points belong to two adjacent segments
    const segmentBefore = groupStartIndex / 5 - 1;
    const segmentAfter = groupStartIndex / 5;
    segmentIndexes = [segmentBefore, segmentAfter];
  }

  dispatchPathGeneration(segmentIndexes);
  line();
}

function calculateSignedDistance(pointA: Point, pointB: Point) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  const rawDist = Math.sqrt(dx * dx + dy * dy);
  const sign = pointB.dist !== 0 ? Math.abs(pointB.dist) / pointB.dist : 1;
  return rawDist * sign;
}

function updateControlPosition(mainPoint: Point, controlPoint: Point) {
  controlPoint.x = mainPoint.x + controlPoint.dist * (mainPoint.anglex || 0);
  controlPoint.y = mainPoint.y + controlPoint.dist * (mainPoint.angley || 0);
}

function dispatchPathGeneration(segments: number[]) {
  computeBezierWaypoints(controlpoints, segments);
  document.dispatchEvent(new CustomEvent("drawpath", { detail: { controlpoints } }));
}

function line() {
  document.dispatchEvent(new CustomEvent("line", {}));
}

function redrawPoints() {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Redraw points on top of the background and path
  document.dispatchEvent(new CustomEvent("redrawCanvas", { detail: { controlpoints } }));

  // Draw points
  for (const point of controlpoints) {
    ctx.beginPath();
    const size = point.size || 5;
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fillStyle = point.color;
    ctx.fill();
  }
}

// Export controlpoints for other modules
export { controlpoints, type Point };
