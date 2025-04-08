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
let selectedPoint: Point | null = null;



//so if top = 20; left = 20 ;then top left is chopped off.




const pointdisplay = document.getElementById("point-coordinates")

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

let recordcontrolpoints: Point[][] = [];
let currentindex = -1;

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey) {
    if (e.key.toLowerCase() === "z") {
      console.log("ab");
      controlpoints = recordcontrolpoints[currentindex - 1];
      currentindex--;

      console.log(recordcontrolpoints);

      dispatchPathGeneration();
      redrawPoints();
    } else if (e.key.toLowerCase() === "y") {
      controlpoints = recordcontrolpoints[currentindex + 1];
      currentindex++;

      dispatchPathGeneration();
      redrawPoints();
    }
  }
});




function handleCanvasClick(e: MouseEvent) {
  // If a drag event just occurred, do not create new points.
  if (isDraggingGlobal) {
    isDraggingGlobal = false;
    return;
  }

  currentindex++;
  recordcontrolpoints[currentindex] = controlpoints;

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = rect.bottom - e.clientY; // Updated

  // Convert canvas coordinates to field coordinates (0-144)
  const fieldX = canvasToFieldX(clickX);
  const fieldY = canvasToFieldY(clickY);

  createPointSet(fieldX, fieldY);
}

function handleMouseDown(e: MouseEvent) {
  currentindex++;
  recordcontrolpoints[currentindex] = controlpoints;

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = rect.bottom - e.clientY;

  // Convert to field coordinates
  const fieldX = canvasToFieldX(mouseX);
  const fieldY = canvasToFieldY(mouseY);

  // Check if we're clicking on an existing point (using field coordinates)
  const clickedPoint = getPointAtPosition(fieldX, fieldY);
  if (clickedPoint) {
    e.stopPropagation();
    activeDragPoint = clickedPoint;
    isDraggingGlobal = true;
    let temptext = "point selected X: ";
    temptext += clickedPoint.x;
    temptext += " Y: ";
    temptext += clickedPoint.y;
    pointdisplay.innerText = temptext;
  }else{
    pointdisplay.innerText = "No point selected";
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!activeDragPoint) return;

  const rect = canvas.getBoundingClientRect();
  let newCanvasX = e.clientX - rect.left;
  let newCanvasY = rect.bottom - e.clientY; // Updated

  // Clamp canvas values to ensure they don't exceed canvas boundaries
  newCanvasX = Math.max(0, Math.min(canvas.width, newCanvasX));
  newCanvasY = Math.max(0, Math.min(canvas.height, newCanvasY));

  // Convert new canvas coordinates to field coordinates
  const newFieldX = canvasToFieldX(newCanvasX);
  const newFieldY = canvasToFieldY(newCanvasY);

  updateDrag(activeDragPoint, newFieldX, newFieldY);
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

function getPointAtPosition(fieldX: number, fieldY: number): Point | null {
  const hitRadius = 10 * 144 / canvas.width; // in field units
  for (let i = controlpoints.length - 1; i >= 0; i--) {
    const point = controlpoints[i];
    const pointSize = point.size || 5;
    const dx = fieldX - point.x;
    const dy = fieldY - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= hitRadius) {
      return point;
    }
  }
  return null;
}

function createPointSet(fieldX: number, fieldY: number) {
  if (controlpoints.length === 0) {
    const mainPoint: Point = {
      x: fieldX,
      y: fieldY,
      index: 0,
      color: "red",
      dist: 0,
      isMain: true,
      anglex: 1,
      angley: 0,
      size: 8,
    };
    controlpoints.push(mainPoint);
    redrawPoints();
    return;
  }

  let idx = controlpoints.length - 1;
  let prevx = controlpoints[idx].x;
  let prevy = controlpoints[idx].y;
  let offset = 40 * 144 / canvas.width; // now in field units (0-144 range)

  // Create first 2 control points
  const controlPoint1: Point = {
    x: prevx + offset,
    y: prevy,
    index: controlpoints.length,
    color: "blue",
    dist: offset,
    size: 6,
  };
  controlpoints.push(controlPoint1);

  const controlPoint2: Point = {
    x: fieldX - offset,
    y: fieldY,
    index: controlpoints.length,
    color: "blue",
    dist: -offset,
    size: 6,
  };
  controlpoints.push(controlPoint2);

  const mainPoint: Point = {
    x: fieldX,
    y: fieldY,
    index: controlpoints.length,
    color: "red",
    dist: 0,
    isMain: true,
    anglex: 1,
    angley: 0,
    size: 8,
  };
  controlpoints.push(mainPoint);

  dispatchPathGeneration();
  redrawPoints();
}

function updateDrag(point: Point, newX: number, newY: number) {
  const index = point.index;
  // Determine the index of the main point for this group (main points are at indexes that are multiples of 3)
  const groupStartIndex = Math.round(index / 3) * 3;
  const mainPoint = controlpoints[groupStartIndex];
  const deltaX = point.x - newX;
  const deltaY = point.y - newY;

  if (point.isMain) {
    // Main point: update the entire group of points.
    for (let i = -1; i <= 1; i++) {
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
    for (let i = -1; i <= 1; i++) {
      const controlPointIndex = groupStartIndex + i;
      if (controlPointIndex >= 0 && controlPointIndex < controlpoints.length) {
        updateControlPosition(mainPoint, controlpoints[controlPointIndex]);
      }
    }
  }

  dispatchPathGeneration();
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

function dispatchPathGeneration() {
  computeBezierWaypoints(controlpoints);
  document.dispatchEvent(new CustomEvent("drawpath", { detail: { controlpoints } }));
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
  document.dispatchEvent(new CustomEvent("redrawCanvas", { detail: { controlpoints } }));

}

// Export controlpoints for other modules
export { controlpoints, type Point };

document.getElementById("clear")?.addEventListener("click", () => {
  controlpoints = [];
  redrawPoints();
  dispatchPathGeneration();
});

// Convert canvas coordinate to field coordinate (0-144)
function canvasToFieldX(x: number): number {
  return (x / canvas.width)*144
}
function canvasToFieldY(y: number): number {
  return (y / canvas.height)*144
}



// Zoom and pan functionality
let scale = 1; // Initial zoom level
const minScale = 0.5; // Minimum zoom level
const maxScale = 3; // Maximum zoom level
let offsetX = 0; // Offset for panning
let offsetY = 0;

let left = 0;
let right = 144;
let top = 0;
let bottom = 144;

import { redrawCanvas } from "./draw";
canvas.addEventListener("wheel", (e: WheelEvent) => {
  
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = rect.bottom - e.clientY;

  // Convert mouse position to field coordinates
  const mouseFieldX = left + (mouseX / canvas.width) * (right - left);
  const mouseFieldY = top + (mouseY / canvas.height) * (bottom - top);

  const zoomFactor = 0.1;
  const zoomIn = e.deltaY < 0;
  const zoomMultiplier = zoomIn ? (1 - zoomFactor) : (1 + zoomFactor);

  const newWidth = (right - left) * zoomMultiplier;
  const newHeight = (bottom - top) * zoomMultiplier;

  // Keep zoom centered on mouse
  left = mouseFieldX - (mouseX / canvas.width) * newWidth;
  right = left + newWidth;

  top = mouseFieldY - (mouseY / canvas.height) * newHeight;
  bottom = top + newHeight;
  
  redrawCanvas(); // Now should use left/right/top/bottom to transform the view
});

