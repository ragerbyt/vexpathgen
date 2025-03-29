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


let recordcontrolpoints: Point[][] = [];
let currentindex = -1;

document.addEventListener("keydown", (e) =>{
  
  if(e.ctrlKey){
    if (e.key.toLowerCase() === "z") {
      console.log("ab");
      controlpoints = recordcontrolpoints[currentindex-1]; 
      currentindex--;

      console.log(recordcontrolpoints);

      dispatchPathGeneration();
      redrawPoints();

    } else if (e.key.toLowerCase() === "y") {
      
      controlpoints = recordcontrolpoints[currentindex+1]; 
      currentindex++;

      dispatchPathGeneration();
      redrawPoints();

    }

  }
})


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
  const clickY = e.clientY - rect.top;

  createPointSet(clickX, clickY);
}

function handleMouseDown(e: MouseEvent) {
  
  currentindex++;  
  recordcontrolpoints[currentindex] = controlpoints;

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
  let newX = e.clientX - rect.left;
  let newY = e.clientY - rect.top;

  // Clamp values so points can't exit the canvas
  newX = Math.max(0, Math.min(canvas.width, newX));
  newY = Math.max(0, Math.min(canvas.height, newY));

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
  if (controlpoints.length === 0) {
    const mainPoint: Point = {
      x: centerX,
      y: centerY,
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
  let offset = 20;

  offset *= window.innerHeight / 600;



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
  //updateControlPosition(controlpoints[idx], controlPoint1);

  const controlPoint2: Point = {
    x: centerX - offset,
    y: centerY,
    index: controlpoints.length,
    color: "blue",
    dist: -offset,
    size: 6,
  };
  controlpoints.push(controlPoint2);
  //updateControlPosition(controlpoints[idx], controlPoint1);


  const mainPoint: Point = {
    x: centerX,
    y: centerY,
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

  // Get scaling factor based on canvas size
  const defaultSize = 5;
  const scaleFactor = Math.min(canvas.width, canvas.height) / 600; // Adjust based on the original canvas size
  const borderSize = 1 * scaleFactor; // Border scales with size

  // Redraw points on top of the background and path
  document.dispatchEvent(new CustomEvent("redrawCanvas", { detail: { controlpoints } }));

  if(!showPoints) return;

  for (let i = 0; i < controlpoints.length; i += 3) {
    if(controlpoints[i-1]){
      drawLine(ctx,controlpoints[i-1],controlpoints[i],"white");
    }
    if(controlpoints[i+1]){
      drawLine(ctx,controlpoints[i+1],controlpoints[i],"white");
    }
  }
  // Draw points
  for (const point of controlpoints) {
    ctx.beginPath();
    const size = (point.size || defaultSize) * scaleFactor;

    // Draw filled circle
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fillStyle = point.color;
    ctx.fill();

    // Draw border
    ctx.lineWidth = borderSize;
    ctx.strokeStyle = "white"; // Change to any border color you like
    ctx.stroke();
  }
}

function drawLine(ctx: CanvasRenderingContext2D, start: any, end: any, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Number(start.x), Number(start.y));
  ctx.lineTo(Number(end.x), Number(end.y));
  ctx.stroke();
}

// Export controlpoints for other modules
export { controlpoints, type Point };


document.getElementById("clear")?.addEventListener("click", () => {
  controlpoints = []
  redrawPoints();
  dispatchPathGeneration()
});
