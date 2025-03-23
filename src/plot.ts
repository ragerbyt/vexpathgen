export interface Point {
    x: number;
    y: number;
    velocity: number;
    accel: number;
    dist: number;
    time: number;
}

const marginLeft = 50;
const marginRight = 20;
const marginTop = 20;
const marginBottom = 50;

// Constants (all distances in inches)
const MAX_VELOCITY = 50;         // Maximum velocity in inches per second
const MAX_ACCELERATION = 10;      // Maximum acceleration in inches per second squared

// Function to plot velocity over time/index

function redraw(ctx: CanvasRenderingContext2D) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
    // Define margins for the graph area
    
  
    // Draw the axes (solid white lines)
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  
    // X axis
    ctx.beginPath();
    ctx.moveTo(marginLeft, canvasHeight - marginBottom);
    ctx.lineTo(canvasWidth - marginRight, canvasHeight - marginBottom);
    ctx.stroke();
  
    // Y axis
    ctx.beginPath();
    ctx.moveTo(marginLeft, canvasHeight - marginBottom);
    ctx.lineTo(marginLeft, marginTop);
    ctx.stroke();
  
    // Draw grid lines (dashed gray lines)
    ctx.strokeStyle = "gray";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
  
    // Vertical grid lines
    const numVLines = 5;
    const graphWidth = canvasWidth - marginLeft - marginRight;
    const vSpacing = graphWidth / numVLines;
    for (let i = 1; i <= numVLines; i++) {
      ctx.beginPath();
      ctx.moveTo(marginLeft + i * vSpacing, canvasHeight - marginBottom);
      ctx.lineTo(marginLeft + i * vSpacing, marginTop);
      ctx.stroke();
    }
  
    // Horizontal grid lines
    const numHLines = 4;
    const graphHeight = canvasHeight - marginTop - marginBottom;
    const hSpacing = graphHeight / numHLines;
    for (let i = 1; i <= numHLines; i++) {
      ctx.beginPath();
      ctx.moveTo(marginLeft, canvasHeight - marginBottom - i * hSpacing);
      ctx.lineTo(canvasWidth - marginRight, canvasHeight - marginBottom - i * hSpacing);
      ctx.stroke();
    }
  }
  
  export function plotData(chart: HTMLCanvasElement, waypoints: Point[]) {
    const ctx = chart.getContext("2d")!;
    redraw(ctx); // Draw axes and grid first
  
    const canvasHeight = chart.height;
    const canvasWidth = chart.width;
  
    // We'll leave the margin settings used in redraw() so they match.
    const marginLeft = 50;
    const marginRight = 20;
    const marginBottom = 50;
    const graphWidth = canvasWidth - marginLeft - marginRight;
    const graphHeight = canvasHeight - marginBottom - 20; // top margin = 20
  
    // Calculate the min and max velocity (use MAX_VELOCITY constant from your code)
    const maxVelocity = MAX_VELOCITY * 1.2;
    const minVelocity = -0.2 * MAX_VELOCITY;
  
    let datas: { x: number; y: number }[] = [];
  
    for (let i = 0; i < waypoints.length; i++) {
      // Normalize the velocity between 0 and 1
      const normalizedVelocity = (waypoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
      // Invert y-axis: 0 at top, canvasHeight at bottom.
      const yPosition = marginTop + (1 - normalizedVelocity) * graphHeight;
      // Scale the x position according to the time stamp
      const xPosition = marginLeft + (waypoints[i].time / waypoints[waypoints.length - 1].time) * graphWidth;
  
      datas.push({
        x: xPosition,
        y: Math.max(marginTop, Math.min(canvasHeight - marginBottom, yPosition)),
      });
    }
  
    drawPath(ctx, datas, "rgb(255, 0, 255)");
  }
  
  export function plotDataaccel(chart: HTMLCanvasElement, waypoints: Point[]) {
    const ctx = chart.getContext("2d")!;
    redraw(ctx);
  
    const canvasHeight = chart.height;
    const canvasWidth = chart.width;
    const marginLeft = 50;
    const marginRight = 20;
    const marginBottom = 50;
    const graphWidth = canvasWidth - marginLeft - marginRight;
    const graphHeight = canvasHeight - marginBottom - 20; // top margin = 20
  
    const maxAccel = MAX_ACCELERATION * 1.2;
    const minAccel = -MAX_ACCELERATION * 1.2;
  
    let datas: { x: number; y: number }[] = [];
  
    for (let i = 0; i < waypoints.length; i++) {
      const normalizedAccel = (waypoints[i].accel - minAccel) / (maxAccel - minAccel);
      const yPosition = marginTop + (1 - normalizedAccel) * graphHeight;
      const xPosition = marginLeft + (waypoints[i].time / waypoints[waypoints.length - 1].time) * graphWidth;
      datas.push({
        x: xPosition,
        y: Math.max(marginTop, Math.min(canvasHeight - marginBottom, yPosition)),
      });
    }
  
    drawPath(ctx, datas, "rgb(0, 255, 255)");
  }
  
  function drawPath(ctx: CanvasRenderingContext2D, datas: { x: number; y: number }[], color: string) {
    for (let i = 1; i < datas.length; i++) {
      drawLine(ctx, datas[i - 1], datas[i], color);
    }
  }
  
  function drawLine(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  