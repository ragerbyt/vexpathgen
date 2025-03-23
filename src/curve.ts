// Constants (all distances in inches)
const FIELD_WIDTH_INCHES = 144;
const MAX_VELOCITY = 50;         // Maximum velocity in inches per second
const MAX_ACCELERATION = 10;      // Maximum acceleration in inches per second squared

export interface Point {
  x: number;         // x-coordinate in inches
  y: number;         // y-coordinate in inches
  velocity: number;  // Linear velocity (inches/s)
  curvature: number; // Here used to store the turn angle (radians)
  angularVelocity: number; // Angular velocity (rad/s)
  accel: number;
  dist: number;
  time: number;
}

// Array to hold computed waypoints
export let waypoints: Point[] = [];

import { accelGraph, velocityGraph } from "./globals";
import { Point as ControlPoint } from "./point";
import { plotData, plotDataaccel } from "./plot";

/**
 * Returns the x coordinate of a cubic Bezier curve (4 control points) at parameter t.
 * (Assumes control points are in inches.)
 */
function getx(points: ControlPoint[], t: number): number {
  let x = 0;
  for (let j = 0; j < 4; j++) {
    const pointX = points[j].x;
    const coeff = binomialCoefficient(3, j) * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
    x += coeff * pointX;
  }
  return x;
}

/**
 * Returns the y coordinate of a cubic Bezier curve (4 control points) at parameter t.
 */
function gety(points: ControlPoint[], t: number): number {
  let y = 0;
  for (let j = 0; j < 4; j++) {
    const pointY = points[j].y;
    const coeff = binomialCoefficient(3, j) * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
    y += coeff * pointY;
  }
  return y;
}

/**
 * Computes waypoints along the Bezier curve using distance-based interpolation.
 * The computed waypoints have positions in inches.
 */
export function computeBezierWaypoints(points: ControlPoint[]) {
  waypoints.splice(0, waypoints.length);
  if (points.length === 0) return;

  let totaldist = 0;
  const distances: number[] = [];

  const numSegments = (points.length - 1) / 3;
  for (let seg = 0; seg < numSegments; seg++) {
    const sectpoints = section(points, seg);
    for (let t = 0; t < 1; t += 0.01) {
      if (t === 0 && seg === 0) { distances.push(0); continue; }
      const prevT = t - 0.01;
      const dx = getx(sectpoints, t) - getx(sectpoints, prevT);
      const dy = gety(sectpoints, t) - gety(sectpoints, prevT);
      totaldist += Math.hypot(dx, dy);
      distances.push(totaldist);
    }
  }

  // Interpolate waypoints based on a fixed distance increment
  const numInterpPoints = 1000;
  const sampleStep = totaldist / numInterpPoints;
  let targetDist = 0;
  let iIndex = 1;

  while (targetDist <= totaldist && iIndex < distances.length) {
    while (iIndex < distances.length && distances[iIndex] < targetDist) {
      iIndex++;
    }
    if (iIndex >= distances.length) break;
    const d0 = distances[iIndex - 1];
    const d1 = distances[iIndex];
    const ratio = (targetDist - d0) / (d1 - d0);

    const segmentIndex = Math.floor((iIndex - 1) / 100);
    const localIndex = (iIndex - 1) % 100;
    const tLocal = (localIndex + ratio) / 100;

    const sectpoints = section(points, segmentIndex);
    const waypoint: Point = {
      x: 0,
      y: 0,
      velocity: MAX_VELOCITY,
      curvature: 0,
      angularVelocity: 0,
      dist: targetDist,
      accel: 0,
      time: 0,
    };
    for (let j = 0; j < 4; j++) {
      const coeff = binomialCoefficient(3, j) *
                    Math.pow(1 - tLocal, 3 - j) *
                    Math.pow(tLocal, j);
      waypoint.x += coeff * sectpoints[j].x;
      waypoint.y += coeff * sectpoints[j].y;
    }
    // (Later, we'll adjust velocity using turn angle.)
    waypoints.push(waypoint);
    targetDist += sampleStep;
  }

  // Ensure final waypoint is generated:
  const lastSegment = Math.floor((distances.length - 1) / 100);
  const finalSectPoints = section(points, lastSegment);
  const finalWaypoint: Point = {
    x: 0,
    y: 0,
    velocity: 0,
    curvature: 0,
    angularVelocity: 0,
    dist: totaldist,
    accel: 0,
    time: 0,
  };
  const tFinal = 1;
  for (let j = 0; j < 4; j++) {
    const coeff = binomialCoefficient(3, j) *
                  Math.pow(1 - tFinal, 3 - j) *
                  Math.pow(tFinal, j);
    finalWaypoint.x += coeff * finalSectPoints[j].x;
    finalWaypoint.y += coeff * finalSectPoints[j].y;
  }
  finalWaypoint.curvature = 0;
  finalWaypoint.velocity = 0;
  finalWaypoint.angularVelocity = 0;
  if (waypoints.length === 0 || calcdistance(waypoints[waypoints.length - 1], finalWaypoint) > 1e-6) {
    waypoints.push(finalWaypoint);
  }

  // --- Use turning angle (instead of derivative curvature) for velocity adjustments ---
  function computeTurnAngle(prev: Point, curr: Point, next: Point): number {
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    let dot = v1.x * v2.x + v1.y * v2.y;
    let cosTheta = dot / (mag1 * mag2);
    cosTheta = Math.max(-1, Math.min(1, cosTheta));
    return Math.acos(cosTheta);
  }

  for (let i = 0; i < waypoints.length; i++) {
    let turnAngle = 0;
    if (i > 0 && i < waypoints.length - 1) {
      turnAngle = computeTurnAngle(waypoints[i - 1], waypoints[i], waypoints[i + 1]);
    }
    // Use turnAngle to constrain velocity.
    const maxVelBasedOnTurn = turnAngle > 0 ? Math.sqrt(2 * MAX_ACCELERATION / turnAngle) : MAX_VELOCITY;
    waypoints[i].velocity = Math.min(waypoints[i].velocity, maxVelBasedOnTurn);
    waypoints[i].angularVelocity = waypoints[i].velocity * turnAngle;
    // Optionally store turnAngle in curvature field.
    waypoints[i].curvature = turnAngle;
  }

  waypoints[0].velocity = 0;

  // --- Velocity smoothing passes (backward then forward) ---
  for (let i = waypoints.length - 2; i >= 0; i--) {
    const currentPoint = waypoints[i];
    const futureVelocity = waypoints[i + 1].velocity;
    const distStep = calcdistance(waypoints[i], waypoints[i + 1]);
    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(futureVelocity, MAX_ACCELERATION, distStep)
    );

  }



  for (let i = 1; i < waypoints.length; i++) {
    const currentPoint = waypoints[i];
    const prevPoint = waypoints[i - 1];
    const distStep = calcdistance(prevPoint, currentPoint);
    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(prevPoint.velocity, MAX_ACCELERATION, distStep)
    );
    let turnAngle = 0;
    if (i > 0 && i < waypoints.length - 1) {
      turnAngle = computeTurnAngle(prevPoint, currentPoint, waypoints[i + 1]);
    }
    currentPoint.angularVelocity = currentPoint.velocity * turnAngle;
  }

  // --- Compute timestamps and cumulative distance ---
  let cumtime = 0;
  waypoints[0].time = 0;
  waypoints[0].accel = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const distStep = calcdistance(waypoints[i], waypoints[i - 1]);

    const averagevel = (waypoints[i].velocity + waypoints[i-1].velocity)/2

    cumtime += distStep / averagevel;
    
    waypoints[i].time = cumtime;



    waypoints[i].accel = (waypoints[i].velocity - waypoints[i-1].velocity) / (distStep/averagevel) ;

  }

  // Finally, plot graphs
  plotData(velocityGraph, waypoints);
  plotDataaccel(accelGraph, waypoints);
}

// --- Helper functions ---

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

/**
 * Returns the control points for the given segment.
 * For a cubic Bezier curve, each segment uses 4 points.
 */
function section(points: ControlPoint[], segment: number): ControlPoint[] {
  return points.slice(3 * segment, 3 * segment + 4);
}
