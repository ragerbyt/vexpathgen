

export let GRAPHMODE = "time"

import { leftVel, rightVel } from "./curve"; // Assuming they're exported there

import { redrawCanvas } from "./draw";
import {graph, MAX_ACCELERATION, MAX_VELOCITY,pathpoints } from "./globals";

let startime = 0; 
let endtime = 0;

// Redraw graph grid, axes, and labels
function redraw(ctx: CanvasRenderingContext2D) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);

  // Draw dotted horizontal grid lines to divide into 4 sections
  ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
  ctx.strokeStyle = "#555"; // Gray color for the grid lines
  ctx.lineWidth = 1;

  for (let i = 1; i < 4; i++) {
    if(i == 2){
      ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
      ctx.strokeStyle = "#888"; // Gray color for the grid lines
    }
    const y = (i / 4) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if(i == 2){
      ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
      ctx.strokeStyle = "#555"; // Gray color for the grid lines
    }
  }

  ctx.setLineDash([]); // Reset to solid for future drawing

  if (GRAPHMODE === "time" && pathpoints.length > 1) {
    const totalTime = pathpoints[pathpoints.length - 1].time;
    const interval = 1; // seconds
    const width = ctx.canvas.width;


    ctx.setLineDash([5, 5]); // Dotted pattern: 5px dash, 5px gap
    ctx.strokeStyle = "#  "; // Gray color for the grid lines

    for (let t = 0; t <= totalTime; t += interval) {
      const x = (t / totalTime) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ctx.canvas.height);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

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

  const maxAngVel = 5;
  const minAngVel = -5;

  const velocityData: { x: number; y: number }[] = [];
  const accelData: {x: number; y: number}[] = [];
  const leftVelocityData: { x: number; y: number }[] = [];
  const rightVelocityData: { x: number; y: number }[] = [];
  const AngularVelData: {x: number; y: number}[] = [];

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

      const normLeft = (pathpoints[i].leftvel - minVelocity) / (maxVelocity - minVelocity);
      const yLeft = height - (normLeft * height);
      leftVelocityData.push({ x: xPos, y: yLeft });

      const normRight = (pathpoints[i].rightvel - minVelocity) / (maxVelocity - minVelocity);
      const yRight = height - (normRight * height);
      rightVelocityData.push({ x: xPos, y: yRight });

      const normCurve = (pathpoints[i].angularVelocity - minAngVel) / (maxAngVel - minAngVel);
      const yCurve = height - (normCurve * height);
      AngularVelData.push({x: xPos, y: yCurve})

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
      
      const normLeft = (pathpoints[i].leftvel - minVelocity) / (maxVelocity - minVelocity);
      const yLeft = height - (normLeft * height);
      leftVelocityData.push({ x: xPos, y: yLeft });

      const normRight = (pathpoints[i].rightvel - minVelocity) / (maxVelocity - minVelocity);
      const yRight = height - (normRight * height);
      rightVelocityData.push({ x: xPos, y: yRight });

      const normCurve = (pathpoints[i].angularVelocity - minAngVel) / (maxAngVel - minAngVel);
      const yCurve = height - (normCurve * height);
      AngularVelData.push({x: xPos, y: yCurve})
    }
  }

  const fullgraph = document.getElementById("fullgraph") as HTMLCanvasElement
  const fullctx = fullgraph.getContext("2d") as CanvasRenderingContext2D  

  // Draw velocity curve
  drawPath(ctx, velocityData, "white");   // center velocity
  drawPath(fullctx, velocityData, "white");   // center velocity



  drawPath(ctx, leftVelocityData, "red"); // left wheel
  drawPath(ctx, rightVelocityData, "blue"); // right wheel
  drawPath(ctx, AngularVelData, "black"); // right wheel

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
  drawLine(octx, { x: 0, y: newCanvasY * 200 / rect.height }, { x: octx.canvas.width, y: newCanvasY * 200 / rect.height }, "red");

  let last = pathpoints.length - 1;

  let time = 0;
  let displayedVel = 0;

  if (GRAPHMODE === "time") {
    time = (newCanvasX / rect.width) * pathpoints[last].time;

  for (let i = 1; i < pathpoints.length; i++) {
    if (time < pathpoints[i].time) {
      const frac = (time - pathpoints[i - 1].time) / (pathpoints[i].time - pathpoints[i - 1].time);

      bot.x = pathpoints[i - 1].x + (pathpoints[i].x - pathpoints[i - 1].x) * frac;
      bot.y = pathpoints[i - 1].y + (pathpoints[i].y - pathpoints[i - 1].y) * frac;
      bot.o = pathpoints[i - 1].orientation + Normalize(pathpoints[i].orientation - pathpoints[i - 1].orientation) * frac;

      if (velocityDisplayMode === "center") {
        displayedVel = pathpoints[i - 1].velocity + (pathpoints[i].velocity - pathpoints[i - 1].velocity) * frac;
      } else if (velocityDisplayMode === "left") {
        displayedVel = pathpoints[i-1].leftvel + (pathpoints[i].leftvel - pathpoints[i-1].leftvel) * frac;
      } else if (velocityDisplayMode === "right") {
        displayedVel = pathpoints[i-1].rightvel + (pathpoints[i].rightvel - pathpoints[i-1].rightvel) * frac;
      }

      break;
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
        bot.o = p1.orientation + Normalize((p2.orientation - p1.orientation)) * frac;
        

        time = p1.time + (p2.time - p1.time) * frac;

        if (velocityDisplayMode === "center") {
          displayedVel = p1.velocity + (p2.velocity - p1.velocity) * frac;
        } else if (velocityDisplayMode === "left") {
          displayedVel = pathpoints[i-1].leftvel + (pathpoints[i].leftvel - pathpoints[i-1].leftvel) * frac;
        } else if (velocityDisplayMode === "right") {
          displayedVel = pathpoints[i-1].rightvel + (pathpoints[i].rightvel - pathpoints[i-1].rightvel) * frac;
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
  const startTime = performance.now(); // Time in milliseconds
  disable = true;
  let i = 1;

  console.log("run");

  while (true) {
    const now = performance.now();
    const time = (now - startTime) / 1000; // Convert to seconds

    if (time >= pathpoints[pathpoints.length - 1].time) break;

    octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;

    for (; i < pathpoints.length; i++) {
      if (time < pathpoints[i].time) {
        const frac = (time - pathpoints[i - 1].time) / (pathpoints[i].time - pathpoints[i - 1].time);

        bot.x = pathpoints[i - 1].x + (pathpoints[i].x - pathpoints[i - 1].x) * frac;
        bot.y = pathpoints[i - 1].y + (pathpoints[i].y - pathpoints[i - 1].y) * frac;
        bot.o = pathpoints[i - 1].orientation + Normalize(pathpoints[i].orientation - pathpoints[i - 1].orientation) * frac;

        break;
      }
    }

    drawLine(
      octx,
      { x: (time / pathpoints[pathpoints.length - 1].time) * 600, y: 0 },
      { x: (time / pathpoints[pathpoints.length - 1].time) * 600, y: octx.canvas.height },
      "red"
    );

    redrawCanvas();
    await new Promise(resolve => setTimeout(resolve, 5)); // Sleep just to yield, not to control time
  }

  await new Promise(resolve => setTimeout(resolve, 200));
  disable = false;
});


document.getElementById("dist")?.addEventListener("click", () => {
  GRAPHMODE = "dist";
  plot(); 
});

document.getElementById("time")?.addEventListener("click", () => {
  GRAPHMODE = "time";
  plot(); 
});

export function Normalize(n1: number){
  if(n1 > Math.PI){
    n1 -= 2*Math.PI
  }

  if(n1 < -Math.PI){
    n1 += 2*Math.PI
  }
  
  if(n1 > Math.PI){
    n1 -= 2*Math.PI
  }

  if(n1 < -Math.PI){
    n1 += 2*Math.PI
  }
  if(n1 > Math.PI){
    n1 -= 2*Math.PI
  }

  if(n1 < -Math.PI){
    n1 += 2*Math.PI
  }
  return n1

}