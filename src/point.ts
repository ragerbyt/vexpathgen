import { controlPoint } from "./globals";

let isDraggingGlobal = false;
let activeDragPoint: controlPoint | null = null;
let selectedPoint: controlPoint | null = null;



//so if top = 20; left = 20 ;then top left is chopped off.


const pointdisplay = document.getElementById("point-coordinates")!

import { computeBezierWaypoints } from "./curve";
import { canvas,controlpoints } from "./globals";

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
  const clickY = rect.bottom - e.clientY; // Updated

  // Convert canvas coordinates to field coordinates (0-144)
  const fieldX = canvasToFieldX(clickX);
  const fieldY = canvasToFieldY(clickY);

  createPointSet(fieldX, fieldY);
}

function handleMouseDown(e: MouseEvent) {

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = rect.bottom - e.clientY;

  // Convert to field coordinates
  const fieldX = canvasToFieldX(mouseX);
  const fieldY = canvasToFieldY(mouseY);

  // Check if we're clicking on an existing controlPoint (using field coordinates)
  const clickedPoint = getPointAtPosition(fieldX, fieldY);
  if (clickedPoint) {
    e.stopPropagation();
    activeDragPoint = clickedPoint;
    isDraggingGlobal = true;
    let temptext = "controlPoint selected X: ";
    temptext += clickedPoint.x.toFixed(1);
    temptext += " Y: ";
    temptext += clickedPoint.y.toFixed(1);
    pointdisplay.innerText = temptext;
  }else{
    pointdisplay.innerText = "No controlPoint selected";
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

function getPointAtPosition(fieldX: number, fieldY: number): controlPoint | null {
  const hitRadius = 10 * 144 / canvas.width; // in field units
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
    x: fieldX - offset,
    y: fieldY,
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
    anglex: 1,
    angley: 0,
    size: 8,
  };
  controlpoints.push(mainPoint);

  dispatchPathGeneration();
  redrawPoints();
}

function updateDrag(controlPoint: controlPoint, newX: number, newY: number) {
  const index = controlPoint.index;
  // Determine the index of the main controlPoint for this group (main points are at indexes that are multiples of 3)
  const groupStartIndex = Math.round(index / 3) * 3;
  const mainPoint = controlpoints[groupStartIndex];
  const deltaX = controlPoint.x - newX;
  const deltaY = controlPoint.y - newY;

  if (controlPoint.isMain) {
    // Main controlPoint: update the entire group of points.
    for (let i = -1; i <= 1; i++) {
      const groupPointIndex = index + i;
      if (groupPointIndex >= 0 && groupPointIndex < controlpoints.length) {
        controlpoints[groupPointIndex].x -= deltaX;
        controlpoints[groupPointIndex].y -= deltaY;
      }
    }
  } else {
    // Control controlPoint: update only its own position.
    controlPoint.x = newX;
    controlPoint.y = newY;

    controlPoint.dist = calculateSignedDistance(mainPoint, controlPoint);
    mainPoint.anglex = (controlPoint.x - mainPoint.x) / controlPoint.dist;
    mainPoint.angley = (controlPoint.y - mainPoint.y) / controlPoint.dist;

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
  controlpoints.length = 0;
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

