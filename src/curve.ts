import { left, MAX_ACCELERATION, MAX_VELOCITY, right, sections, section } from "./globals";
import { pathPoint, controlPoint } from "./globals";
import { pathpoints, controlpoints, bot } from "./globals";
import { Normalize, plot } from "./plot";
import { totalInterp} from "./globals"; 
import { _normalizeAngle, PI, requestAnimFrame, sign } from "chart.js/helpers";

export let leftVel : number[] = []
export let rightVel : number[] = []

export let numSegments = 0;

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

function createWaypoints(){
  // Clear any existing waypoints
  pathpoints.splice(0, pathpoints.length);
  if (controlpoints.length <= 1) return;

  numSegments = sections.length

  // const ptsPerSeg = Math.floor(totalInterp / numSegments);
  // const remainder = totalInterp - ptsPerSeg * numSegments;
  const count = 1000;

  totalSeg = count * numSegments
  
  for (let seg = 0; seg < numSegments; seg++) {
    const currsection = sections[seg];
    const segtype = currsection.type

    const sectpts = isolate(controlpoints, currsection.startcontrol, currsection.endcontrol);


    if(segtype == "bezier"){
      fillbezier(sectpts,  currsection, count)
    }else{
      fillline(sectpts,  currsection, count)
    }

    if(seg != numSegments - 1){
      const curr = sections[seg]
      const nxt = sections[seg+1]

      
      const EPSILON = 1e-4;
      const angleDelta = Math.abs(_normalizeAngle(curr.endangle - nxt.startangle));

      if (angleDelta > EPSILON) {
        fillturn(curr.endx, curr.endy, curr.endangle, nxt.startangle, 10, false);
      }
      
    }
  }


  for(let i = 0; i < pathpoints.length-1; i++)
  {
    if(
    pathpoints[i].x == pathpoints[i+1].x &&
    pathpoints[i].y == pathpoints[i+1].y &&
    pathpoints[i].orientation == pathpoints[i+1].orientation
    ){

      for(let seg = 0; seg < sections.length; seg++){
        if(sections[seg].startpath! >= i){
          sections[seg].startpath!--;
        }

        if(sections[seg].endpath! >= i){
          sections[seg].endpath!--;

        }
      }
      pathpoints.splice(i,1)

    }
  }

  // console.log(pathpoints)

  for (let i = 0; i < pathpoints.length; i++) {
    const p = pathpoints[i];
    const vCurvMax = getCurvatureLimitedVelocity(p.curvature);

    p.velocity = Math.min(p.velocity, vCurvMax);
  }



}

export function computeBezierWaypoints() {

  createWaypoints();
  smoothCurvatureAtSectionSeams();
  computeStableCurvaturePrime();



  pathpoints[0].velocity = 0;
  pathpoints[pathpoints.length-1].velocity = 0;


  // --- Backward pass (decel) ---
  backwardpass();
  forwardpass();
  enforceWheelAccelerationLimits();

  for (let i = 0; i < pathpoints.length; i++) {
    const p = pathpoints[i];
    const w = bot.trackwidth;

    p.leftvel  = p.velocity * (1 - p.curvature * w / 2);
    p.rightvel = p.velocity * (1 + p.curvature * w / 2);
  }

  //--- Compute timestamps and cumulative distance ---
  let totalTime = 0;
  const EPS = 1e-9;
  pathpoints[0].time = 0;
  pathpoints[0].accel = 0;
  for (let i = 1; i < pathpoints.length; i++) {
    const distStep = calcdistance(pathpoints[i], pathpoints[i - 1]);
    const averagevel = (pathpoints[i].velocity + pathpoints[i - 1].velocity) / 2;
    const dt = (distStep > EPS && Math.abs(averagevel) > EPS)
      ? distStep / Math.abs(averagevel)
      : 0;

    totalTime += dt;
    pathpoints[i].time = totalTime;
    pathpoints[i].accel = dt > EPS
      ? (pathpoints[i].velocity - pathpoints[i - 1].velocity) / dt
      : 0;
  }

  if(pathpoints[pathpoints.length-1].time != Infinity){
    plot();
  }
  
}

function smoothCurvatureAtSectionSeams() {
  if (sections.length < 2 || pathpoints.length < 3) return;

  for (let seg = 0; seg < sections.length - 1; seg++) {
    const seam = sections[seg].endpath;
    if (seam === undefined) continue;
    if (seam <= 0 || seam >= pathpoints.length - 1) continue;

    const headingJump = Math.abs(_normalizeAngle(sections[seg].endangle - sections[seg + 1].startangle));
    if (headingJump > 0.2) continue;

    const kPrev = pathpoints[seam - 1].curvature;
    const kSeam = pathpoints[seam].curvature;
    const kNext = pathpoints[seam + 1].curvature;

    const signFlip = kPrev * kNext < 0;
    const spikeLike = Math.abs(kSeam) > 1.05 * Math.max(Math.abs(kPrev), Math.abs(kNext), 1e-6);

    if (signFlip || spikeLike) {
      // Force omega taper through the seam instead of flipping abruptly.
      pathpoints[seam].curvature = 0;
      pathpoints[seam - 1].curvature *= 0.35;
      pathpoints[seam + 1].curvature *= 0.35;

      if (seam - 2 >= 0) {
        pathpoints[seam - 2].curvature = 0.55 * pathpoints[seam - 2].curvature + 0.45 * pathpoints[seam - 1].curvature;
      }
      if (seam + 2 < pathpoints.length) {
        pathpoints[seam + 2].curvature = 0.55 * pathpoints[seam + 2].curvature + 0.45 * pathpoints[seam + 1].curvature;
      }
      if (seam - 3 >= 0) {
        pathpoints[seam - 3].curvature = 0.75 * pathpoints[seam - 3].curvature + 0.25 * pathpoints[seam - 2].curvature;
      }
      if (seam + 3 < pathpoints.length) {
        pathpoints[seam + 3].curvature = 0.75 * pathpoints[seam + 3].curvature + 0.25 * pathpoints[seam + 2].curvature;
      }
    }
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

function backwardpass(){
  for (let i = pathpoints.length - 2; i >= 0; i--) {
    const currentPoint = pathpoints[i];
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
    const accelCurvatureCap = getCurvatureLimitedAcceleration(k);
    const wheelAccelLimit =
      MAX_ACCELERATION -
      (w / 2) * v * v * Math.abs(dk);

    const accel = Math.min(
      accelCurvatureCap,
      Math.max(0, wheelAccelLimit / denom)
    );

    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(futureVelocity, accel, distStep)
    );
  }
}

function forwardpass(){
  for (let i = 1; i < pathpoints.length; i++) {
    const currentPoint = pathpoints[i];
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
    const accelCurvatureCap = getCurvatureLimitedAcceleration(k);
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
    currentPoint.angularVelocity = currentPoint.velocity * currentPoint.curvature;
  }
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
  currentGain: number
): number {
  const EPS = 1e-9;
  const maxAbsWheelVelocity = Math.sqrt(
    Math.max(0, neighborWheelVelocity * neighborWheelVelocity + 2 * MAX_ACCELERATION * wheelStepDistance)
  );
  if (Math.abs(currentGain) < EPS) return Infinity;
  return maxAbsWheelVelocity / Math.abs(currentGain);
}

function enforceWheelAccelerationLimits() {
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
      const ds = calcdistance(prev, curr);
      if (ds <= EPS) continue;

      const gLPrev = getLeftGain(prev.curvature);
      const gLCurr = getLeftGain(curr.curvature);
      const gRPrev = getRightGain(prev.curvature);
      const gRCurr = getRightGain(curr.curvature);

      const leftStepDist = getWheelStepDistance(ds, gLPrev, gLCurr);
      const rightStepDist = getWheelStepDistance(ds, gRPrev, gRCurr);

      const leftBound = maxLinearVelocityFromWheelState(prev.velocity * gLPrev, leftStepDist, gLCurr);
      const rightBound = maxLinearVelocityFromWheelState(prev.velocity * gRPrev, rightStepDist, gRCurr);

      curr.velocity = Math.min(
        curr.velocity,
        getCurvatureLimitedVelocity(curr.curvature),
        leftBound,
        rightBound
      );
    }

    // Backward sweep
    for (let i = pathpoints.length - 2; i >= 0; i--) {
      const curr = pathpoints[i];
      const next = pathpoints[i + 1];
      const ds = calcdistance(curr, next);
      if (ds <= EPS) continue;

      const gLCurr = getLeftGain(curr.curvature);
      const gLNext = getLeftGain(next.curvature);
      const gRCurr = getRightGain(curr.curvature);
      const gRNext = getRightGain(next.curvature);

      const leftStepDist = getWheelStepDistance(ds, gLCurr, gLNext);
      const rightStepDist = getWheelStepDistance(ds, gRCurr, gRNext);

      const leftBound = maxLinearVelocityFromWheelState(next.velocity * gLNext, leftStepDist, gLCurr);
      const rightBound = maxLinearVelocityFromWheelState(next.velocity * gRNext, rightStepDist, gRCurr);

      curr.velocity = Math.min(
        curr.velocity,
        getCurvatureLimitedVelocity(curr.curvature),
        leftBound,
        rightBound
      );
    }

    let maxDelta = 0;
    for (let i = 0; i < pathpoints.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(pathpoints[i].velocity - before[i]));
    }
    if (maxDelta < TOL) break;
  }
}


export let totalSeg = 100 * numSegments
export const ptsPerSeg = 100;



function getWheelDistances(
  x0: number, y0: number, theta0: number,
  x1: number, y1: number, theta1: number,
  trackWidth: number
) {
  let dtheta = theta1 - theta0;
  while (dtheta > Math.PI) dtheta -= 2 * Math.PI;
  while (dtheta < -Math.PI) dtheta += 2 * Math.PI;

  const dx = x1 - x0;
  const dy = y1 - y0;

  // Forward movement along robot's initial orientation
  const forward = Math.cos(theta0) * dx + Math.sin(theta0) * dy;
  const strafe  = -Math.sin(theta0) * dx + Math.cos(theta0) * dy;

  const EPS = 1e-6;
  let leftDist = 0, rightDist = 0;

  
    const halfTrack = trackWidth / 2;

    // Left and right wheel positions at the initial state
    const leftWheelStartX = x0 - halfTrack * Math.sin(theta0);
    const leftWheelStartY = y0 + halfTrack * Math.cos(theta0);
    const rightWheelStartX = x0 + halfTrack * Math.sin(theta0);
    const rightWheelStartY = y0 - halfTrack * Math.cos(theta0);

    // Left and right wheel positions at the final state
    const leftWheelEndX = x1 - halfTrack * Math.sin(theta1);
    const leftWheelEndY = y1 + halfTrack * Math.cos(theta1);
    const rightWheelEndX = x1 + halfTrack * Math.sin(theta1);
    const rightWheelEndY = y1 - halfTrack * Math.cos(theta1);

    // Compute distances traveled by each wheel
    leftDist = Math.hypot(leftWheelEndX - leftWheelStartX, leftWheelEndY - leftWheelStartY);
    rightDist = Math.hypot(rightWheelEndX - rightWheelStartX, rightWheelEndY - rightWheelStartY);

    // Determine direction for each wheel
    const leftDir = Math.sign(
      Math.cos(theta0) * (leftWheelEndX - leftWheelStartX) +
      Math.sin(theta0) * (leftWheelEndY - leftWheelStartY)
    );
    const rightDir = Math.sign(
      Math.cos(theta0) * (rightWheelEndX - rightWheelStartX) +
      Math.sin(theta0) * (rightWheelEndY - rightWheelStartY)
    );

    leftDist *= leftDir;
    rightDist *= rightDir;
  

  return { leftDist, rightDist };
}




// --- Helpers ---
function bernstein(n: number, i: number, t: number): number {
  return binomialCoefficient(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i);
}

function toSixPointBezier(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length >= 6) return pts.slice(0, 6);
  if (pts.length === 4) {
    const [p0, p1, p2, p3] = pts;
    return [p0, p1, p1, p2, p2, p3];
  }
  return pts;
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
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function isolate(controlpoints: controlPoint[], start: number, end: number): controlPoint[] {
  const seg = controlpoints
    .slice(start, end + 1)
    .map(p => ({ ...p }));
  if (seg.length < 4) return seg;
  const [p0, p1, p2, p3] = seg;
  // UI handles stay where user placed them, but solver uses a scaled handle distance.
  // f < 1 pulls solver handles inward; f > 1 pushes them outward.
  const f = 1.25;
  p1.x = p0.x + f * (p1.x - p0.x);
  p1.y = p0.y + f * (p1.y - p0.y);
  p2.x = p3.x + f * (p2.x - p3.x);
  p2.y = p3.y + f * (p2.y - p3.y);
  return seg;
}


function fillbezier(sectpts: controlPoint[], currsection: section, count: number){
  const bezierPts = toSixPointBezier(sectpts);
  const degree = bezierPts.length - 1;

  currsection.startpath = pathpoints.length === 0 ? 0 : pathpoints.length - 1;
  const startI = pathpoints.length === 0 ? 0 : 1;
      
    for (let i = startI; i <= count; i++) {
      const t = i / count;
      const wp = createpathpoint()

      // Bézier point
      for (let j = 0; j < bezierPts.length; j++) {
        const coeff = bernstein(degree, j, t);
        wp.x += coeff * bezierPts[j].x;
        wp.y += coeff * bezierPts[j].y;
      }
      const { dx, dy } = bezierDerivative(bezierPts, t);
      wp.orientation = Math.atan2(dy, dx);

      if(i == 0){
        const first = sectpts[0];
        wp.orientation = Math.atan2(first.angley!, first.anglex!);
      }else if(i == count){
        const last = sectpts[3];
        wp.orientation = Math.atan2(last.angley!, last.anglex!);
      }

      if (pathpoints.length > 0) {
        let dist = calcdistance(pathpoints[pathpoints.length - 1], wp);
        wp.dist = pathpoints[pathpoints.length-1].dist + dist;
      }

      if(currsection.rev){
        wp.orientation = wp.orientation + PI;
      }

      wp.curvature = bezierCurvature(bezierPts, t);
      pathpoints.push(wp);

    }

    currsection.endpath = pathpoints.length-1;
}


function fillline(sectpts: controlPoint[], currsection: section, count: number){

  currsection.startpath = pathpoints.length === 0 ? 0 : pathpoints.length - 1;
  const startI = pathpoints.length === 0 ? 0 : 1;

  for (let i = startI; i <= count; i++) {
    const t = i / count;
    const wp = createpathpoint()
  
    wp.x =  sectpts[0].x + t/1 * (sectpts[1].x - sectpts[0].x);
    wp.y =  sectpts[0].y + t/1 * (sectpts[1].y - sectpts[0].y);

    let f = 1; if(currsection.rev){ f = -1};

    const dx = sectpts[1].x - sectpts[0].x;
    const dy = sectpts[1].y - sectpts[0].y;    
    wp.orientation = Math.atan2(dy, dx);

    if(currsection.rev){
      wp.orientation = wp.orientation + PI;
    }

    if (pathpoints.length > 0) {
      let dist = calcdistance(pathpoints[pathpoints.length - 1], wp);
      wp.dist = pathpoints[pathpoints.length-1].dist + dist;
    }

    pathpoints.push(wp)
  }

  currsection.endpath = pathpoints.length-1;

} 

function fillturn(x: number, y: number, startangle: number, endangle: number, count: number, rev : boolean){
  function NormalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  let angleError = NormalizeAngle(endangle - startangle);


  for (let i = 0; i <= count; i++) {
    const t = (i+1) / (count+2);
    const wp = createpathpoint()    
  
    wp.x = x
    wp.y = y
    
    wp.orientation = startangle + t * angleError;

    wp.orientation = NormalizeAngle(wp.orientation); // Ensure it's still in [-π, π]

    wp.dist = pathpoints[pathpoints.length-1].dist
    pathpoints.push(wp)
  }
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

const V_MIN = 0.05 * MAX_VELOCITY;

