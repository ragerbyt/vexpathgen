export interface Point {
    x: number;
    y: number;
    velocity: number; // Linear velocity (m/s)
    curvature: number; // Curvature (1/m)
    angularVelocity: number; // Angular velocity (rad/s)
    accel: number;
    dist: number;
    time: number;
}

// Array to hold computed waypoints
export const waypoints: Point[] = [];

/**
 * Computes waypoints along Bezier curves for each group of control points.
 * Each group is assumed to start every 5 points in the array.
 *
 * @param {HTMLDivElement[]} points - Array of elements whose datasets provide x and y.
 * @param {number[]} segments - Array of segment indices (e.g., 0, 1, 2, …).
 */

import { plotData, plotDataaccel } from './plot';

export function computeBezierWaypoints(points: HTMLDivElement[], segments: number[]) {
    if (points.length === 0) return;

    // Loop over each segment index
    for (let i = 0; i < segments.length; i++) {
        const sectpoints = section(points, segments[i]);

        for (let t = 0; t < 1; t += 0.001) {
            const point: Point = { x: 0, y: 0, velocity: 0, curvature: 0, angularVelocity: 0, dist: 0, accel: 0, time: 0 };

            // Calculate position on Bezier curve
            for (let j = 0; j < 6; j++) {
                const pointX = Number(sectpoints[j].dataset.x);
                const pointY = Number(sectpoints[j].dataset.y);
                const coeff = binomialCoefficient(5, j) * Math.pow(1 - t, 5 - j) * Math.pow(t, j);
                point.x += coeff * pointX;
                point.y += coeff * pointY;
            }

            // Calculate curvature and store it
            point.curvature = computeCurvature(sectpoints, t);

            // Calculate linear velocity based on curvature
            point.velocity = Math.min(20, point.curvature > 0 ? Math.sqrt(5 / point.curvature) : 20);

            // Calculate angular velocity (ω = v * κ)
            point.angularVelocity = point.velocity * point.curvature;

            const index = segments[i] * 1000 + Math.floor(t * 1000);
            waypoints[index] = point;
        }
    }

    // Set initial and final velocities
    waypoints[0].velocity = 0;
    waypoints[0].angularVelocity = 0;
    waypoints[waypoints.length - 1].velocity = 0;
    waypoints[waypoints.length - 1].angularVelocity = 0;

    // Backward pass for deceleration
    for (let i = waypoints.length - 1; i >= 0; i--) {
        const index = i;

        if (index == waypoints.length - 1) continue;

        const currentPoint = waypoints[index];
        const futureVelocity = waypoints[index + 1].velocity;

        const maxAcceleration = 5;
        const dist = calcdistance(waypoints[index], waypoints[index + 1]);

        currentPoint.velocity = Math.min(
            currentPoint.velocity,
            computeMaxVelocity(futureVelocity, maxAcceleration, dist)
        );
    }

    // Forward pass for acceleration
    for (let i = 0; i < waypoints.length; i++) {
        const index = i;

        if (index == 0) continue;

        const currentPoint = waypoints[index];
        const prevPoint = waypoints[index - 1];
        const distance = calcdistance(prevPoint, currentPoint);

        currentPoint.velocity = Math.min(
            currentPoint.velocity,
            computeMaxVelocity(prevPoint.velocity, 5, distance)
        );

        // Update angular velocity using stored curvature
        currentPoint.angularVelocity = currentPoint.velocity * currentPoint.curvature;
    }


    // Compute time and distance
    let cumtime = 0;
    waypoints[0].time = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const distance = calcdistance(waypoints[i], waypoints[i - 1]);

        if (waypoints[i].velocity != 0) {
            const deltaTime = distance / waypoints[i].velocity;
            cumtime += deltaTime;
        }

        waypoints[i].time = cumtime;


        if(i == waypoints.length - 1){
            waypoints[i].accel = 0;
            continue;
        }
        waypoints[i].accel = (waypoints[i].velocity ** 2 - waypoints[i+1].velocity ** 2)/ (2 * distance);
    }

    // Calculate cumulative distance
    let cumlen = 0;
    for (let i = 1; i < waypoints.length; i++) {
        const distance = calcdistance(waypoints[i], waypoints[i - 1]);
        cumlen += distance;
        waypoints[i].dist = cumlen;
    }

    // Plot the computed velocity and acceleration data
    plotData(document.getElementById("velocitygraph") as HTMLCanvasElement, waypoints);
    plotDataaccel(document.getElementById("accelgraph") as HTMLCanvasElement, waypoints);
}

// Helper functions remain unchanged

function computeMaxVelocity(adjVelocity: number, maxAcceleration: number, distance: number): number {
    return Math.sqrt(Math.max(0, adjVelocity ** 2 + 2 * maxAcceleration * distance));
}

function calcdistance(point1: Point, point2: Point): number {
    return Math.hypot(point1.x - point2.x, point1.y - point2.y);
}

function binomialCoefficient(n: number, k: number): number {
    return factorial(n) / (factorial(k) * factorial(n - k));
}

function factorial(n: number): number {
    return n <= 1 ? 1 : n * factorial(n - 1);
}

function section(points: HTMLDivElement[], segment: number): HTMLDivElement[] {
    return points.slice(5 * segment, 5 * segment + 6);
}

function computeCurvature(sectpoints: HTMLElement[], t: number): number {
    let vx = 0, vy = 0;
    let ax = 0, ay = 0;

    // First derivative
    for (let j = 0; j < 5; j++) {
        const pointX1 = Number(sectpoints[j].dataset.x);
        const pointX2 = Number(sectpoints[j + 1].dataset.x);
        const pointY1 = Number(sectpoints[j].dataset.y);
        const pointY2 = Number(sectpoints[j + 1].dataset.y);
        const coeff = 5 * binomialCoefficient(4, j) * Math.pow(1 - t, 4 - j) * Math.pow(t, j);
        vx += coeff * (pointX2 - pointX1);
        vy += coeff * (pointY2 - pointY1);
    }

    // Second derivative
    for (let j = 0; j < 4; j++) {
        const pointX0 = Number(sectpoints[j].dataset.x);
        const pointX1 = Number(sectpoints[j + 1].dataset.x);
        const pointX2 = Number(sectpoints[j + 2].dataset.x);
        const pointY0 = Number(sectpoints[j].dataset.y);
        const pointY1 = Number(sectpoints[j + 1].dataset.y);
        const pointY2 = Number(sectpoints[j + 2].dataset.y);
        const coeff2 = 20 * binomialCoefficient(3, j) * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
        ax += coeff2 * (pointX2 - 2 * pointX1 + pointX0);
        ay += coeff2 * (pointY2 - 2 * pointY1 + pointY0);
    }

    const numerator = Math.abs(vx * ay - vy * ax);
    const denominator = Math.pow(vx ** 2 + vy ** 2, 1.5);
    return denominator !== 0 ? numerator / denominator : Infinity;
}