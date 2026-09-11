import {
  MAX_ACCELERATION,
  MAX_DECELERATION,
  MAX_VELOCITY,
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

export let numSegments = 0;
const POINTS_PER_SEGMENT = 1000;
const TURN_STEPS_MIN = 6;
const TURN_STEPS_MAX = 24;
const JOIN_ARC_RADIUS = 0.1;
const JOIN_ANGLE_EPS = 1e-3;
const JOIN_TURN_ANGLE_EPS = 0.1;
const IN_PLACE_TURN_ANGLE = (5 * Math.PI) / 180;
const ANGLE_EPS = 1e-6;

export function computePathProfile() {
  const velocityLocks = generatePathFromControlPoints();
  if (pathpoints.length === 0) {
    plot();
    document.dispatchEvent(new CustomEvent("path-profile-updated"));
    return;
  }

  computeStableCurvaturePrime();
  initializeVelocityProfile();
  applyVelocityLocks(velocityLocks);
  runVelocityPasses(velocityLocks);
  applyVelocityLocks(velocityLocks);
  applyInPlaceTurnAngularProfile(velocityLocks);
  computeWheelVelocities();
  computeTimestampsAndAcceleration();

  const velocityCaps = buildVelocityCapsFromFlags();
  if (velocityCaps.size > 0) {
    applyVelocityCaps(velocityCaps);
    runVelocityPasses(velocityLocks, velocityCaps);
    applyVelocityLocks(velocityLocks);
    applyVelocityCaps(velocityCaps);
    applyInPlaceTurnAngularProfile(velocityLocks);
    computeWheelVelocities();
    computeTimestampsAndAcceleration();
  }

  applyReverseVelocitySigns();
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
  applyCurvatureVelocityLimits();
  return velocityLocks;
}

function initializeVelocityProfile() {
  pathpoints[0].velocity = 0;
  pathpoints[pathpoints.length - 1].velocity = 0;
}

function runVelocityPasses(velocityLocks: Set<number>, velocityCaps: Map<number, number> = new Map()) {
  for (let i = 0; i < 2; i++) {
    applyDecelerationConstraints(velocityLocks, velocityCaps);
    applyAccelerationConstraints(velocityLocks, velocityCaps);
    applyWheelAccelerationConstraints(velocityLocks, velocityCaps);
  }
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
  const maxOmega = getMaxAngularVelocity();
  const maxAccel = getMaxAngularAcceleration();
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

function computeStableCurvaturePrime() {
  const n = pathpoints.length;
  if (n === 0) return;
  if (n === 1) {
    pathpoints[0].curvaturePrime = 0;
    return;
  }

  // Smooth curvature first to reduce seam noise between adjacent segments.
  const smoothK: number[] = new Array(n).fill(0);
  const weights = [1, 2, 3, 2, 1];
  for (let i = 0; i < n; i++) {
    let num = 0;
    let den = 0;
    for (let j = -2; j <= 2; j++) {
      const idx = Math.max(0, Math.min(n - 1, i + j));
      const w = weights[j + 2];
      num += pathpoints[idx].curvature * w;
      den += w;
    }
    smoothK[i] = den > 0 ? num / den : pathpoints[i].curvature;
  }

  pathpoints[0].curvaturePrime = 0;
  for (let i = 1; i < n - 1; i++) {
    const ds = calcdistance(pathpoints[i - 1], pathpoints[i]) + calcdistance(pathpoints[i], pathpoints[i + 1]);
    pathpoints[i].curvaturePrime = ds > 1e-6 ? (smoothK[i + 1] - smoothK[i - 1]) / ds : 0;
  }
  pathpoints[n - 1].curvaturePrime = pathpoints[n - 2].curvaturePrime;
}

function applyDecelerationConstraints(velocityLocks: Set<number>, velocityCaps: Map<number, number> = new Map()){
  for (let i = pathpoints.length - 2; i >= 0; i--) {
    const currentPoint = pathpoints[i];
    if (clampLockedVelocity(i, velocityLocks)) continue;
    clampVelocityCap(i, velocityCaps);
    const futureVelocity = pathpoints[i + 1].velocity;
    const distStep = calcdistance(pathpoints[i], pathpoints[i + 1]);

    const k = currentPoint.curvature;
    const dkRaw = pathpoints[i + 1].curvaturePrime;        // look ahead
    const w = bot.trackwidth;
    const v = Math.min(
      currentPoint.velocity,
      futureVelocity // or prev velocity in forward pass
    );

    const denom = getDiffDriveCurvatureDenom(k);
    const dk = getEffectiveCurvaturePrime(k, dkRaw, v);
    const accelCurvatureCap = getCurvatureLimitedDeceleration(k);
    const wheelAccelLimit =
      MAX_DECELERATION -
      (w / 2) * v * v * Math.abs(dk);

    const accel = Math.min(
      accelCurvatureCap,
      Math.max(0, wheelAccelLimit / denom)
    );

    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(futureVelocity, accel, distStep)
    );
    clampVelocityCap(i, velocityCaps);
  }
}

function applyAccelerationConstraints(velocityLocks: Set<number>, velocityCaps: Map<number, number> = new Map()){
  for (let i = 1; i < pathpoints.length; i++) {
    const currentPoint = pathpoints[i];
    if (clampLockedVelocity(i, velocityLocks)) continue;
    clampVelocityCap(i, velocityCaps);
    const prevPoint = pathpoints[i - 1];
    const distStep = calcdistance(prevPoint, currentPoint);

    const k = currentPoint.curvature;
    const dkRaw = pathpoints[i].curvaturePrime;            // current segment
    const w = bot.trackwidth;
    const v = Math.min(
      currentPoint.velocity,
      prevPoint.velocity // or prev velocity in forward pass
    );

    const denom = getDiffDriveCurvatureDenom(k);
    const dk = getEffectiveCurvaturePrime(k, dkRaw, v);
    const accelCurvatureCap = Math.min(
      getCurvatureLimitedAcceleration(k),
      getAvailableAcceleration(v, MAX_VELOCITY, MAX_ACCELERATION)
    );
    const wheelAccelLimit =
      MAX_ACCELERATION -
      (w / 2) * v * v * Math.abs(dk);

    const accel = Math.min(
      accelCurvatureCap,
      Math.max(0, wheelAccelLimit / denom)
    );



    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(prevPoint.velocity, accel, distStep)
    );
    clampVelocityCap(i, velocityCaps);
    currentPoint.angularVelocity = currentPoint.velocity * currentPoint.curvature;
  }
}

function applyWheelAccelerationConstraints(velocityLocks: Set<number>, velocityCaps: Map<number, number> = new Map()) {
  if (pathpoints.length < 2) return;

  const MAX_ITERS = 6;
  const TOL = 1e-4;
  const EPS = 1e-9;

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

      const accelLimit = Math.min(
        MAX_ACCELERATION,
        getAvailableAcceleration(prev.velocity, MAX_VELOCITY, MAX_ACCELERATION)
      );
      const { leftBound, rightBound } = getWheelBounds(prev, curr, ds, accelLimit);
      curr.velocity = Math.min(
        curr.velocity,
        getCurvatureLimitedVelocity(curr.curvature),
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
      const { leftBound, rightBound } = getWheelBounds(next, curr, ds, decelLimit);
      curr.velocity = Math.min(
        curr.velocity,
        getCurvatureLimitedVelocity(curr.curvature),
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
  for (const p of pathpoints) {
    const vCurvMax = getCurvatureLimitedVelocity(p.curvature);
    p.velocity = Math.min(p.velocity, vCurvMax);
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
  const EPS = 1e-9;
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

    const distSeam = pathpoints[seam].dist;
    const prevStart = prev.startpath ?? 0;
    const nextEnd = next.endpath;
    const availablePrev = distSeam - pathpoints[prevStart].dist;
    const availableNext = pathpoints[nextEnd].dist - distSeam;
    const maxTrim = Math.min(availablePrev, availableNext);
    if (shouldUseInPlaceTurn(absAngle, maxTrim) || prev.rev !== next.rev) {
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

    if (maxTrim <= EPS) continue;

    const cappedAngle = Math.min(absAngle, Math.PI - JOIN_TURN_ANGLE_EPS);
    const tanHalf = Math.tan(cappedAngle / 2);
    if (Math.abs(tanHalf) <= EPS) continue;

    let radius = JOIN_ARC_RADIUS;
    let trimDist = radius * tanHalf;
    if (trimDist > maxTrim) {
      radius = maxTrim / tanHalf;
      trimDist = maxTrim;
    }
    if (radius <= EPS) continue;

    const targetPrev = distSeam - trimDist;
    const targetNext = distSeam + trimDist;
    const prevIndex = findIndexBeforeByDist(prevStart, seam, targetPrev);
    const nextIndex = findIndexBeforeByDist(seam, nextEnd, targetNext);
    if (prevIndex + 1 > seam || nextIndex + 1 > nextEnd) continue;

    const prevA = pathpoints[prevIndex];
    const prevB = pathpoints[prevIndex + 1];
    const prevSpan = Math.max(prevB.dist - prevA.dist, EPS);
    const tPrev = Math.min(1, Math.max(0, (targetPrev - prevA.dist) / prevSpan));

    const nextA = pathpoints[nextIndex];
    const nextB = pathpoints[nextIndex + 1];
    const nextSpan = Math.max(nextB.dist - nextA.dist, EPS);
    const tNext = Math.min(1, Math.max(0, (targetNext - nextA.dist) / nextSpan));

    const startX = prevA.x + (prevB.x - prevA.x) * tPrev;
    const startY = prevA.y + (prevB.y - prevA.y) * tPrev;
    const endX = nextA.x + (nextB.x - nextA.x) * tNext;
    const endY = nextA.y + (nextB.y - nextA.y) * tNext;

    const sign = angleDelta >= 0 ? 1 : -1;
    const curvature = sign / radius;

    const prevDir = { x: Math.cos(prevAngle), y: Math.sin(prevAngle) };
    const nextDir = { x: Math.cos(nextAngle), y: Math.sin(nextAngle) };
    const prevNorm = sign > 0 ? { x: -prevDir.y, y: prevDir.x } : { x: prevDir.y, y: -prevDir.x };
    const nextNorm = sign > 0 ? { x: -nextDir.y, y: nextDir.x } : { x: nextDir.y, y: -nextDir.x };
    const centerX = (startX + prevNorm.x * radius + endX + nextNorm.x * radius) / 2;
    const centerY = (startY + prevNorm.y * radius + endY + nextNorm.y * radius) / 2;

    let arcStartAngle = Math.atan2(startY - centerY, startX - centerX);
    let arcEndAngle = Math.atan2(endY - centerY, endX - centerX);
    let arcDelta = normalizeAngleRad(arcEndAngle - arcStartAngle);
    if (sign > 0 && arcDelta < 0) arcDelta += 2 * Math.PI;
    if (sign < 0 && arcDelta > 0) arcDelta -= 2 * Math.PI;

    const arcSteps = Math.max(3, getTurnStepCount(Math.abs(arcDelta)));
    const arcPoints: pathPoint[] = [];
    for (let i = 1; i < arcSteps; i++) {
      const t = i / arcSteps;
      const ang = arcStartAngle + arcDelta * t;
      const x = centerX + radius * Math.cos(ang);
      const y = centerY + radius * Math.sin(ang);
      const heading = ang + (sign > 0 ? Math.PI / 2 : -Math.PI / 2);
      arcPoints.push(makePointAt(x, y, heading, curvature));
    }

    const startPoint = makePointAt(startX, startY, prevAngle, 0);
    const endPoint = makePointAt(endX, endY, nextAngle, 0);
    startPoint.rev = prev.rev;
    endPoint.rev = prev.rev;
    const rampCount = Math.min(3, arcPoints.length);
    for (let i = 0; i < rampCount; i++) {
      const blend = (i + 1) / (rampCount + 1);
      arcPoints[i].curvature = curvature * blend;
      const tailIndex = arcPoints.length - 1 - i;
      arcPoints[tailIndex].curvature = curvature * blend;
    }
      for (const point of arcPoints) point.rev = prev.rev;

    const removeStart = prevIndex + 1;
    const removeEnd = nextIndex;
    const removeCount = Math.max(0, removeEnd - removeStart + 1);
    const newPoints = [startPoint, ...arcPoints, endPoint];
    pathpoints.splice(removeStart, removeCount, ...newPoints);

    const delta = newPoints.length - removeCount;
    for (let s = 0; s < sections.length; s++) {
      const sec = sections[s];
      if (sec.startpath !== undefined && sec.startpath > removeEnd) sec.startpath += delta;
      if (sec.endpath !== undefined && sec.endpath > removeEnd) sec.endpath += delta;
    }

    const newSeamIndex = removeStart + newPoints.length - 1;
    prev.endpath = newSeamIndex;
    next.startpath = newSeamIndex;
  }

  recomputePathDistances();
  return velocityLocks;
}

function shouldUseInPlaceTurn(absAngle: number, maxTrim: number): boolean {
  if (maxTrim <= 1e-9) return true;
  return absAngle >= IN_PLACE_TURN_ANGLE;
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

function findIndexBeforeByDist(startIndex: number, endIndex: number, targetDist: number): number {
  let i = startIndex;
  while (i < endIndex && pathpoints[i + 1].dist < targetDist) {
    i++;
  }
  return i;
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

function getDiffDriveCurvatureDenom(curvature: number): number {
  const w = bot.trackwidth;
  return Math.max(1 + (w * Math.abs(curvature)) / 2, 1e-6);
}

function getCurvatureLimitedVelocity(curvature: number): number {
  const w = bot.trackwidth;
  return (2 * MAX_VELOCITY) / Math.max(2 + w * Math.abs(curvature), 1e-6);
}

function getCurvatureLimitedAcceleration(curvature: number): number {
  const w = bot.trackwidth;
  return (2 * MAX_ACCELERATION) / Math.max(2 + w * Math.abs(curvature), 1e-6);
}

function getAvailableAcceleration(velocity: number, maxVel: number, maxAccel: number): number {
  const speed = Math.abs(velocity);
  const startDrop = 0.6 * maxVel;
  const endDrop = 1.1 * maxVel;

  if (speed <= startDrop) return maxAccel;
  if (speed >= endDrop) return 0;

  const t = (speed - startDrop) / (endDrop - startDrop);
  return maxAccel * (1 - t);
}

function getCurvatureLimitedDeceleration(curvature: number): number {
  const w = bot.trackwidth;
  return (2 * MAX_DECELERATION) / Math.max(2 + w * Math.abs(curvature), 1e-6);
}

function getMaxAngularVelocity(): number {
  return (2 * MAX_VELOCITY) / Math.max(bot.trackwidth, 1e-6);
}

function getMaxAngularAcceleration(): number {
  return (2 * MAX_ACCELERATION) / Math.max(bot.trackwidth, 1e-6);
}

function getMaxAngularDeceleration(): number {
  return (2 * MAX_DECELERATION) / Math.max(bot.trackwidth, 1e-6);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getAdaptiveStraightCurvatureThreshold(speed: number): number {
  const speedRatio = clamp01(speed / Math.max(MAX_VELOCITY, 1e-6));
  // At higher speeds, suppress tiny curvature noise more aggressively.
  return 0.008 + 0.02 * speedRatio;
}

function getEffectiveCurvaturePrime(k: number, dkRaw: number, speed: number): number {
  const absK = Math.abs(k);
  const threshold = getAdaptiveStraightCurvatureThreshold(speed);
  const blend = clamp01(absK / threshold);
  return dkRaw * blend;
}

function getLeftGain(curvature: number): number {
  return 1 - curvature * bot.trackwidth / 2;
}

function getRightGain(curvature: number): number {
  return 1 + curvature * bot.trackwidth / 2;
}

function getWheelStepDistance(ds: number, gainA: number, gainB: number): number {
  return ds * Math.max((Math.abs(gainA) + Math.abs(gainB)) / 2, 1e-6);
}

function maxLinearVelocityFromWheelState(
  neighborWheelVelocity: number,
  wheelStepDistance: number,
  currentGain: number,
  accelLimit: number
): number {
  const EPS = 1e-9;
  const maxAbsWheelVelocity = Math.sqrt(
    Math.max(0, neighborWheelVelocity * neighborWheelVelocity + 2 * accelLimit * wheelStepDistance)
  );
  if (Math.abs(currentGain) < EPS) return Infinity;
  return maxAbsWheelVelocity / Math.abs(currentGain);
}

function getWheelBounds(prev: pathPoint, curr: pathPoint, ds: number, accelLimit: number) {
  const gLPrev = getLeftGain(prev.curvature);
  const gLCurr = getLeftGain(curr.curvature);
  const gRPrev = getRightGain(prev.curvature);
  const gRCurr = getRightGain(curr.curvature);

  const leftStepDist = getWheelStepDistance(ds, gLPrev, gLCurr);
  const rightStepDist = getWheelStepDistance(ds, gRPrev, gRCurr);

  const leftBound = maxLinearVelocityFromWheelState(prev.velocity * gLPrev, leftStepDist, gLCurr, accelLimit);
  const rightBound = maxLinearVelocityFromWheelState(prev.velocity * gRPrev, rightStepDist, gRCurr, accelLimit);

  return { leftBound, rightBound };
}

function computeMaxVelocity(
  adjVelocity: number,
  maxAcceleration: number,
  distance: number
): number {
  return Math.sqrt(Math.max(0, adjVelocity ** 2 + 2 * maxAcceleration * distance));
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
    velocity: MAX_VELOCITY,
    angularVelocity: 0,
    dist: 0,
    accel: 0,
    time: 0,
    orientation: 0,
    rev: false,

    curvature: 0,
    curvaturePrime: 0,

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


