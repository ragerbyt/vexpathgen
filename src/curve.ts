import { MAX_ACCELERATION, MAX_VELOCITY} from "./globals";
import { pathPoint, controlPoint } from "./globals";


// Array to hold computed pathpoints

import {pathpoints,controlpoints,bot } from "./globals";
import { plot} from "./plot";

export function computeBezierWaypoints() {
  pathpoints.splice(0, pathpoints.length);
  if (controlpoints.length === 0) return;

  let totaldist = 0;
  const distances: number[] = [];

  const numSegments = (controlpoints.length - 1) / 3;
  for (let seg = 0; seg < numSegments; seg++) {
    const sectpoints = section(controlpoints, seg);
    for (let t = 0; t < 1; t += 0.01) {
      if (t === 0 && seg === 0) { distances.push(0); continue; }
      const prevT = t - 0.01;
      const dx = getx(sectpoints, t) - getx(sectpoints, prevT);
      const dy = gety(sectpoints, t) - gety(sectpoints, prevT);
      totaldist += Math.hypot(dx, dy);
      distances.push(totaldist);
    }
  }

  // Interpolate pathpoints based on a fixed distance increment
  const numInterpPoints = 500;
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

    const sectpoints = section(controlpoints, segmentIndex);
    const waypoint: pathPoint = {
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
    
    // Compute orientation based on movement direction.
    const dx = waypoint.x - (pathpoints.length > 0 ? pathpoints[pathpoints.length - 1].x : waypoint.x);
    const dy = waypoint.y - (pathpoints.length > 0 ? pathpoints[pathpoints.length - 1].y : waypoint.y);
    waypoint.orientation = Math.atan2(dy, dx);

    pathpoints.push(waypoint);
    targetDist += sampleStep;
  }

  // Ensure final waypoint is generated:
  const lastSegment = Math.floor((distances.length - 1) / 100);
  const finalSectPoints = section(controlpoints, lastSegment);

  const finalWaypoint: pathPoint = {
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

  // Position at t = 1
  const tFinal = 1;
  for (let j = 0; j < 4; j++) {
    const coeff = binomialCoefficient(3, j) *
                  Math.pow(1 - tFinal, 3 - j) *
                  Math.pow(tFinal, j);
    finalWaypoint.x += coeff * finalSectPoints[j].x;
    finalWaypoint.y += coeff * finalSectPoints[j].y;
  }

// Fill in missing data if we have at least one previous pathPoint
  if (pathpoints.length > 0) {
    const prev = pathpoints[pathpoints.length - 1];
    const dx = finalWaypoint.x - prev.x;
    const dy = finalWaypoint.y - prev.y;
    const dist = Math.hypot(dx, dy);
    finalWaypoint.orientation = Math.atan2(dy, dx);
    finalWaypoint.time = prev.time + (dist / ((prev.velocity + finalWaypoint.velocity) / 2 || 1e-6));
    finalWaypoint.accel = (finalWaypoint.velocity - prev.velocity) / (dist / ((prev.velocity + finalWaypoint.velocity) / 2 || 1e-6));
  }

  pathpoints.push(finalWaypoint);
  const TRACK_WIDTH = bot.width;


  // --- Apply curvature constraints and update angular velocity ---
  for (let i = 0; i < pathpoints.length; i++) {
    let curvature = 0;
    if (i > 0 && i < pathpoints.length - 1) {
      curvature = calculateCurvature(pathpoints[i - 1], pathpoints[i], pathpoints[i + 1]);
    }
    // Constrain velocity based on curvature:
    const leftFactor = Math.abs(1 - (TRACK_WIDTH / 2) * curvature);
    const rightFactor = Math.abs(1 + (TRACK_WIDTH / 2) * curvature);
    const maxDriveTrainVel = Math.min(60 / leftFactor, 60 / rightFactor);
    pathpoints[i].velocity = Math.min(MAX_VELOCITY, maxDriveTrainVel);

    pathpoints[i].curvature = curvature;
    pathpoints[i].angularVelocity = pathpoints[i].velocity * curvature;
  }

  // --- Velocity smoothing passes (backward then forward) ---
  // Backward pass: enforce deceleration limits

  pathpoints[0].velocity = 0;
  pathpoints[pathpoints.length-1].velocity = 0;
  for (let i = pathpoints.length - 2; i >= 0; i--) {
    const currentPoint = pathpoints[i];
    const futureVelocity = pathpoints[i + 1].velocity;
    const distStep = calcdistance(pathpoints[i], pathpoints[i + 1]);
    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(futureVelocity, MAX_ACCELERATION, distStep)
    );
  }

  // Forward pass: enforce acceleration limits
  for (let i = 1; i < pathpoints.length; i++) {
    const currentPoint = pathpoints[i];
    const prevPoint = pathpoints[i - 1];
    const distStep = calcdistance(prevPoint, currentPoint);
    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(prevPoint.velocity, MAX_ACCELERATION, distStep)
    );
    currentPoint.angularVelocity = currentPoint.velocity * currentPoint.curvature;
  }

  // --- Compute timestamps and cumulative distance ---
  let cumtime = 0;
  pathpoints[0].time = 0;
  pathpoints[0].accel = 0;
  for (let i = 1; i < pathpoints.length; i++) {
    const distStep = calcdistance(pathpoints[i], pathpoints[i - 1]);
    const averagevel = (pathpoints[i].velocity + pathpoints[i - 1].velocity) / 2;
    cumtime += distStep / averagevel;
    pathpoints[i].time = cumtime;
    pathpoints[i].accel = (pathpoints[i].velocity - pathpoints[i - 1].velocity) / (distStep / averagevel);
  }


  // Finally, plot graphs
  plot();
}

// --- Helper functions ---

function computeMaxVelocity(adjVelocity: number, maxAcceleration: number, distance: number): number {
  return Math.sqrt(Math.max(0, adjVelocity ** 2 + 2 * maxAcceleration * distance));
}

function calcdistance(point1: pathPoint, point2: pathPoint): number {
  return Math.hypot(point1.x - point2.x, point1.y - point2.y);
}

function binomialCoefficient(n: number, k: number): number {
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

/**
 * Returns the control controlpoints for the given segment.
 * For a cubic Bezier curve, each segment uses 4 controlpoints.
 */
function section(controlpoints: controlPoint[], segment: number): controlPoint[] {
  const segPoints = controlpoints
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

function getx(controlpoints: controlPoint[], t: number): number {
  let x = 0;
  for (let j = 0; j < 4; j++) {
    const pointX = controlpoints[j].x;
    const coeff = binomialCoefficient(3, j) * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
    x += coeff * pointX;
  }
  return x;
}

function gety(controlpoints: controlPoint[], t: number): number {
  let y = 0;
  for (let j = 0; j < 4; j++) {
    const pointY = controlpoints[j].y;
    const coeff = binomialCoefficient(3, j) * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
    y += coeff * pointY;
  }
  return y;
}

/**
 * Calculates curvature as the change in heading divided by the distance between pathpoints.
 * Approximates κ = dθ/ds.
 */
function calculateCurvature(prev: pathPoint, curr: pathPoint, next: pathPoint): number {
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };

  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;

  const cross = v1.x * v2.y - v1.y * v2.x;
  const sinTheta = cross / (mag1 * mag2);
  const dTheta = Math.asin(Math.max(-1, Math.min(1, sinTheta))); // clamp for safety

  return dTheta / mag1; // curvature κ = dθ/ds
}

