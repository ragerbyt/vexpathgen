const coordDisplay = document.getElementById("mouse-coordinates");

import { canvas } from "./globals";

canvas.addEventListener("mousemove", displayMouseCoordinates);


if(coordDisplay){
    coordDisplay.innerText = `X: 0, Y: 0`;
}


function displayMouseCoordinates(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (coordDisplay) {
        coordDisplay.innerText = `X: ${Math.round(mouseX)}, Y: ${Math.round(mouseY)}`;
        coordDisplay.style.opacity = "1"; // Show on hover
    }
}