import {
  MAX_DECELERATION,
  MAX_ACCELERATION,
  MAX_LINEAR_VELOCITY,
  MAX_TURN_VELOCITY,
  LINEAR_TAU,
  TURN_TAU,
  SATURATION,
  sections,
  section,
  pathPoint,
  controlPoint,
  pathpoints,
  controlpoints,
  bot,
  flags,
} from "./editor-state";
import { getNearestPathpointIndexForFlag, sortFlagsByDerivedTime } from "./path-flags";
import { plot } from "./velocity-graph";
import { PI } from "chart.js/helpers";
import {
  getAvailableAcceleration,
  getAvailableAngularAcceleration,
  getCurvatureLimitedVelocity,
  getMaxAngularVelocity,
  getWheelVelocityBounds,
  MotionConstraintSettings,
} from "./motion-constraints";

export let numSegments = 0;
const POINTS_PER_SEGMENT = 1000;
const TURN_STEPS_MIN = 6;
const TURN_STEPS_MAX = 24;
const JOIN_ANGLE_EPS = 1e-3;
const ANGLE_EPS = 1e-6;

export function computePathProfile() {
  const velocityLocks = generatePathFromControlPoints();
  if (pathpoints.length === 0) {
    plot();
    document.dispatchEvent(new CustomEvent("path-profile-updated"));
    return;
  }

  initializeVelocityProfile();
  applyVelocityLocks(velocityLocks);
  runVelocityPasses(velocityLocks);
  applyVelocityLocks(velocityLocks);
  applyInPlaceTurnAngularProfile(velocityLocks);
  synchronizeMovingAngularVelocities(velocityLocks);
  computeWheelVelocities();
  computeTimestampsAndAcceleration();

  const velocityCaps = buildVelocityCapsFromFlags();
  if (velocityCaps.size > 0) {
    applyVelocityCaps(velocityCaps);
    runVelocityPasses(velocityLocks, velocityCaps);
    applyVelocityLocks(velocityLocks);
    applyVelocityCaps(velocityCaps);
    applyInPlaceTurnAngularProfile(velocityLocks);
    synchronizeMovingAngularVelocities(velocityLocks);
    computeWheelVelocities();
    computeTimestampsAndAcceleration();
  }

  applyReverseVelocitySigns();
  synchronizeMovingAngularVelocities(velocityLocks);
  computeWheelVelocities();
  computeTimestampsAndAcceleration();
  plot();
  document.dispatchEvent(new CustomEvent("path-profile-updated"));
}
function generatePathFromControlPoints(): Set<number> {
  resetPathPoints();
  if (controlpoints.length <= 1) return new Set();

  numSegments = sections.length;
  for (let seg = 0; seg < numSegments; seg++) {
    const currsection = sections[seg];
    appendSegmentWaypoints(currsection, POINTS_PER_SEGMENT);
  }

  removeDuplicateWaypoints();
  const velocityLocks = insertJoinTransitions();
  smoothPathCurvature();
  applyCurvatureVelocityLimits();
  return velocityLocks;
}

function initializeVelocityProfile() {
  pathpoints[0].velocity = 0;
  pathpoints[pathpoints.length - 1].velocity = 0;
}

function runVelocityPasses(velocityLocks: Set<number>, velocityCaps: Map<number, number> = new Map()) {
  applyWheelAccelerationConstraints(velocityLocks, velocityCaps);
}

function applyVelocityLocks(velocityLocks: Set<number>) {
  if (velocityLocks.size === 0) return;
  for (const index of velocityLocks) {
    if (index < 0 || index >= pathpoints.length) continue;
    pathpoints[index].velocity = 0;
  }
}

function applyVelocityCaps(velocityCaps: Map<number, number>) {
  if (velocityCaps.size === 0) return;
  for (const [index, limit] of velocityCaps.entries()) {
    if (index < 0 || index >= pathpoints.length) continue;
    pathpoints[index].velocity = Math.min(pathpoints[index].velocity, Math.max(0, limit));
  }
}

function isVelocityLocked(index: number, velocityLocks: Set<number>): boolean {
  return velocityLocks.has(index);
}

function clampLockedVelocity(index: number, velocityLocks: Set<number>): boolean {
  if (!isVelocityLocked(index, velocityLocks)) return false;
  pathpoints[index].velocity = 0;
  return true;
}

function clampVelocityCap(index: number, velocityCaps: Map<number, number>): void {
  const limit = velocityCaps.get(index);
  if (limit === undefined) return;
  pathpoints[index].velocity = Math.min(pathpoints[index].velocity, Math.max(0, limit));
}

function applyInPlaceTurnAngularProfile(velocityLocks: Set<number>) {
  if (velocityLocks.size === 0) return;

  const locked = Array.from(velocityLocks).sort((a, b) => a - b);
  const settings = getMotionConstraintSettings();
  const maxOmega = getMaxAngularVelocity(settings);
  const maxDecel = getMaxAngularDeceleration();

  let start = 0;
  while (start < locked.length) {
    let end = start;
    while (end + 1 < locked.length && locked[end + 1] === locked[end] + 1) {
      end++;
    }

    const startIndex = locked[start];
    const endIndex = locked[end];

    pathpoints[startIndex].angularVelocity = 0;
    for (let i = startIndex + 1; i <= endIndex; i++) {
      const angleStep = Math.abs(
        normalizeAngleRad(pathpoints[i].orientation - pathpoints[i - 1].orientation)
      );
      if (angleStep <= ANGLE_EPS) {
        pathpoints[i].angularVelocity = 0;
        continue;
      }
      const prevOmega = Math.abs(pathpoints[i - 1].angularVelocity);
      const maxAccel = getAvailableAngularAcceleration(settings, prevOmega);
      const omega = Math.sqrt(Math.max(0, prevOmega * prevOmega + 2 * maxAccel * angleStep));
      pathpoints[i].angularVelocity = Math.min(maxOmega, omega);
    }

    pathpoints[endIndex].angularVelocity = 0;
    for (let i = endIndex - 1; i >= startIndex; i--) {
      const angleStep = Math.abs(
        normalizeAngleRad(pathpoints[i + 1].orientation - pathpoints[i].orientation)
      );
      if (angleStep <= ANGLE_EPS) {
        pathpoints[i].angularVelocity = 0;
        continue;
      }
      const nextOmega = Math.abs(pathpoints[i + 1].angularVelocity);
      const omega = Math.sqrt(Math.max(0, nextOmega * nextOmega + 2 * maxDecel * angleStep));
      pathpoints[i].angularVelocity = Math.min(pathpoints[i].angularVelocity, omega);
    }

    for (let i = startIndex + 1; i <= endIndex; i++) {
      const delta = normalizeAngleRad(
        pathpoints[i].orientation - pathpoints[i - 1].orientation
      );
      const sign = delta >= 0 ? 1 : -1;
      pathpoints[i].angularVelocity = sign * Math.abs(pathpoints[i].angularVelocity);
    }

    start = end + 1;
  }
}

function computeWheelVelocities() {
  for (const p of pathpoints) {
    const w = bot.trackwidth;
    const omega = p.angularVelocity;
    p.leftvel = p.velocity - (omega * w) / 2;
    p.rightvel = p.velocity + (omega * w) / 2;
  }
}

function applyReverseVelocitySigns() {
  for (const point of pathpoints) {
    point.velocity = point.rev ? -Math.abs(point.velocity) : Math.abs(point.velocity);
  }
}

function synchronizeMovingAngularVelocities(velocityLocks: Set<number>) {
  for (let index = 0; index < pathpoints.length; index++) {
    if (velocityLocks.has(index)) continue;
    const point = pathpoints[index];
    // Curvature is derived in the path's travel direction.  A reversed
    // segment faces the opposite direction, so its robot-relative curvature
    // has the opposite sign.  Without this adjustment, negating the center
    // velocity also negates omega and swaps the left/right wheel velocities.
    const robotCurvature = point.rev ? -point.curvature : point.curvature;
    point.angularVelocity = point.velocity * robotCurvature;
  }
}

function computeTimestampsAndAcceleration() {
  let totalTime = 0;
  const EPS = 1e-9;
  const V_EPS = 1e-3;
  pathpoints[0].time = 0;
  pathpoints[0].accel = 0;

  for (let i = 1; i < pathpoints.length; i++) {
    const distStep = calcdistance(pathpoints[i], pathpoints[i - 1]);
    const averagevel = (pathpoints[i].velocity + pathpoints[i - 1].velocity) / 2;
    const denom = Math.max(Math.abs(averagevel), V_EPS);
    let dt = 0;
    if (distStep > EPS) {
      dt = distStep / denom;
    } else {
      const angleDelta = normalizeAngleRad(
        pathpoints[i].orientation - pathpoints[i - 1].orientation
      );
      const avgOmega =
        (Math.abs(pathpoints[i].angularVelocity) + Math.abs(pathpoints[i - 1].angularVelocity)) / 2;
      if (Math.abs(angleDelta) > ANGLE_EPS && avgOmega > ANGLE_EPS) {
        dt = Math.abs(angleDelta) / avgOmega;
      }
    }

    totalTime += dt;
    pathpoints[i].time = totalTime;
    pathpoints[i].accel = dt > EPS
      ? (pathpoints[i].velocity - pathpoints[i - 1].velocity) / dt
      : 0;
  }
}

function applyWheelAccelerationConstraints(velocityLocks: Set<number>, velocityCaps: Map<number, number> = new Map()) {
  if (pathpoints.length < 2) return;

  const MAX_ITERS = 6;
  const TOL = 1e-4;
  const EPS = 1e-9;
  const settings = getMotionConstraintSettings();

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const before = pathpoints.map(p => p.velocity);

    // Forward sweep
    for (let i = 1; i < pathpoints.length; i++) {
      const prev = pathpoints[i - 1];
      const curr = pathpoints[i];
      if (clampLockedVelocity(i, velocityLocks)) continue;
      clampVelocityCap(i, velocityCaps);
      const ds = calcdistance(prev, curr);
      if (ds <= EPS) continue;

      const accelLimit = getAvailableAcceleration(settings, prev.velocity, curr.curvature);
      const { leftBound, rightBound } = getWheelVelocityBounds(
        prev, curr, ds, accelLimit, settings.trackWidth
      );
      curr.velocity = Math.min(
        curr.velocity,
        getCurvatureLimitedVelocity(settings, curr.curvature),
        leftBound,
        rightBound
      );
      clampVelocityCap(i, velocityCaps);
    }

    // Backward sweep
    for (let i = pathpoints.length - 2; i >= 0; i--) {
      const curr = pathpoints[i];
      if (clampLockedVelocity(i, velocityLocks)) continue;
      clampVelocityCap(i, velocityCaps);
      const next = pathpoints[i + 1];
      const ds = calcdistance(curr, next);
      if (ds <= EPS) continue;

      const decelLimit = MAX_DECELERATION;
      const { leftBound, rightBound } = getWheelVelocityBounds(
        next, curr, ds, decelLimit, settings.trackWidth
      );
      curr.velocity = Math.min(
        curr.velocity,
        getCurvatureLimitedVelocity(settings, curr.curvature),
        leftBound,
        rightBound
      );
      clampVelocityCap(i, velocityCaps);
    }

    let maxDelta = 0;
    for (let i = 0; i < pathpoints.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(pathpoints[i].velocity - before[i]));
    }
    if (maxDelta < TOL) break;
  }
}

function applyCurvatureVelocityLimits() {
  const settings = getMotionConstraintSettings();
  for (const p of pathpoints) {
    const vCurvMax = getCurvatureLimitedVelocity(settings, p.curvature);
    p.velocity = Math.min(p.velocity, vCurvMax);
  }
}

function smoothPathCurvature() {
  const n = pathpoints.length;
  if (n < 3) return;

  const smoothed = pathpoints.map(point => point.curvature);
  const weights = [1, 2, 3, 2, 1];
  for (let i = 0; i < n; i++) {
    let weightedCurvature = 0;
    let totalWeight = 0;
    for (let offset = -2; offset <= 2; offset++) {
      const index = Math.max(0, Math.min(n - 1, i + offset));
      const weight = weights[offset + 2];
      weightedCurvature += pathpoints[index].curvature * weight;
      totalWeight += weight;
    }
    smoothed[i] = weightedCurvature / totalWeight;
  }

  for (let i = 0; i < n; i++) {
    pathpoints[i].curvature = smoothed[i];
  }
}

function buildVelocityCapsFromFlags(): Map<number, number> {
  const velocityFlags = flags
    .filter((flag) => flag.type === "velocity" && flag.velocityLimit !== null && Number.isFinite(flag.velocityLimit))
    .slice();

  sortFlagsByDerivedTime(velocityFlags, sections, pathpoints);

  const caps = new Map<number, number>();
  if (velocityFlags.length === 0 || pathpoints.length === 0) {
    return caps;
  }

  for (const flag of velocityFlags) {
    const pointIndex = getNearestPathpointIndexForFlag(flag, pathpoints);
    if (pointIndex < 0) continue;
    const limit = Math.max(0, flag.velocityLimit ?? 0);
    const existing = caps.get(pointIndex);
    caps.set(pointIndex, existing === undefined ? limit : Math.min(existing, limit));
  }

  return caps;
}

function insertJoinTransitions(): Set<number> {
  const velocityLocks = new Set<number>();
  for (let seg = 0; seg < sections.length - 1; seg++) {
    const prev = sections[seg];
    const next = sections[seg + 1];
    if (prev.endpath === undefined || next.startpath === undefined || next.endpath === undefined) continue;

    const seam = prev.endpath;
    if (seam <= 0 || seam >= pathpoints.length - 1) continue;

    const prevAngle = normalizeAngleRad(prev.endangle);
    const nextAngle = normalizeAngleRad(next.startangle);
    const angleDelta = normalizeAngleRad(nextAngle - prevAngle);
    const absAngle = Math.abs(angleDelta);
    if (absAngle <= JOIN_ANGLE_EPS) continue;

    if (prev.rev !== next.rev || absAngle > JOIN_ANGLE_EPS) {
      const seamPoint = pathpoints[seam];
      const turnSteps = Math.max(2, getTurnStepCount(absAngle));
      const turnPoints: pathPoint[] = [];
      for (let i = 0; i <= turnSteps; i++) {
        const t = i / turnSteps;
        const ang = normalizeAngleRad(prevAngle + angleDelta * t);
        const wp = makePointAt(seamPoint.x, seamPoint.y, ang, 0);
        wp.velocity = 0;
        wp.angularVelocity = 0;
        turnPoints.push(wp);
      }

      const removeStart = seam;
      const removeEnd = seam;
      const removeCount = 1;
      pathpoints.splice(removeStart, removeCount, ...turnPoints);

      const delta = turnPoints.length - removeCount;
      for (let s = 0; s < sections.length; s++) {
        const sec = sections[s];
        if (sec.startpath !== undefined && sec.startpath > removeEnd) sec.startpath += delta;
        if (sec.endpath !== undefined && sec.endpath > removeEnd) sec.endpath += delta;
      }

      const newSeamIndex = removeStart + turnPoints.length - 1;
      prev.endpath = newSeamIndex;
      next.startpath = newSeamIndex;
      for (let i = removeStart; i <= newSeamIndex; i++) {
        velocityLocks.add(i);
      }
      continue;
    }
  }

  recomputePathDistances();
  return velocityLocks;
}

function removeDuplicateWaypoints() {
  for (let i = 0; i < pathpoints.length - 1; i++) {
    const current = pathpoints[i];
    const next = pathpoints[i + 1];
    if (current.x !== next.x || current.y !== next.y || current.orientation !== next.orientation) continue;

    for (let seg = 0; seg < sections.length; seg++) {
      if (sections[seg].startpath! >= i) {
        sections[seg].startpath!--;
      }
      if (sections[seg].endpath! >= i) {
        sections[seg].endpath!--;
      }
    }
    pathpoints.splice(i, 1);
    i--;
  }
}

function appendSegmentWaypoints(currsection: section, count: number) {
  const sectpts = isolate(controlpoints, currsection.startcontrol, currsection.endcontrol);
  if (currsection.type === "bezier") {
    generateBezierWaypoints(sectpts, currsection, count);
  } else {
    generateLineWaypoints(sectpts, currsection, count);
  }
}

function generateBezierWaypoints(
  sectpts: controlPoint[],
  currsection: section,
  count: number,
): void {
  const bezierPts = toSixPointBezier(sectpts);

  const startI = initSectionPathIndices(currsection);

  for (let i = startI; i <= count; i++) {
    const t = i / count;
    const wp = createpathpoint();

    const point = computeBezierPoint(bezierPts, t);
    wp.x = point.x;
    wp.y = point.y;
    wp.orientation = resolveBezierOrientation(bezierPts, sectpts, t, currsection.rev);
    wp.rev = currsection.rev;
    accumulateDistance(wp);
    wp.curvature = bezierCurvature(bezierPts, t);
    pathpoints.push(wp);
  }

  currsection.endpath = pathpoints.length - 1;
}

function generateLineWaypoints(sectpts: controlPoint[], currsection: section, count: number){
  const startI = initSectionPathIndices(currsection);

  for (let i = startI; i <= count; i++) {
    const t = i / count;
    const wp = createpathpoint()
  
    wp.x =  sectpts[0].x + t * (sectpts[1].x - sectpts[0].x);
    wp.y =  sectpts[0].y + t * (sectpts[1].y - sectpts[0].y);

    const dx = sectpts[1].x - sectpts[0].x;
    const dy = sectpts[1].y - sectpts[0].y;    
    wp.orientation = Math.atan2(dy, dx);

    if(currsection.rev){
      wp.orientation = wp.orientation + PI;
    }
    wp.rev = currsection.rev;

    accumulateDistance(wp);

    pathpoints.push(wp)
  }

  currsection.endpath = pathpoints.length-1;

} 

function initSectionPathIndices(currsection: section): number {
  currsection.startpath = pathpoints.length === 0 ? 0 : pathpoints.length - 1;
  return pathpoints.length === 0 ? 0 : 1;
}

function resolveBezierOrientation(
  bezierPts: { x: number; y: number }[],
  sectpts: controlPoint[],
  t: number,
  isReversed: boolean
): number {
  let orientation: number;
  if (t === 0 && sectpts.length >= 2) {
    const next = sectpts[1];
    const start = sectpts[0];
    orientation = Math.atan2(next.y - start.y, next.x - start.x);
  } else if (t === 1 && sectpts.length >= 2) {
    const end = sectpts[sectpts.length - 1];
    const prev = sectpts[sectpts.length - 2];
    orientation = Math.atan2(end.y - prev.y, end.x - prev.x);
  } else {
    const { dx, dy } = bezierDerivative(bezierPts, t);
    orientation = Math.atan2(dy, dx);
  }

  return isReversed ? orientation + PI : orientation;
}

function computeBezierPoint(pts: { x: number; y: number }[], t: number): { x: number; y: number } {
  const degree = pts.length - 1;
  let x = 0;
  let y = 0;
  for (let j = 0; j < pts.length; j++) {
    const coeff = bernstein(degree, j, t);
    x += coeff * pts[j].x;
    y += coeff * pts[j].y;
  }
  return { x, y };
}

function bezierCurvature(
  pts: { x: number; y: number }[],
  t: number
) {
  const { dx, dy } = bezierDerivative(pts, t);
  const { ddx, ddy } = bezierSecondDerivative(pts, t);

  const numerator = dx * ddy - dy * ddx;
  const denominator = Math.pow(dx * dx + dy * dy, 1.5);

  if (denominator === 0) return 0;
  return numerator / denominator;
}

function bezierSecondDerivative(
  pts: { x: number; y: number }[],
  t: number
) {
  const n = pts.length - 1;
  if (n <= 1) return { ddx: 0, ddy: 0 };

  let ddx = 0;
  let ddy = 0;
  for (let i = 0; i <= n - 2; i++) {
    const b = bernstein(n - 2, i, t);
    ddx += (pts[i + 2].x - 2 * pts[i + 1].x + pts[i].x) * b;
    ddy += (pts[i + 2].y - 2 * pts[i + 1].y + pts[i].y) * b;
  }
  ddx *= n * (n - 1);
  ddy *= n * (n - 1);

  return { ddx, ddy };
}

function bezierDerivative(pts: { x: number; y: number }[], t: number) {
  const n = pts.length - 1;
  if (n <= 0) return { dx: 0, dy: 0 };

  let dx = 0;
  let dy = 0;
  for (let i = 0; i <= n - 1; i++) {
    const b = bernstein(n - 1, i, t);
    dx += (pts[i + 1].x - pts[i].x) * b;
    dy += (pts[i + 1].y - pts[i].y) * b;
  }
  dx *= n;
  dy *= n;
  return { dx, dy };
}

function toSixPointBezier(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length >= 6) return pts.slice(0, 6);
  if (pts.length >= 3) return elevateBezierToDegree(pts, 5);
  return pts;
}

function elevateBezierToDegree(pts: { x: number; y: number }[], targetDegree: number): { x: number; y: number }[] {
  const n = pts.length - 1;
  if (n < 1 || n >= targetDegree) return pts;

  const elevated: { x: number; y: number }[] = [];
  for (let i = 0; i <= targetDegree; i++) {
    let x = 0;
    let y = 0;

    const jMin = Math.max(0, i - (targetDegree - n));
    const jMax = Math.min(n, i);

    for (let j = jMin; j <= jMax; j++) {
      const w =
        (binomialCoefficient(n, j) *
          binomialCoefficient(targetDegree - n, i - j)) /
        binomialCoefficient(targetDegree, i);
      x += w * pts[j].x;
      y += w * pts[j].y;
    }

    elevated.push({ x, y });
  }

  return elevated;
}

function bernstein(n: number, i: number, t: number): number {
  return binomialCoefficient(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i);
}

function recomputePathDistances() {
  if (pathpoints.length === 0) return;
  pathpoints[0].dist = 0;
  for (let i = 1; i < pathpoints.length; i++) {
    pathpoints[i].dist = pathpoints[i - 1].dist + calcdistance(pathpoints[i - 1], pathpoints[i]);
  }
}

function makePointAt(x: number, y: number, orientation: number, curvature: number): pathPoint {
  const wp = createpathpoint();
  wp.x = x;
  wp.y = y;
  wp.orientation = orientation;
  wp.curvature = curvature;
  return wp;
}

function resetPathPoints() {
  pathpoints.splice(0, pathpoints.length);
}

function getTurnStepCount(angleDelta: number): number {
  const scaled = Math.round(
    TURN_STEPS_MIN + (TURN_STEPS_MAX - TURN_STEPS_MIN) * (angleDelta / Math.PI)
  );
  return Math.max(TURN_STEPS_MIN, Math.min(TURN_STEPS_MAX, scaled));
}

function normalizeAngleRad(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function getMaxAngularDeceleration(): number {
  return (2 * MAX_DECELERATION) / Math.max(bot.trackwidth, 1e-6);
}

function getMotionConstraintSettings(): MotionConstraintSettings {
  return {
    trackWidth: bot.trackwidth,
    maxLinearVelocity: MAX_LINEAR_VELOCITY,
    maxTurnVelocity: MAX_TURN_VELOCITY,
    maxAcceleration: MAX_ACCELERATION,
    linearTau: LINEAR_TAU,
    turnTau: TURN_TAU,
    saturation: SATURATION,
  };
}

function calcdistance(
  p1: pathPoint,
  p2: pathPoint
): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function binomialCoefficient(n: number, k: number): number {
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function isolate(controlpoints: controlPoint[], start: number, end: number): controlPoint[] {
  return controlpoints.slice(start, end + 1).map(p => ({ ...p }));
}

function accumulateDistance(wp: pathPoint) {
  if (pathpoints.length === 0) return;
  const dist = calcdistance(pathpoints[pathpoints.length - 1], wp);
  wp.dist = pathpoints[pathpoints.length - 1].dist + dist;
}

function createpathpoint(){
  const wp: pathPoint = {
    x: 0, y: 0,
    velocity: MAX_LINEAR_VELOCITY,
    angularVelocity: 0,
    dist: 0,
    accel: 0,
    time: 0,
    orientation: 0,
    rev: false,
    curvature: 0,
    leftdist: 0, //from prev to curr point distance
    leftx: 0,
    lefty: 0,
    leftvel: 0,
    rightdist: 0,
    rightx: 0,    
    righty: 0,
    rightvel: 0,
  };

  return wp
}
