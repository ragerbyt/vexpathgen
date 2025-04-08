const coordDisplay = document.getElementById("mouse-coordinates");

import { canvas, left, right, top, bottom } from "./globals";

canvas.addEventListener("mousemove", displayMouseCoordinates);

if (coordDisplay) {
    coordDisplay.innerText = `X: 0, Y: 0`;
}

function displayMouseCoordinates(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();

    // Get the mouse position relative to the canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = rect.bottom - e.clientY;

    // Convert to field coordinates based on left, right, top, and bottom
    const fieldX = (mouseX / canvas.width) * (right - left) + left;
    const fieldY = (mouseY / canvas.height) * (bottom - top) + top;

    // Update the display with adjusted coordinates
    if (coordDisplay) {
        coordDisplay.innerText = `X: ${Math.round(fieldX)}, Y: ${Math.round(fieldY)}`;
        coordDisplay.style.opacity = "1"; // Show on hover
    }
}
