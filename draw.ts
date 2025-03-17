


/**
 * Initializes the canvas, loads the background image,
 * and sets up the event listener to redraw the path.
 */
function setupCanvas() {
    const canvas = document.getElementById('path') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    // Set canvas dimensions.
    canvas.width = 600;
    canvas.height = 600;

    // Load background image.
    const background = new Image(); 
    background.src = "vexfield.png"; // Ensure the image exists in your directory.
    background.onload = () => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
    };

    let controlpoints: HTMLDivElement[];
    // Listen for the custom "drawpath" event to update the path.
    document.addEventListener('drawpath', (e : CustomEventInit) => {
        controlpoints =  e.detail.controlpoints;
        redrawCanvas(ctx, background, e.detail.controlpoints);

    });
    document.addEventListener('line', (e) => {
        redrawCanvas(ctx, background,controlpoints);

    });
}

/**
 * Clears the canvas, draws the background, and then draws the path if available.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {HTMLImageElement} background - The background image.
 * @param {Array} waypoints - Array of waypoints to draw the path.
 */

import {waypoints} from './curve';  // Adjust the path based on your file structure



function redrawCanvas(ctx, background, controlpoints: HTMLDivElement[]) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(background, 0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (waypoints.length > 1) {
        drawPath(ctx);
    }

    if (controlpoints === undefined){
        return;
    }

    
    for(let i = 0; i < controlpoints.length; i+= 5){

        if (controlpoints[1] === undefined) {
            break;
        }

        let sx = 10000000, lx = -10000000;
        let point1: HTMLDivElement, point2: HTMLDivElement;

        if(i == 0){
            for(let j = 0; j < 3; j++){
                let x = Number(controlpoints[i+j].dataset.x);

                if(x < sx){
                    point1 = controlpoints[i+j];
                    sx = x;
                }
                if(x > lx){
                    point2 = controlpoints[i+j];
                    lx = x;
                }
            }

            
        }else if(i == controlpoints.length - 1){
            for(let j = -2; j <= 0; j++){
                let x = Number(controlpoints[i+j].dataset.x);

                if(x < sx){
                    point1 = controlpoints[i+j];
                    sx = x;
                }
                if(x > lx){
                    point2 = controlpoints[i+j];
                    lx = x;
                }
            }
        }else{
            for(let j = -2; j <= 2; j++){
                let x = Number(controlpoints[i+j].dataset.x);

                if(x < sx){
                    point1 = controlpoints[i+j];
                    sx = x;
                }
                if(x > lx){
                    point2 = controlpoints[i+j];
                    lx = x;
                }
            }
        }
        drawLine(ctx, point1!.dataset, point2!.dataset, "white");

    }

}

/**
 * Draws a path connecting all the provided waypoints.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {Array} waypoints - Array of { x, y } points.
 */
function drawPath(ctx) {
    for (let i = 1; i < waypoints.length; i++) {
        drawLine(ctx, waypoints[i - 1], waypoints[i], "rgb(57, 255, 20)");
    }
}

/**
 * Draws a line between two points with a light green stroke.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas drawing context.
 * @param {Object} start - The starting point { x, y }.
 * @param {Object} end - The ending point { x, y }.
 */
function drawLine(ctx: CanvasRenderingContext2D, start: any, end: any, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Number(start.x), Number(start.y)); // conversion may be missing in one context
    ctx.lineTo(Number(end.x), Number(end.y));
    ctx.stroke();
}

document.addEventListener("DOMContentLoaded", setupCanvas);
