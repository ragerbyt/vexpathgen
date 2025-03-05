document.addEventListener("DOMContentLoaded", setupCanvas);

/**
 * Initializes the canvas, loads the background image,
 * and sets up the event listener to redraw the path.
 */
function setupCanvas() {
    const canvas = document.getElementById('path');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions.
    canvas.width = 600;
    canvas.height = 600;

    // Load background image.
    const background = new Image();
    background.src = "vexfield.png"; // Ensure the image exists in your directory.
    background.onload = () => {
        redrawCanvas(ctx, background, []); // Draw background immediately.
    };

    // Listen for the custom "drawpath" event to update the path.
    document.addEventListener('drawpath', (event) => {
        const waypoints = event.detail.waypoints;
        redrawCanvas(ctx, background, waypoints);
    });
}

/**
 * Clears the canvas, draws the background, and then draws the path if available.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {HTMLImageElement} background - The background image.
 * @param {Array} waypoints - Array of waypoints to draw the path.
 */
function redrawCanvas(ctx, background, waypoints = []) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (waypoints.length > 1) {
        drawPath(ctx, waypoints);
    }
}

/**
 * Draws a path connecting all the provided waypoints.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {Array} waypoints - Array of { x, y } points.
 */
function drawPath(ctx, waypoints) {
    for (let i = 1; i < waypoints.length; i++) {
        drawLine(ctx, waypoints[i - 1], waypoints[i]);
    }
}

/**
 * Draws a line between two points with a light green stroke.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {Object} start - The starting point { x, y }.
 * @param {Object} end - The ending point { x, y }.
 */
function drawLine(ctx, start, end) {
    ctx.strokeStyle = "rgb(57, 255, 20)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}
