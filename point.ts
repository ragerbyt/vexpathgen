let controlpoints: HTMLDivElement[] = [];
let isDraggingGlobal = false;

import { computeBezierWaypoints } from './curve';

document.addEventListener("DOMContentLoaded", initCanvas);

function initCanvas() {
  const canvas = document.getElementById('canvas') as HTMLDivElement;
  if (!canvas) return;

  canvas.addEventListener('click', (e: MouseEvent) => handleCanvasClick(e, canvas));
}

function handleCanvasClick(e: MouseEvent, canvas: HTMLDivElement) {
  // If a drag event just occurred, do not create new points.
  if (isDraggingGlobal) {
    isDraggingGlobal = false;
    return;
  }

  e.stopPropagation();
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  createPointSet(clickX, clickY, rect);
}

function createPointSet(centerX: number, centerY: number, rect: DOMRect) {
  // Create a set of 5 points (1 main point and 4 control points) centered around the click location.
  if (controlpoints.length === 0) {
    const pointElem = document.createElement('div');
    createCtrl(pointElem, centerX, centerY, 0, "blue");
    pointElem.classList.add('point');
    pointElem.style.width = "10px";
    pointElem.style.height = "10px";
    pointElem.dataset.anglex = "1";
    pointElem.dataset.angley = "0";
    return;
  }

  // Helper function to create and add a control point.
  function createCtrl(pointElem: HTMLDivElement, x: number, y: number, offset: number, color: string) {
    pointElem.classList.add('point');
    pointElem.dataset.dist = `${offset * 20}`;
    pointElem.dataset.x = `${x + offset * 20}`;
    pointElem.dataset.y = `${y}`;
    pointElem.style.left = `${x + offset * 20}px`;
    pointElem.style.top = `${y}px`;
    pointElem.style.backgroundColor = color;
    pointElem.dataset.index = `${controlpoints.length}`;

    controlpoints.push(pointElem);
    document.getElementById('canvas')?.appendChild(pointElem);

    attachDragHandlers(pointElem, rect);
  }

  let idx = controlpoints.length - 1;
  let prevx = Number(controlpoints[idx].dataset.x);
  let prevy = Number(controlpoints[idx].dataset.y);

  // Create first 2 control points
  for (let offset = 1; offset <= 2; offset++) {
    const color = offset === 1 ? "rgb(0, 255, 0)" : "rgb(255, 0, 0)";
    const pointElem = document.createElement('div');
    createCtrl(pointElem, prevx, prevy, offset, color);
    updateControlPosition(controlpoints[idx], pointElem);
  }

  // Update the curve line immediately
  line();

  // Create next 2 control points
  for (let offset = -1; offset >= -2; offset--) {
    const color = offset === -1 ? "rgb(0, 255, 0)" : "rgb(255, 0, 0)";
    const pointElem = document.createElement('div');
    createCtrl(pointElem, centerX, centerY, offset, color);
  }

  const pointElem = document.createElement('div');
  createCtrl(pointElem, centerX, centerY, 0, "blue");
  pointElem.style.width = "10px";
  pointElem.style.height = "10px";
  pointElem.dataset.anglex = "1";
  pointElem.dataset.angley = "0";

  line();
  dispatchPathGeneration([(idx / 5)]);
}

function attachDragHandlers(pointElem: HTMLDivElement, rect: DOMRect) {
  // Prevent the point's own click event from bubbling up to the canvas.
  pointElem.addEventListener('click', (e: MouseEvent) => e.stopPropagation());

  pointElem.addEventListener('mousedown', (e: MouseEvent) => {
    e.stopPropagation();
    startDrag(pointElem, rect);
  });
}

function startDrag(pointElem: HTMLDivElement, rect: DOMRect) {
  let scheduled = false;

  function onMouseMove(e: MouseEvent) {
    isDraggingGlobal = true;
    const rect = document.getElementById('canvas')!.getBoundingClientRect();
    
    const newX = e.clientX - rect.left - pointElem.offsetWidth / 2;
    const newY = e.clientY - rect.top - pointElem.offsetHeight / 2;

    // Use requestAnimationFrame to update on each frame.
    if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => {
            updateDrag(pointElem, newX, newY);
            line();
            scheduled = false;
        });
    }
}


  function onMouseUp() {
    removeDragListeners();
    isDraggingGlobal = false;
  }

  function removeDragListeners() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function updateDrag(pointElem: HTMLDivElement, newX: number, newY: number) {
  const index = Number(pointElem.dataset.index);
  // Determine the index of the main point for this group (main points are at indexes that are multiples of 5)
  const groupStartIndex = Math.round(index / 5) * 5;
  const deltaX = Number(pointElem.dataset.x) - newX;
  const deltaY = Number(pointElem.dataset.y) - newY;

  if (index % 5 === 0) {
    // Main point: update the entire group of points.
    for (let i = -2; i < 3; i++) {
      const groupPoint = controlpoints[index + i];
      if (groupPoint) {
        groupPoint.dataset.x = `${Number(groupPoint.dataset.x) - deltaX}`;
        groupPoint.dataset.y = `${Number(groupPoint.dataset.y) - deltaY}`;
      }
    }
  } else {
    // Control point: update only its own position.
    pointElem.dataset.x = `${newX}`;
    pointElem.dataset.y = `${newY}`;

    if (newX && newY) {
      pointElem.dataset.dist = String(calculateSignedDistance(controlpoints[groupStartIndex], pointElem));
      controlpoints[groupStartIndex].dataset.anglex = `${(Number(controlpoints[index].dataset.x) - Number(controlpoints[groupStartIndex].dataset.x)) / Number(pointElem.dataset.dist)}`;
      controlpoints[groupStartIndex].dataset.angley = `${(Number(controlpoints[index].dataset.y) - Number(controlpoints[groupStartIndex].dataset.y)) / Number(pointElem.dataset.dist)}`;
    }

    // Update control points positions based on the new angle.
    for (let i = -2; i < 3; i++) {
      const controlPoint = controlpoints[groupStartIndex + i];
      if (controlPoint) {
        updateControlPosition(controlpoints[groupStartIndex], controlPoint);
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

  // Update positions for the group control points.
  for(let i = -2; i < 3; i++){
    if(controlpoints[groupStartIndex - i] === undefined) continue;
    refreshPointPositions(controlpoints[groupStartIndex - i]);
  }

  line();
}

function refreshPointPositions(pt: HTMLDivElement | undefined) {
  if (!pt) return;
  pt.style.left = `${pt.dataset.x}px`;
  pt.style.top = `${pt.dataset.y}px`;
}

function calculateSignedDistance(pointA: HTMLDivElement, pointB: HTMLDivElement) {
  const dx = Number(pointA.dataset.x) - Number(pointB.dataset.x);
  const dy = Number(pointA.dataset.y) - Number(pointB.dataset.y);
  const rawDist = Math.sqrt(dx * dx + dy * dy);
  const distValue = Number(pointB.dataset.dist);
  const sign = distValue !== 0 ? Math.abs(distValue) / distValue : 1;
  return rawDist * sign;
}

function updateControlPosition(mainPoint: HTMLDivElement, controlPoint: HTMLDivElement) {
  const distVal = Number(controlPoint.dataset.dist);
  const newX = Number(mainPoint.dataset.x) + distVal * Number(mainPoint.dataset.anglex);
  const newY = Number(mainPoint.dataset.y) + distVal * Number(mainPoint.dataset.angley);
  controlPoint.dataset.x = `${newX}`;
  controlPoint.dataset.y = `${newY}`;
}

function dispatchPathGeneration(segments: number[]) {
  computeBezierWaypoints(controlpoints, segments);
  document.dispatchEvent(new CustomEvent("drawpath", { detail: controlpoints }));
}

function line() {
  document.dispatchEvent(new CustomEvent("line", {}));
}
