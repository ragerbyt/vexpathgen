function setupCanvas() {
    const canvas = document.getElementById('path');
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    canvas.style.border = '1px solid red';  // Add a border to see the canvas

    // Listen for the custom event to update the path
    document.addEventListener('drawpath', function(event) {
        const points = event.detail.waypoints;
        // Redraw everything
        redrawCanvas(ctx);
        if(points.length == 1) return;
        drawAllLines(ctx, points);
    });
}

// Redraw the entire canvas
function redrawCanvas(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
// Draw a line between two points
function drawLine(ctx, start, end) {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}

// Draw all lines between consecutive points
function drawAllLines(ctx, points) {
    for (let i = 1; i < points.length; i++) {
        drawLine(ctx, points[i - 1], points[i]);
    }
}

document.addEventListener("DOMContentLoaded", setupCanvas);
