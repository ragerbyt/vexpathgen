import { left, MAX_ACCELERATION, MAX_VELOCITY, right, sections, section } from "./globals";
import { pathPoint, controlPoint } from "./globals";
import { pathpoints, controlpoints, bot } from "./globals";
import { Normalize, plot } from "./plot";
import { totalInterp} from "./globals"; 
import { _normalizeAngle, PI, requestAnimFrame, sign } from "chart.js/helpers";

export let leftVel : number[] = []
export let rightVel : number[] = []

export let numSegments = 0;

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

      
      const EPSILON = 1e-8;

      if (Math.abs(curr.endangle - nxt.startangle) > EPSILON) {
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
    const w = bot.trackwidth;

    const denomL = Math.abs(1 - p.curvature * w / 2);
    const denomR = Math.abs(1 + p.curvature * w / 2);

    const vCurvMax = Math.min(
      MAX_VELOCITY / Math.max(denomL, 1e-6),
      MAX_VELOCITY / Math.max(denomR, 1e-6)
    );

    p.velocity = Math.min(p.velocity, vCurvMax);
  }



}

export function computeBezierWaypoints() {

  createWaypoints();
  

  for (let i = 1; i < pathpoints.length; i++) {
    const ds = calcdistance(pathpoints[i], pathpoints[i - 1]);
    pathpoints[i].curvaturePrime =
      ds > 1e-6
        ? (pathpoints[i].curvature - pathpoints[i - 1].curvature) / ds
        : 0;
  }



  pathpoints[0].velocity = 0;
  pathpoints[pathpoints.length-1].velocity = 0;


  // --- Backward pass (decel) ---
  backwardpass();
  forwardpass();

  for (let i = 0; i < pathpoints.length; i++) {
    const p = pathpoints[i];
    const w = bot.trackwidth;

    p.leftvel  = p.velocity * (1 - p.curvature * w / 2);
    p.rightvel = p.velocity * (1 + p.curvature * w / 2);
  }

  //--- Compute timestamps and cumulative distance ---
  let totalTime = 0;
  pathpoints[0].time = 0;
  pathpoints[0].accel = 0;
  for (let i = 1; i < pathpoints.length; i++) {
    const distStep = calcdistance(pathpoints[i], pathpoints[i - 1]);
    const averagevel = (pathpoints[i].velocity + pathpoints[i - 1].velocity) / 2;
    totalTime += distStep / averagevel;
    pathpoints[i].time = totalTime;
    pathpoints[i].accel = (pathpoints[i].velocity - pathpoints[i - 1].velocity) / (distStep / averagevel);
  }

  if(pathpoints[pathpoints.length-1].time != Infinity){
    plot();
  }
  
}

function backwardpass(){
  for (let i = pathpoints.length - 2; i >= 0; i--) {
    const currentPoint = pathpoints[i];
    const futureVelocity = pathpoints[i + 1].velocity;
    const distStep = calcdistance(pathpoints[i], pathpoints[i + 1]);

    const k = currentPoint.curvature;
    const dk = pathpoints[i + 1].curvaturePrime;           // look ahead
    const w = bot.trackwidth;
    const v = Math.min(
      currentPoint.velocity,
      futureVelocity // or prev velocity in forward pass
    );

    const wheelAccelLimit =
      MAX_ACCELERATION -
      (w / 2) * v * v * Math.abs(dk);

    const accel =
      Math.max(0,
        wheelAccelLimit /
        Math.max(Math.abs(1 - k*w/2), Math.abs(1 + k*w/2))
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
    const dk = pathpoints[i].curvaturePrime;               // current segment
    const w = bot.trackwidth;
    const v = Math.min(
      currentPoint.velocity,
      prevPoint.velocity // or prev velocity in forward pass
    );

    const wheelAccelLimit =
      MAX_ACCELERATION -
      (w / 2) * v * v * Math.abs(dk);

    const accel =
      Math.max(0,
        wheelAccelLimit /
        Math.max(Math.abs(1 - k*w/2), Math.abs(1 + k*w/2))
      );


    currentPoint.velocity = Math.min(
      currentPoint.velocity,
      computeMaxVelocity(prevPoint.velocity, accel, distStep)
    );
    currentPoint.angularVelocity = currentPoint.velocity * currentPoint.curvature;
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
function bezierDerivative(pts: { x: number; y: number }[], t: number) {
  const dx = 3 * (1 - t) ** 2 * (pts[1].x - pts[0].x)
           + 6 * (1 - t) * t * (pts[2].x - pts[1].x)
           + 3 * t ** 2 * (pts[3].x - pts[2].x);
  const dy = 3 * (1 - t) ** 2 * (pts[1].y - pts[0].y)
           + 6 * (1 - t) * t * (pts[2].y - pts[1].y)
           + 3 * t ** 2 * (pts[3].y - pts[2].y);
  return { dx, dy };
}

function bezierSecondDerivative(
  pts: { x: number; y: number }[],
  t: number
) {
  const ddx =
    6 * (1 - t) * (pts[2].x - 2 * pts[1].x + pts[0].x) +
    6 * t       * (pts[3].x - 2 * pts[2].x + pts[1].x);

  const ddy =
    6 * (1 - t) * (pts[2].y - 2 * pts[1].y + pts[0].y) +
    6 * t       * (pts[3].y - 2 * pts[2].y + pts[1].y);

  return { ddx, ddy };
}

function bezierCurvature(
  pts: { x: number; y: number }[],
  t: number
) {
  const { dx, dy } = bezierDerivative(pts, t);
  const { ddx, ddy } = bezierSecondDerivative(pts, t);

  const numerator = Math.abs(dx * ddy - dy * ddx);
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
  const f = 2;
  p1.x = p0.x + f * (p1.x - p0.x);
  p1.y = p0.y + f * (p1.y - p0.y);
  p2.x = p3.x + f * (p2.x - p3.x);
  p2.y = p3.y + f * (p2.y - p3.y);
  return seg;
}


function fillbezier(sectpts: controlPoint[], currsection: section, count: number){

  currsection.startpath = pathpoints.length;
      
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const wp = createpathpoint()

      // Bézier point
      for (let j = 0; j < 4; j++) {
        const coeff = binomialCoefficient(3, j)
        * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
        wp.x += coeff * sectpts[j].x;
        wp.y += coeff * sectpts[j].y;
      }
      const { dx, dy } = bezierDerivative(sectpts, t);
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

      wp.curvature = bezierCurvature(sectpts, t);
      pathpoints.push(wp);

    }

    currsection.endpath = pathpoints.length-1;
}


function fillline(sectpts: controlPoint[], currsection: section, count: number){

  currsection.startpath = pathpoints.length;

  for (let i = 0; i <= count; i++) {
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

