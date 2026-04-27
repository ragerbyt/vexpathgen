const coordDisplay = document.getElementById("mouse-coordinates");

import { canvas, canvasToFieldX, canvasToFieldY } from "./globals";

canvas.addEventListener("mousemove", displayMouseCoordinates);

if (coordDisplay) {
    coordDisplay.innerText = `X: 0, Y: 0`;
}

function displayMouseCoordinates(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();

    // Get the mouse position relative to the canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to field coordinates based on the current viewport
    const fieldX = canvasToFieldX(mouseX, rect.width);
    const fieldY = canvasToFieldY(mouseY, rect.height);

    // Update the display with adjusted coordinates
    if (coordDisplay) {
        coordDisplay.innerText = `X: ${Math.round(fieldX)}, Y: ${Math.round(fieldY)}`;
        coordDisplay.style.opacity = "1"; // Show on hover
    }
}
