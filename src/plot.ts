

export let GRAPHMODE = "time"


import { redrawCanvas } from "./draw";
import {graph, MAX_VELOCITY,pathpoints } from "./globals";

// Redraw graph grid, axes, and labels
function redraw(ctx: CanvasRenderingContext2D) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.clearRect(0, 0, width, height);
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

  const maxVelocity = Math.round(MAX_VELOCITY * 1.2);
  const minVelocity = 0;

  const velocityData: { x: number; y: number }[] = [];

  if(GRAPHMODE == "time"){
    for (let i = 0; i < pathpoints.length; i++) {
      const timeRatio = pathpoints[i].time / pathpoints[pathpoints.length - 1].time;
      const xPos = timeRatio * width;
  
      const normVel = (pathpoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      const yVel = height - (normVel * height);
      velocityData.push({ x: xPos, y: yVel });
    }
  }else{
    for (let i = 0; i < pathpoints.length; i++) {
      const distRatio = pathpoints[i].dist / pathpoints[pathpoints.length - 1].dist;
      const xPos = distRatio * width;
  
      const normVel = (pathpoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      const yVel = height - (normVel * height);
      velocityData.push({ x: xPos, y: yVel });
    }
  }
  // Normalize and scale velocity
  

  // Draw velocity curve
  drawPath(ctx, velocityData, "white");

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

function handleMouseMove(e: MouseEvent) {
  if (disable) return;

  octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
  bot.x = -1;
  bot.y = -1;
  bot.o = -1;
  redrawCanvas();
  currtime.style.display = "none";

  if (!pathpoints || pathpoints.length === 0) return; 
  const rect = graph.getBoundingClientRect();
  let newCanvasX = e.clientX - rect.left;
  let newCanvasY = e.clientY - rect.top; // Updated

  // Clamp canvas values to ensure they don't exceed canvas boundaries
  if(newCanvasX < 0 || newCanvasX > rect.width){
    return;
  }

  if(newCanvasY < 0 || newCanvasY > rect.height){
    return;
  }

  
  drawLine(octx,{x: newCanvasX * 600 / rect.width, y: 0},{x: newCanvasX * 600 / rect.width, y: octx.canvas.height},"red");

  let last = pathpoints.length-1

  if(GRAPHMODE == "time"){
    let time = newCanvasX / rect.width * pathpoints[last].time ;
    for(let i = 1; i < pathpoints.length; i++){
      if(time < pathpoints[i].time){continue};
      let frac = (time - pathpoints[i-1].time)/(pathpoints[i].time - pathpoints[i-1].time)+0.01;
  
      bot.x = pathpoints[i-1].x + (pathpoints[i].x - pathpoints[i-1].x) * frac;
      bot.y = pathpoints[i-1].y + (pathpoints[i].y - pathpoints[i-1].y) * frac;
      bot.o = pathpoints[i-1].orientation + (pathpoints[i].orientation - pathpoints[i-1].orientation) * frac;
    }
  
    if(time <= 0.05){
      bot.x = pathpoints[0].x;
      bot.y = pathpoints[0].y;
      bot.o = pathpoints[0].orientation;
    }
  
  
    if(time >= pathpoints[last].time - 0.1){
      bot.x = pathpoints[last].x;
      bot.y = pathpoints[last].y;
      bot.o = pathpoints[last].orientation;
    }
    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`
  
  }else{
    let dist = newCanvasX / rect.width * pathpoints[last].dist;
    let time = 0;

    for (let i = 1; i < pathpoints.length; i++) {
      const p1 = pathpoints[i - 1];
      const p2 = pathpoints[i];

      if (dist >= p1.dist && dist <= p2.dist) {
        const frac = (dist - p1.dist) / (p2.dist - p1.dist);

        bot.x = p1.x + (p2.x - p1.x) * frac;
        bot.y = p1.y + (p2.y - p1.y) * frac;
        bot.o = p1.orientation + (p2.orientation - p1.orientation) * frac;
        time = p1.time + (p2.time - p1.time) * frac;

        break;
      }
    }

    currtime.style.display = "block";
    currtime.innerText = `${time.toFixed(2)}s`;

  }
  
  redrawCanvas();

}

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
      let frac = (time - pathpoints[i-1].time)/(pathpoints[i].time - pathpoints[i-1].time)+0.01;
  
      bot.x = pathpoints[i-1].x + (pathpoints[i].x - pathpoints[i-1].x) * frac;
      bot.y = pathpoints[i-1].y + (pathpoints[i].y - pathpoints[i-1].y) * frac;
      bot.o = pathpoints[i-1].orientation + (pathpoints[i].orientation - pathpoints[i-1].orientation) * frac;
    }

    let last = pathpoints.length-1


    if(time >= pathpoints[last].time - 0.1){
      bot.x = pathpoints[last].x;
      bot.y = pathpoints[last].y;
      bot.o = pathpoints[last].orientation;
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
