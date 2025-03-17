export interface Point {
    x: number;
    y: number;
    velocity: number;
    accel: number;
    dist: number;
    time: number;
}


interface Data {
    x: number;
    y: number;
}

// Function to plot velocity over time/index
export function plotData(chart: HTMLCanvasElement, waypoints: Point[]) {
    const ctx = chart.getContext("2d")!;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const canvasHeight = chart.height;
    const canvasWidth = chart.width;

    // Calculate the min and max velocity to normalize the values
    const velocities = waypoints.map(p => p.velocity);
    const maxVelocity = 22;
    const minVelocity = -22;

    let datas: Data[] = [];

    for (let i = 0; i < waypoints.length; i++) {
        // Normalize the velocity value between 0 and 1
        const normalizedVelocity = (waypoints[i].velocity - minVelocity) / (maxVelocity - minVelocity);
        // Invert the value to fit the canvas coordinate system (0 at top, canvasHeight at bottom)
        const yPosition = canvasHeight - normalizedVelocity * canvasHeight ;
        // Scale the x position according to the canvas width
        const xPosition = waypoints[i].time / waypoints[waypoints.length-1].time * canvasWidth;
        const point: Data = {
            x: xPosition,
            y: Math.max(0, Math.min(canvasHeight, yPosition))
        };

        //console.log(point.y);
        datas.push(point);
    }

    drawPath(ctx, datas,"rgb(255, 0, 255)");
}


export function plotDataaccel(chart: HTMLCanvasElement, waypoints: Point[]) {
    const ctx = chart.getContext("2d")!;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const canvasHeight = chart.height;
    const canvasWidth = chart.width;

    // Calculate the min and max velocity to normalize the values
    const accels = waypoints.map(p => p.accel);
    const maxAccel = 5.5;
    const minAccel = -5.5;

    let datas: Data[] = [];

    for (let i = 0; i < waypoints.length; i++) {
        // Normalize the velocity value between 0 and 1
        const normalizedVelocity = (waypoints[i].accel - minAccel) / (maxAccel - minAccel);
        // Invert the value to fit the canvas coordinate system (0 at top, canvasHeight at bottom)
        const yPosition = canvasHeight - normalizedVelocity * canvasHeight ;
        // Scale the x position according to the canvas width
        const xPosition = waypoints[i].dist / waypoints[waypoints.length-1].dist * canvasWidth + 10;
        const point: Data = {
            x: xPosition,
            y: Math.max(0, Math.min(canvasHeight, yPosition))
        };

        //console.log(point.y);
        datas.push(point);
    }

    drawPath(ctx, datas, "rgb(0, 255, 255)");
}

function drawPath(ctx: CanvasRenderingContext2D, datas: Data[], color:string) {
    for (let i = 1; i < datas.length; i++) {
        drawLine(ctx, datas[i - 1], datas[i], color)
    }
}

function drawLine(ctx: CanvasRenderingContext2D, start: Data, end: Data, color: string) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Number(start.x), Number(start.y));
    ctx.lineTo(Number(end.x), Number(end.y));
    ctx.stroke();
}
