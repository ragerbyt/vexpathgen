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
  totalSeg = 100 * numSegments
  
  for (let seg = 0; seg < numSegments; seg++) {
    const currsection = sections[seg];
    const segtype = currsection.type

    const sectpts = isolate(controlpoints, currsection.startcontrol, currsection.endcontrol);
    const count = ptsPerSeg-1;


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

  console.log(pathpoints)

  for (let i = 0; i < pathpoints.length-1; i++) {
    const curr = pathpoints[i];
    const nxt = pathpoints[i+1];

    const { leftDist, rightDist } = getWheelDistances(
      curr.x, curr.y, curr.orientation,
      nxt.x, nxt.y, nxt.orientation,
      bot.trackwidth
    );

    curr.leftdist = leftDist;
    curr.rightdist = rightDist;    
  }





  for (let i = 0; i < pathpoints.length; i++) {
    const curr = pathpoints[i];
    const heading = curr.orientation;

    const leftX = -Math.sin(heading);
    const leftY = Math.cos(heading);
    const halfW = bot.trackwidth / 2;

    curr.leftx = curr.x + leftX * halfW
    curr.lefty = curr.y + leftY * halfW
    curr.leftvel = MAX_VELOCITY
    
    curr.rightx = curr.x - leftX * halfW
    curr.righty = curr.y - leftY * halfW
    curr.rightvel = MAX_VELOCITY
  }

}

export function computeBezierWaypoints() {

  createWaypoints();
  

  for (let i = 1; i < pathpoints.length; i++) {
    let f = 1; if(pathpoints[i-1].rev){ f = -1;}

    // once left is inner, reverse left; keep outer (right) forward
    if (Math.sign(pathpoints[i-1].leftdist) == -1) {
      pathpoints[i].leftvel  = -MAX_VELOCITY * f;
    }else{
      pathpoints[i].leftvel  =  MAX_VELOCITY * f;
    }
    // once right is  , reverse right; keep outer (left) forward
    if (Math.sign(pathpoints[i-1].rightdist) == -1) {
      pathpoints[i].rightvel = -MAX_VELOCITY * f;
    }else{
      pathpoints[i].rightvel =  MAX_VELOCITY * f;
    }

    // on the frame where left becomes inner, zero left
    if((Math.sign(pathpoints[i-1].rightdist) != Math.sign(pathpoints[i].rightdist) && pathpoints[i].rightdist != 0)){
      pathpoints[i].rightvel = 0;
    }
    
    if(Math.sign(pathpoints[i-1].leftdist) != Math.sign(pathpoints[i].leftdist) && pathpoints[i].leftdist != 0){
      pathpoints[i].leftvel = 0;
    }
  }

  

  // zero endpoints
  pathpoints[0].leftvel = 0;
  pathpoints[pathpoints.length-1].leftvel = 0;


  pathpoints[0].rightvel = 0;
  pathpoints[pathpoints.length-1].rightvel = 0;


  // --- Backward pass (decel) ---
  backwardpass();
  //fwd pass
  forwardpass();
  

  // Recombine
  for (let i = 0; i < pathpoints.length; i++) {
    const vL = pathpoints[i].leftvel, vR = pathpoints[i].rightvel;
    const vc = (vL + vR) / 2;
    const ω  = (vR - vL) / bot.trackwidth;
    pathpoints[i].velocity        = vc;
    pathpoints[i].angularVelocity = ω;

    //console.log(vc)
  }

  // --- Timestamp & accel compute ---
  let cumtime = 0;
  pathpoints[0].time  = 0;
  pathpoints[0].accel = 0;
  for (let i = 1; i < pathpoints.length; i++) {
    let f = 1; if(pathpoints[i].rev) f = -1


    const ds  = calcdistance(pathpoints[i], pathpoints[i - 1]);
    const avg = (pathpoints[i].velocity + pathpoints[i - 1].velocity) / 2;

    // console.log(leftdt[i-1].vel,pathpoints[i].leftvel, leftdt.length)


    const timeL = Math.abs(pathpoints[i-1].leftdist / ((pathpoints[i].leftvel + pathpoints[i-1].leftvel)/2))

    const timeR = Math.abs(pathpoints[i-1].rightdist / ((pathpoints[i].rightvel + pathpoints[i-1].rightvel)/2))

    if(((pathpoints[i].leftvel + pathpoints[i-1].leftvel)/2) == 0){
      cumtime += timeR

    }else if(((pathpoints[i].rightvel + pathpoints[i-1].rightvel)/2) == 0){
      cumtime += timeL
    }else{
      cumtime += (timeL + timeR)/2
    }

    // console.log(timeL, i)

    


    //cumtime += ds / Math.abs(avg);


    pathpoints[i].time  = cumtime;

    //console.log(pathpoints[i].dist)
    //console.log(timeL,timeR)
    pathpoints[i].accel = (pathpoints[i].velocity - pathpoints[i - 1].velocity)
                        / (ds / avg) * f;

    if(pathpoints[i].accel > MAX_ACCELERATION + 1){
      //console.log("uh", i)
    }

    
  }

  if(pathpoints[pathpoints.length-1].time != Infinity){
    plot();

  }
  
}

function forwardpass(){
  for (let i = 1; i < pathpoints.length; i++) {
    if(pathpoints[i].leftvel == 0 && pathpoints[i].rightvel == 0){continue;}

    let f = 1; if(pathpoints[i].rev) f = -1;


    let lf = f * sign(pathpoints[i-1].leftdist); 
    const dL = pathpoints[i-1].leftdist * f;


    let rf = f * sign(pathpoints[i-1].rightdist);
    const dR = pathpoints[i-1].rightdist * f;

    const vL_prev = pathpoints[i - 1].leftvel;
    const vR_prev = pathpoints[i - 1].rightvel;


    let maxVL = 0;
    let maxVR = 0;

    maxVL = Math.min(Math.abs(MAX_VELOCITY * lf),   
                     Math.abs(lf * computeMaxVelocity(lf * vL_prev, MAX_ACCELERATION, lf * dL)),
                     Math.abs(pathpoints[i].leftvel)) * lf;


    maxVR = Math.min(Math.abs(MAX_VELOCITY * rf),   
                     Math.abs(rf * computeMaxVelocity(rf * vR_prev, MAX_ACCELERATION, rf * dR)),
                     Math.abs(pathpoints[i].rightvel)) * rf;

    const maxVC_from_L = maxVL / (dL / f); 
    const maxVC_from_R = maxVR / (dR / f);

    const vc_mag = Math.min(Math.abs(maxVC_from_L), Math.abs(maxVC_from_R));
    const maxVC = f * vc_mag;

    pathpoints[i].leftvel  = maxVC * (dL / f);
    pathpoints[i].rightvel = maxVC * (dR / f);
  }
}

function backwardpass(){
  for (let i = pathpoints.length - 2; i >= 0; i--) {

    if(pathpoints[i].leftvel == 0 && pathpoints[i].rightvel == 0){continue;}
    let f = 1; if(pathpoints[i].rev) f = -1;


    let lf = f * sign(pathpoints[i].leftdist); 
    const dL = pathpoints[i].leftdist * f;


    let rf = f * sign(pathpoints[i].rightdist);
    const dR = pathpoints[i].rightdist * f;
    
    const vL_nxt = pathpoints[i + 1].leftvel;
    const vR_nxt = pathpoints[i + 1].rightvel;


    let maxVL = 0;
    let maxVR = 0;


    maxVL = Math.min(Math.abs(MAX_VELOCITY * lf),   
                     Math.abs(lf * computeMaxVelocity(lf * vL_nxt, MAX_ACCELERATION, lf * dL)),
                     Math.abs(pathpoints[i].leftvel)) * lf;



    maxVR = Math.min(Math.abs(MAX_VELOCITY * rf),   
                     Math.abs(rf * computeMaxVelocity(rf * vR_nxt, MAX_ACCELERATION, rf * dR)),
                     Math.abs(pathpoints[i].rightvel)) * rf;

                    

    // Use dL and dR only — no center dist
    const maxVC_from_L = maxVL / (dL / f);  // cancel out f so you don't divide by zero
    const maxVC_from_R = maxVR / (dR / f);

    const vc_mag = Math.min(Math.abs(maxVC_from_L), Math.abs(maxVC_from_R));
    const maxVC = f * vc_mag;

    pathpoints[i].leftvel  = maxVC * (dL / f);
    pathpoints[i].rightvel = maxVC * (dR / f);
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

  if (Math.abs(dtheta) < EPS) {
    // Straight motion
    const dist = Math.hypot(dx, dy);
    const dir = Math.sign(forward); // Determine direction based on orientation
    leftDist = rightDist = dist * dir;
  } else if (Math.abs(forward) < EPS && Math.abs(strafe) < EPS) {
    // Pure in-place rotation
    leftDist = -dtheta * (trackWidth / 2);
    rightDist = dtheta * (trackWidth / 2);
  } else {
    const radius = forward / dtheta;
    leftDist = (radius - trackWidth / 2) * dtheta;
    rightDist = (radius + trackWidth / 2) * dtheta;
  }

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
  const f = 1;
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