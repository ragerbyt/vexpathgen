

export let GRAPHMODE = "time"

import { leftVel, rightVel } from "./curve"; // Assuming they're exported there

import { redrawCanvas } from "./draw";
import {graph, leftdt, MAX_ACCELERATION, MAX_VELOCITY,pathpoints, rightdt } from "./globals";

// Redraw graph grid, axes, and labels
function redraw(ctx: CanvasRenderingContext2D) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Draw dotted horizontal midline (zero velocity)
  ctx.beginPath();
  ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.strokeStyle = "#888"; // Gray color for the midline
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]); // Reset to solid for future drawing
}

const startTimeLabel = document.getElementById("start-time-label") as HTMLDivElement;
  const endTimeLabel = document.getElementById("end-time-label") as HTMLDivElement;
  const unitlabel = document.getElementById("unit-label") as HTMLDivElement;
// Plot the velocity graph with time labels at start and end
export function plot() {
  const ctx = graph.getContext("2d")!;
  
  redraw(ctx); // Draw axes and grid first

  const width = graph.width;
  const height = graph.height;

  const maxVelocity = Math.round(MAX_VELOCITY);
  const minVelocity = -Math.round(MAX_VELOCITY);

  const maxAccel = MAX_ACCELERATION;
  const minAccel = -MAX_ACCELERATION;

  const velocityData: { x: number; y: number }[] = [];
  const accelData: {x: number; y: number}[] = [];

  if(GRAPHMODE == "time"){
    for (let i = 0; i < pathpoints.length; i++) {
      const timeRatio = pathpoints[i].time / pathpoints[pathpoints.length - 1].time;
      const xPos = timeRatio * width;
  
      const normVel = (pathpoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      const yVel = height - (normVel * height);
      velocityData.push({ x: xPos, y: yVel });

      const normAccel = (pathpoints[i].accel - minAccel) / (maxAccel - minAccel);
      const yAccel = height - (normAccel * height);
      accelData.push({ x: xPos, y: yAccel });
    }
  }else{
    for (let i = 0; i < pathpoints.length; i++) {
      const distRatio = pathpoints[i].dist / pathpoints[pathpoints.length - 1].dist;
      const xPos = distRatio * width;
  
      const normVel = (pathpoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      const yVel = height - (normVel * height);
      velocityData.push({ x: xPos, y: yVel });

      const normAccel = (pathpoints[i].accel - minAccel) / (maxAccel - minAccel);
      const yAccel = height - (normAccel * height);
      accelData.push({ x: xPos, y: yAccel });
    }
  }

  const leftVelocityData: { x: number; y: number }[] = [];
  const rightVelocityData: { x: number; y: number }[] = [];


  if (GRAPHMODE == "time") {
    for (let i = 0; i < pathpoints.length; i++) {
      const timeRatio = pathpoints[i].time / pathpoints[pathpoints.length - 1].time;
      const xPos = timeRatio * width;

      const normLeft = (leftdt[i].vel - minVelocity) / (maxVelocity - minVelocity);
      const yLeft = height - (normLeft * height);
      leftVelocityData.push({ x: xPos, y: yLeft });

      const normRight = (rightdt[i].vel - minVelocity) / (maxVelocity - minVelocity);
      const yRight = height - (normRight * height);
      rightVelocityData.push({ x: xPos, y: yRight });
    }
  } else {
    for (let i = 0; i < pathpoints.length; i++) {
      const distRatio = pathpoints[i].dist / pathpoints[pathpoints.length - 1].dist;
      const xPos = distRatio * width;

      const normLeft = (leftdt[i].vel - minVelocity) / (maxVelocity - minVelocity);
      const yLeft = height - (normLeft * height);
      leftVelocityData.push({ x: xPos, y: yLeft });

      const normRight = (rightdt[i].vel - minVelocity) / (maxVelocity - minVelocity);
      const yRight = height - (normRight * height);
      rightVelocityData.push({ x: xPos, y: yRight });
    }
  }

  // Normalize and scale velocity
  

  // Draw velocity curve
  drawPath(ctx, velocityData, "white");   // center velocity
  drawPath(ctx, accelData, "green");   // center velocity

  drawPath(ctx, leftVelocityData, "red"); // left wheel
  drawPath(ctx, rightVelocityData, "blue"); // right wheel
  
  // Get the time values
  const startTime = pathpoints[0].time.toFixed(2);
  let end;

  if(GRAPHMODE == "time"){
    end = pathpoints[pathpoints.length - 1].time.toFixed(2);
    unitlabel.textContent = "TIME (S)"
  }else{
    end = pathpoints[pathpoints.length - 1].dist.toFixed(2);
    unitlabel.textContent = "DIST (IN)"
  }

  // Update the time labels dynamically
  

  startTimeLabel.textContent = startTime;
  endTimeLabel.textContent = end;


  // Update velocity markings in HTML
  const velocityMaxLabel = document.getElementById("velocity-max-label") as HTMLDivElement;
  const velocityZeroLabel = document.getElementById("velocity-zero-label") as HTMLDivElement;

  velocityMaxLabel.textContent = `${maxVelocity.toFixed(0)}`; // Example max velocity
  velocityZeroLabel.textContent = "0";
  
}

// Helper function to draw paths for velocity data
function drawPath(ctx: CanvasRenderingContext2D, datas: { x: number; y: number }[], color: string) {
  for (let i = 1; i < datas.length; i++) {
    drawLine(ctx, datas[i - 1], datas[i], color);
  }
}

// Helper function to draw a line segment
function drawLine(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

document.addEventListener("mousemove", (e: MouseEvent) => handleMouseMove(e));

const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const octx = overlay.getContext("2d")!
const currtime = document.getElementById("currtime-label") as HTMLDivElement;

import { bot } from "./globals";

let disable = false;
let velocityDisplayMode: "center" | "left" | "right" = "center";
const currVelocity = document.getElementById("currvel-label") as HTMLDivElement;

function handleMouseMove(e: MouseEvent) {
  if (disable) return;

  octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
  bot.x = -1;
  bot.y = -1;
  bot.o = -1;
  redrawCanvas();
  currtime.style.display = "none";
  currVelocity.style.display = "none";

  if (!pathpoints || pathpoints.length === 0) return;

  const rect = graph.getBoundingClientRect();
  let newCanvasX = e.clientX - rect.left;
  let newCanvasY = e.clientY - rect.top;

  if (newCanvasX < 0 || newCanvasX > rect.width) return;
  if (newCanvasY < 0 || newCanvasY > rect.height) return;

  drawLine(octx, { x: newCanvasX * 600 / rect.width, y: 0 }, { x: newCanvasX * 600 / rect.width, y: octx.canvas.height }, "red");

  let last = pathpoints.length - 1;

  let time = 0;
  let displayedVel = 0;

  if (GRAPHMODE === "time") {
    time = newCanvasX / rect.width * pathpoints[last].time;

    for (let i = 1; i < pathpoints.length; i++) {
      if (time < pathpoints[i].time) continue;

      const frac = (time - pathpoints[i - 1].time) / (pathpoints[i].time - pathpoints[i - 1].time);

      bot.x = pathpoints[i - 1].x + (pathpoints[i].x - pathpoints[i - 1].x) * frac;
      bot.y = pathpoints[i - 1].y + (pathpoints[i].y - pathpoints[i - 1].y) * frac;
      bot.o = pathpoints[i - 1].orientation + (pathpoints[i].orientation - pathpoints[i - 1].orientation) * frac;

      if((pathpoints[i].time - pathpoints[i-1].time) < 0.000001){
        bot.x = pathpoints[i-1].x + (pathpoints[i+1].x - pathpoints[i-1].x) * 3/4;
        bot.y = pathpoints[i-1].y + (pathpoints[i+1].y - pathpoints[i-1].y) * 3/4;
        bot.o = pathpoints[i-1].orientation + (pathpoints[i+1].orientation - pathpoints[i-1].orientation) * 3/4;;
      }

      if (velocityDisplayMode === "center") {
        displayedVel = pathpoints[i - 1].velocity + (pathpoints[i].velocity - pathpoints[i - 1].velocity) * frac;
      } else if (velocityDisplayMode === "left") {
        displayedVel = leftdt[i - 1].vel + (leftdt[i].vel - leftdt[i - 1].vel) * frac;
      } else if (velocityDisplayMode === "right") {
        displayedVel = rightdt[i - 1].vel + (rightdt[i].vel - rightdt[i - 1].vel) * frac;
      }
    }

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;

  } else {
    const dist = newCanvasX / rect.width * pathpoints[last].dist;

    for (let i = 1; i < pathpoints.length; i++) {
      const p1 = pathpoints[i - 1];
      const p2 = pathpoints[i];

      if (dist >= p1.dist && dist <= p2.dist) {
        const frac = (dist - p1.dist) / (p2.dist - p1.dist);

        bot.x = p1.x + (p2.x - p1.x) * frac;
        bot.y = p1.y + (p2.y - p1.y) * frac;
        bot.o = p1.orientation + (p2.orientation - p1.orientation) * frac;
        

        time = p1.time + (p2.time - p1.time) * frac;

        if (velocityDisplayMode === "center") {
          displayedVel = p1.velocity + (p2.velocity - p1.velocity) * frac;
        } else if (velocityDisplayMode === "left") {
          displayedVel = leftdt[i - 1].vel + (leftdt[i].vel - leftdt[i - 1].vel) * frac;
        } else if (velocityDisplayMode === "right") {
          displayedVel = rightdt[i - 1].vel + (rightdt[i].vel - rightdt[i - 1].vel) * frac;
        }

        break;
      }
    }

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;
  }

  currVelocity.style.display = "block";
  currVelocity.innerText = `${displayedVel.toFixed(1)} in/s (${velocityDisplayMode})`;

  redrawCanvas();
}

const container = document.getElementById("graphs-container")!
container.addEventListener("click", () => {
  if (velocityDisplayMode === "center") {
    velocityDisplayMode = "left";
  } else if (velocityDisplayMode === "left") {
    velocityDisplayMode = "right";
  } else {
    velocityDisplayMode = "center";
  }

});


const run = document.getElementById("run");

run!.addEventListener("click", async () => {

  let time = 0;
  disable = true;
  console.log("run");

  while (time <  pathpoints[pathpoints.length-1].time){

    octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);

    currtime.style.display = "block";

    currtime.innerText = `${time.toFixed(2)}s`

    for(let i = 1; i < pathpoints.length; i++){
      if(time < pathpoints[i].time){continue};
      let frac = (time - pathpoints[i-1].time)/(pathpoints[i].time - pathpoints[i-1].time);

      
  
      bot.x = pathpoints[i-1].x + (pathpoints[i].x - pathpoints[i-1].x) * frac;
      bot.y = pathpoints[i-1].y + (pathpoints[i].y - pathpoints[i-1].y) * frac;
      bot.o = pathpoints[i-1].orientation + (pathpoints[i].orientation - pathpoints[i-1].orientation) * frac;

      if((pathpoints[i].time - pathpoints[i-1].time) < 0.000001){
        bot.x = pathpoints[i-1].x + (pathpoints[i+1].x - pathpoints[i-1].x) * 3/4;
        bot.y = pathpoints[i-1].y + (pathpoints[i+1].y - pathpoints[i-1].y) * 3/4;
        bot.o = pathpoints[i-1].orientation + (pathpoints[i+1].orientation - pathpoints[i-1].orientation) * 3/4;;
      }
    }    
    drawLine(octx,{x: time / pathpoints[pathpoints.length-1].time * 600, y: 0},{x: time / pathpoints[pathpoints.length-1].time * 600, y: octx.canvas.height},"red");

    
    time += 0.005;

    
    redrawCanvas();
    await new Promise(resolve => setTimeout(resolve, 5));

  }

  await new Promise(resolve => setTimeout(resolve, 200));

  disable = false;

})

document.getElementById("dist")?.addEventListener("click", () => {
  GRAPHMODE = "dist";
  plot(); 
});

document.getElementById("time")?.addEventListener("click", () => {
  GRAPHMODE = "time";
  plot(); 
});
