import { left, MAX_ACCELERATION, MAX_VELOCITY, right } from "./globals";
import { pathPoint, controlPoint, Point } from "./globals";
import { pathpoints, controlpoints, bot, leftdt, rightdt } from "./globals";
import { plot } from "./plot";
import { totalInterp} from "./globals"; 

export let leftVel : number[] = []
export let rightVel : number[] = []

export let numSegments = 0;

export function computeBezierWaypoints() {
  // Clear any existing waypoints
  pathpoints.splice(0, pathpoints.length);
  if (controlpoints.length === 0) return;

  let totaldist = 0;
  numSegments = (controlpoints.length - 1) / 3;

  // --- Uniform per-segment interpolation ---
  const ptsPerSeg = Math.floor(totalInterp / numSegments);
  const remainder = totalInterp - ptsPerSeg * numSegments;

  for (let seg = 0; seg < numSegments; seg++) {
    const sectpts = section(controlpoints, seg);
    const count = seg === numSegments - 1 ? ptsPerSeg + remainder : ptsPerSeg;



    for (let i = 0; i < count; i++) {
      const t = i / count;
      const wp: pathPoint = {
        x: 0, y: 0,
        velocity: MAX_VELOCITY,
        curvature: 0,
        angularVelocity: 0,
        dist: 0,
        accel: 0,
        time: 0,
        orientation: 0,
        rev: sectpts[0].rev!,
      };
      // Bézier point
      for (let j = 0; j < 4; j++) {
        const coeff = binomialCoefficient(3, j)
          * Math.pow(1 - t, 3 - j) * Math.pow(t, j);
        wp.x += coeff * sectpts[j].x;
        wp.y += coeff * sectpts[j].y;
      }
      if (pathpoints.length > 0) {
        let dist = calcdistance(pathpoints[pathpoints.length - 1], wp);
        totaldist += dist;

      }else{
        const first = controlpoints[0];
        if(first.rev){wp.orientation = Math.atan2(-first.angley!, -first.anglex!);}
        else{         wp.orientation = Math.atan2(first.angley!, first.anglex!);}
      }

      wp.dist = totaldist;
      pathpoints.push(wp);
    }
  }

  // Append exact final endpoint at t=1 of last segment
  {
    const sectpts = section(controlpoints, numSegments - 1);
    const finalcontrol = controlpoints[controlpoints.length-1];
    const finalWP: pathPoint = {
      x: finalcontrol.x, y: finalcontrol.y,
      velocity: 0,
      curvature: 0,
      angularVelocity: 0,
      dist: 0,
      accel: 0,
      time: 0,
      orientation: 0,
      rev: controlpoints[controlpoints.length-4].rev!,
    };

    let dist = calcdistance(pathpoints[pathpoints.length - 1], finalWP);
    totaldist += dist;
    finalWP.dist = totaldist;

    const onebefore = controlpoints[controlpoints.length-4]

    if(onebefore.rev){finalWP.orientation = Math.atan2(-finalcontrol.angley!, -finalcontrol.anglex!);}
    else{                finalWP.orientation = Math.atan2(finalcontrol.angley!, finalcontrol.anglex!);}

    pathpoints.push(finalWP)
  }

  // --- Compute geometry-based curvature & orientation ---
  for (let i = 1; i < pathpoints.length-1; i++) {
    
    const result = calculate_Curvature_Orientation(
      pathpoints[i - 1],
      pathpoints[i],
      pathpoints[i + 1]
    );
    const κ = result.curvature;
    const o = result.orientation;

    pathpoints[i].curvature   = κ;
    pathpoints[i].orientation = o;
  }

  // Build left/right trajectory points
  leftdt.splice(0, leftdt.length);
  rightdt.splice(0, rightdt.length);

  for (let i = 0; i < pathpoints.length; i++) {
    const curr = pathpoints[i];
    const heading = curr.orientation;

    const leftX = -Math.sin(heading);
    const leftY = Math.cos(heading);
    const halfW = bot.trackwidth / 2;

    const currstate = curr.rev;

    leftdt.push({
      x: curr.x + leftX * halfW,
      y: curr.y + leftY * halfW,
      vel: MAX_VELOCITY,
      neg: false,
      rev: currstate,
    });

    rightdt.push({
      x: curr.x - leftX * halfW,
      y: curr.y - leftY * halfW,
      vel: MAX_VELOCITY,
      neg: false,
      rev: currstate,
    });
  }

  console.log(pathpoints)


  // Start at i=1 so we can compare to the previous point
  // threshold curvature where inner‐wheel radius goes negative:
  const threshold = 2 / bot.trackwidth;

  for (let i = 1; i < pathpoints.length; i++) {
    const κCurr = pathpoints[i].curvature;


    leftdt[i].neg = κCurr >  threshold;

    rightdt[i].neg = κCurr < -threshold;

    let f = 1; if(leftdt[i].rev) f = -1;

    // once left is inner, reverse left; keep outer (right) forward
    if (leftdt[i].neg) {
      leftdt[i].vel  = -MAX_VELOCITY * f;
    }else{
      leftdt[i].vel  =  MAX_VELOCITY * f;
    }
    // once right is inner, reverse right; keep outer (left) forward
    if (rightdt[i].neg) {
      rightdt[i].vel = -MAX_VELOCITY * f;
    }else{
      rightdt[i].vel =  MAX_VELOCITY * f;
    }

    // on the frame where left becomes inner, zero left
    if (leftdt[i].neg != leftdt[i-1].neg) {
      leftdt[i].vel = 0;
      leftdt[i - 1].vel = 0;
    }
    // on the frame where right becomes inner, zero right
    if (rightdt[i].neg != rightdt[i-1].neg) {
      rightdt[i].vel = 0;
      rightdt[i - 1].vel = 0;
    }
  }

  // zero endpoints
  leftdt[0].vel = 0;
  rightdt[0].vel = 0;
  leftdt[leftdt.length - 1].vel = 0;
  rightdt[rightdt.length - 1].vel = 0;


  // --- Backward pass (decel) ---
  for (let i = pathpoints.length - 2; i >= 0; i--) {
    const dist   = pathpoints[i + 1].dist - pathpoints[i].dist;

    let f = 1; if(leftdt[i].rev) f = -1;


    let lf = f;
    if(leftdt[i].neg) lf = -lf;
    const dL = calcdistance(leftdt[i+1],leftdt[i]) * lf;


    let rf = f;
    if(rightdt[i].neg) rf = -rf;
    const dR = calcdistance(rightdt[i+1],rightdt[i]) * rf;
    
    const vL_nxt = leftdt[i + 1].vel;
    const vR_nxt = rightdt[i + 1].vel;


    let maxVL = 0;
    let maxVR = 0;


    maxVL = Math.min(Math.abs(MAX_VELOCITY * lf),   
                     Math.abs(lf * computeMaxVelocity(lf * vL_nxt, MAX_ACCELERATION, lf * dL)),
                     Math.abs(leftdt[i].vel)) * lf;

    console.log(lf * computeMaxVelocity(lf * vL_nxt, MAX_ACCELERATION, lf * dL))

 
    maxVR = Math.min(Math.abs(MAX_VELOCITY * rf),   
                     Math.abs(rf * computeMaxVelocity(rf * vR_nxt, MAX_ACCELERATION, rf * dR)),
                     Math.abs(rightdt[i].vel)) * rf;

    

    const maxVC_from_L = maxVL * (dist / dL);
    const maxVC_from_R = maxVR * (dist / dR);
    const vc_mag       = Math.min(Math.abs(maxVC_from_L), Math.abs(maxVC_from_R));
    const signC        = Math.sign((maxVL + maxVR) / 2);
    const maxVC        = signC * vc_mag;

    leftdt[i].vel  = maxVC * (dL / dist) * f;
    rightdt[i].vel = maxVC * (dR / dist) * f;

  }

  console.log(leftdt)

  //fwd pass
  for (let i = 1; i < pathpoints.length; i++) {
    const dist = pathpoints[i].dist - pathpoints[i-1].dist;

    let f = 1; if(leftdt[i].rev) f = -1;


    let lf = f;
    if(leftdt[i].neg) lf = -lf;
    const dL = calcdistance(leftdt[i-1],leftdt[i]) * lf;

    let rf = f;
    if(rightdt[i].neg) rf = -rf;
    const dR = calcdistance(rightdt[i-1],rightdt[i]) * rf;
    
    const vL_prev = leftdt[i - 1].vel;
    const vR_prev = rightdt[i - 1].vel;


    let maxVL = 0;
    let maxVR = 0;

    maxVL = Math.min(Math.abs(MAX_VELOCITY * lf),   
                     Math.abs(lf * computeMaxVelocity(lf * vL_prev, MAX_ACCELERATION, lf * dL)),
                     Math.abs(leftdt[i].vel)) * lf;



 
    maxVR = Math.min(Math.abs(MAX_VELOCITY * rf),   
                     Math.abs(rf * computeMaxVelocity(rf * vR_prev, MAX_ACCELERATION, rf * dR)),
                     Math.abs(rightdt[i].vel)) * rf;

    const maxVC_from_L = maxVL * (dist / dL);
    const maxVC_from_R = maxVR * (dist / dR);
    const vc_mag       = Math.min(Math.abs(maxVC_from_L), Math.abs(maxVC_from_R));
    const signC        = Math.sign((maxVL + maxVR) / 2);
    const maxVC        = signC * vc_mag;

    leftdt[i].vel  = maxVC * (dL / dist) * f;
    rightdt[i].vel = maxVC * (dR / dist) * f;
  }


  // Recombine
  for (let i = 0; i < pathpoints.length; i++) {
    const vL = leftdt[i].vel, vR = rightdt[i].vel;
    const vc = (vL + vR) / 2;
    const ω  = (vR - vL) / bot.trackwidth;
    pathpoints[i].velocity        = vc;
    pathpoints[i].angularVelocity = ω;
  }

  // --- Timestamp & accel compute ---
  let cumtime = 0;
  pathpoints[0].time  = 0;
  pathpoints[0].accel = 0;
  for (let i = 1; i < pathpoints.length; i++) {

    
    let f = 1; if(leftdt[i].rev) f = -1;


    const ds  = calcdistance(pathpoints[i], pathpoints[i - 1]);
    const avg = (pathpoints[i].velocity + pathpoints[i - 1].velocity) / 2;
    if (avg != 0){
      cumtime += ds / Math.abs(avg);
    }else{
      cumtime += 0.0000001;
    };
    pathpoints[i].time  = cumtime;
    pathpoints[i].accel = (pathpoints[i].velocity - pathpoints[i - 1].velocity)
                        / (ds / avg) * f;

    if(pathpoints[i].accel > MAX_ACCELERATION + 1){
      console.log("uh")
    }
  }

  

  plot();
}

// --- Helpers ---
function computeMaxVelocity(
  adjVelocity: number,
  maxAcceleration: number,
  distance: number
): number {
  return Math.sqrt(Math.max(0, adjVelocity ** 2 + 2 * maxAcceleration * distance));
}

function calcdistance(
  p1: pathPoint | Point,
  p2: pathPoint | Point
): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function binomialCoefficient(n: number, k: number): number {
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function section(controlpoints: controlPoint[], segment: number): controlPoint[] {
  const seg = controlpoints
    .slice(3 * segment, 3 * segment + 4)
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

function getx(ctrl: controlPoint[], t: number): number {
  let x = 0;
  for (let j = 0; j < 4; j++) {
    x += binomialCoefficient(3, j)
       * Math.pow(1-t, 3-j) * Math.pow(t, j)
       * ctrl[j].x;
  }
  return x;
}

function gety(ctrl: controlPoint[], t: number): number {
  let y = 0;
  for (let j = 0; j < 4; j++) {
    y += binomialCoefficient(3, j)
       * Math.pow(1-t, 3-j) * Math.pow(t, j)
       * ctrl[j].y;
  }
  return y;
}

function calculate_Curvature_Orientation(
  prev: pathPoint,
  curr: pathPoint,
  next: pathPoint
): { curvature: number; orientation: number } {
  
  
  const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const m1 = Math.hypot(v1.x, v1.y),
        m2 = Math.hypot(v2.x, v2.y);
  if (!m1 || !m2) return { curvature: 0, orientation: 0 };

  const cross      = v1.x * v2.y - v1.y * v2.x;
  const sinT       = cross / (m1 * m2);
  const dθ         = Math.asin(Math.max(-1, Math.min(1, sinT)));
  const curvature  = dθ / m1;

  const avgDir     = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };

  if(curr.rev){
    avgDir.x = - avgDir.x;
    avgDir.y = -avgDir.y;
  }

  const orientation = Math.atan2(avgDir.y, avgDir.x);


  return { curvature, orientation };
}
