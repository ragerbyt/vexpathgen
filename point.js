let points = [], waypoints = [];

let isDraggingGlobal = false;

document.addEventListener("DOMContentLoaded", initCanvas);

function initCanvas() {
    const canvas = document.getElementById('canvas');
    canvas.addEventListener('click', (e) => handleCanvasClick(e, canvas));
}

function handleCanvasClick(e, canvas) {
    // If a drag event just occurred, do not create new points.
    if (isDraggingGlobal) {
        isDraggingGlobal = false;
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    createPointSet(clickX, clickY, rect);
    dispatchPathGeneration();

}

function createPointSet(centerX, centerY, rect) {
    // Create a set of 5 points (1 main point and 4 control points) centered around the click location.
    if(points.length == 0){
        const pointElem = document.createElement('div');
        createCtrl(pointElem,centerX,centerY,0,"blue");
        pointElem.classList.add('point');
        pointElem.style.width = "10px";
        pointElem.style.height = "10px";
        pointElem.dataset.anglex = 1;
        pointElem.dataset.angley = 0;
        return
    }


    function createCtrl(pointElem,x,y,offset,color){
        pointElem.classList.add('point');

        pointElem.dataset.dist = offset * 20;
        pointElem.dataset.x = x + offset * 20;
        pointElem.dataset.y = y;
        pointElem.style.left = `${x + offset * 20}px`;
        pointElem.style.top = `${y}px`;
        pointElem.style.backgroundColor = color;
        pointElem.dataset.index = points.length;

        points.push(pointElem);
        document.getElementById('canvas').appendChild(pointElem);

        // Attach drag handlers to the point element.
        attachDragHandlers(pointElem, rect);
    }

    let idx = points.length - 1;

    let prevx = Number(points[idx].dataset.x);
    let prevy = Number(points[idx].dataset.y);


    //first 2 control points
    for(let offset = 1; offset <= 2; offset++){
        let color = "rgb(255, 0, 0)";
        if(offset == 1){
            color = "rgb(0, 255, 0)"
        }

        const pointElem = document.createElement('div');
        createCtrl(pointElem,prevx,prevy,offset,color);

        updateControlPosition(points[idx],pointElem);
    }

    line(idx,idx+2);
    
    //next 2
    for (let offset = -1; offset >= -2; offset--) {
        let color = "rgb(255, 0, 0)";
        if(offset == -1){
            color = "rgb(0, 255, 0)"
        }

        const pointElem = document.createElement('div');
        createCtrl(pointElem,centerX,centerY,offset,color);
    }

    const pointElem = document.createElement('div');
    createCtrl(pointElem,centerX,centerY,0,"blue");
    pointElem.style.width = "10px";
    pointElem.style.height = "10px";


    pointElem.dataset.anglex = 1;
    pointElem.dataset.angley = 0;

    line(idx+3,idx+5);
    refreshPointPositions();

    console.log(waypoints.length);

}

function attachDragHandlers(pointElem, rect) {
    // Prevent the point's own click event from bubbling up to the canvas.
    pointElem.addEventListener('click', (e) => e.stopPropagation());

    pointElem.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        startDrag(pointElem, rect);
    });
}

function startDrag(pointElem, rect) {
    let isDragging = false;

    function onMouseMove(e) {
        isDragging = true;
        isDraggingGlobal = true;
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;
        updateDrag(pointElem, newX, newY);
        dispatchPathGeneration();
        line();
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

function updateDrag(pointElem, newX, newY) {
    const index = Number(pointElem.dataset.index);
    // Determine the index of the main point for this group (main points are at indexes that are multiples of 5)
    const groupStartIndex = Math.round(index / 5) * 5;
    const deltaX = Number(pointElem.dataset.x) - newX;
    const deltaY = Number(pointElem.dataset.y) - newY;

    if (index % 5 === 0) {
        // Main point: update the entire group of points.
        for (let i = -2; i < 3; i++) {
            const groupPoint = points[index + i];
            if (groupPoint) {
                groupPoint.dataset.x = Number(groupPoint.dataset.x) - deltaX;
                groupPoint.dataset.y = Number(groupPoint.dataset.y) - deltaY;
            }
        }

        
    } else {
        // Control point: update only its own position.
        pointElem.dataset.x = newX;
        pointElem.dataset.y = newY;

        // Update distance and angle relative to the main point.
        if (newX && newY) {
            pointElem.dataset.dist = calculateSignedDistance(points[groupStartIndex], pointElem);
            points[groupStartIndex].dataset.anglex = (Number(points[index].dataset.x) - Number(points[groupStartIndex].dataset.x)) / Number(pointElem.dataset.dist);
            points[groupStartIndex].dataset.angley = (Number(points[index].dataset.y) - Number(points[groupStartIndex].dataset.y)) / Number(pointElem.dataset.dist);
        }
        // Update control points positions based on the new angle.
        for (let i = -2; i < 3; i++) {
            const controlPoint = points[groupStartIndex + i];
            if (controlPoint) {
                updateControlPosition(points[groupStartIndex], controlPoint);
            }
        }
    }
    refreshPointPositions();
}

function refreshPointPositions() {
    // Update the visual positions of all points.
    for (let pt of points) {
        pt.style.left = `${pt.dataset.x}px`;
        pt.style.top = `${pt.dataset.y}px`;
    }
}

function calculateSignedDistance(pointA, pointB) {
    const dx = Number(pointA.dataset.x) - Number(pointB.dataset.x);
    const dy = Number(pointA.dataset.y) - Number(pointB.dataset.y);
    const rawDist = Math.sqrt(dx * dx + dy * dy);
    const distValue = Number(pointB.dataset.dist);
    // Avoid division by zero
    const sign = distValue !== 0 ? Math.abs(distValue) / distValue : 1;
    return rawDist * sign;
}

function updateControlPosition(mainPoint, controlPoint) {
    // Calculate new positions for a control point based on the main point's angle and stored distance.
    const distVal = Number(controlPoint.dataset.dist);
    const newX = Number(mainPoint.dataset.x) + distVal * Number(mainPoint.dataset.anglex);
    const newY = Number(mainPoint.dataset.y) + distVal * Number(mainPoint.dataset.angley);
    controlPoint.dataset.x = newX;
    controlPoint.dataset.y = newY;
}

function dispatchPathGeneration() {
    // Dispatch a custom event so that other parts of your app can generate/update the path.
    document.dispatchEvent(new CustomEvent("generatepath", {}));
}


//start, end
function line() {
    // Dispatch a custom event so that other parts of your app can generate/update the path.
    document.dispatchEvent(new CustomEvent("line", {}));
}
