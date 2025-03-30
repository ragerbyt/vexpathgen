import { MAX_JERK, MAX_ACCELERATION, MAX_VELOCITY} from "./globals";

export interface Point {
  x: number;         // x-coordinate in inches
  y: number;         // y-coordinate in inches
  velocity: number;  // Linear velocity (inches/s)
  curvature: number; // The curvature (radians per inch)
  angularVelocity: number; // Angular velocity (rad/s)
  accel: number;
  dist: number;
  time: number;
  orientation: number; // Orientation (heading) in degrees
}

// Array to hold computed waypoints
export let waypoints: Point[] = [];

import {graph } from "./globals";
import { Point as ControlPoint } from "./point";
import { plot} from "./plot";

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
      orientation: 0,
    };
    for (let j = 0; j < 4; j++) {
      const coeff = binomialCoefficient(3, j) *
                    Math.pow(1 - tLocal, 3 - j) *
                    Math.pow(tLocal, j);
      waypoint.x += coeff * sectpoints[j].x;
      waypoint.y += coeff * sectpoints[j].y;
    }
    
    // Compute orientation (in degrees) based on movement direction.
    const dx = waypoint.x - (waypoints.length > 0 ? waypoints[waypoints.length - 1].x : waypoint.x);
    const dy = waypoint.y - (waypoints.length > 0 ? waypoints[waypoints.length - 1].y : waypoint.y);
    waypoint.orientation = Math.atan2(dy, dx) * (180 / Math.PI);
    if (waypoint.orientation > 180) waypoint.orientation -= 360;
    if (waypoint.orientation < -180) waypoint.orientation += 360;

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
    orientation: 0,
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

  // --- Apply curvature constraints and update angular velocity ---
  for (let i = 0; i < waypoints.length; i++) {
    let curvature = 0;
    if (i > 0 && i < waypoints.length - 1) {
      curvature = calculateCurvature(waypoints[i - 1], waypoints[i], waypoints[i + 1]);
    }
    // Constrain velocity based on curvature:
    const maxVelBasedOnCurve = curvature > 0 ? Math.sqrt(MAX_ACCELERATION / curvature) : MAX_VELOCITY;
    waypoints[i].velocity = Math.min(waypoints[i].velocity, maxVelBasedOnCurve);
    waypoints[i].curvature = curvature;
    waypoints[i].angularVelocity = waypoints[i].velocity * curvature;
  }

  // --- Velocity smoothing passes (backward then forward) ---
  // Backward pass: enforce deceleration limits

  waypoints[0].velocity = 0;
  waypoints[waypoints.length-1].velocity = 0;
  for (let i = waypoints.length - 2; i >= 0; i--) {
    const currentPoint = waypoints[i];
    const futureVelocity = waypoints[i + 1].velocity;
    const distStep = calcdistance(waypoints[i], waypoints[i + 1]);
    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(futureVelocity, MAX_ACCELERATION, distStep)
    );
  }

  // Forward pass: enforce acceleration limits
  for (let i = 1; i < waypoints.length; i++) {
    const currentPoint = waypoints[i];
    const prevPoint = waypoints[i - 1];
    const distStep = calcdistance(prevPoint, currentPoint);
    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(prevPoint.velocity, MAX_ACCELERATION, distStep)
    );
    currentPoint.angularVelocity = currentPoint.velocity * currentPoint.curvature;
  }

  // --- Compute timestamps and cumulative distance ---
  let cumtime = 0;
  waypoints[0].time = 0;
  waypoints[0].accel = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const distStep = calcdistance(waypoints[i], waypoints[i - 1]);
    const averagevel = (waypoints[i].velocity + waypoints[i - 1].velocity) / 2;
    cumtime += distStep / averagevel;
    waypoints[i].time = cumtime;
    waypoints[i].accel = (waypoints[i].velocity - waypoints[i - 1].velocity) / (distStep / averagevel);
  }

  // --- Apply smoothing to acceleration (moving average) ---
  const windowSize = 5; // Size of the moving average window

  const smoothedAccel: number[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const end = i + 1;
    const avgAccel = waypoints.slice(start, end).reduce((sum, p) => sum + p.accel, 0) / (end - start);
    smoothedAccel.push(avgAccel);
  }

  // Update acceleration with smoothed values
  for (let i = 0; i < waypoints.length; i++) {
    waypoints[i].accel = smoothedAccel[i];
  }


  waypoints[waypoints.length - 1].accel = 0;
  waypoints[0].accel = 0;

  // Finally, plot graphs
  plot(graph, waypoints);
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
  const segPoints = points
    .slice(3 * segment, 3 * segment + 4)
    .map(p => ({ ...p }));

  if (segPoints.length < 4) return segPoints;

  const factor = 2;
  const [p0, p1, p2, p3] = segPoints;
  p1.x = p0.x + factor * (p1.x - p0.x);
  p1.y = p0.y + factor * (p1.y - p0.y);
  p2.x = p3.x + factor * (p2.x - p3.x);
  p2.y = p3.y + factor * (p2.y - p3.y);

  return segPoints;
}

function getx(points: ControlPoint[], t: number): number {
  let x = 0;
  for (let j = 0; j < 4; j++) {
    const pointX = points[j].x;
    const coeff = binomialCoefficient(3, j) * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
    x += coeff * pointX;
  }
  return x;
}

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
 * Calculates curvature as the change in heading divided by the distance between waypoints.
 * Approximates κ = dθ/ds.
 */
function calculateCurvature(prev: Point, curr: Point, next: Point): number {
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  let dot = v1.x * v2.x + v1.y * v2.y;
  let cosTheta = dot / (mag1 * mag2);
  cosTheta = Math.max(-1, Math.min(1, cosTheta));
  const dTheta = Math.acos(cosTheta);
  return dTheta / mag1;
}
