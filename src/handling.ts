//dik
import { pathpoints,totalInterp } from "./globals";
import { numSegments, totalSeg } from "./curve";

const radius = 2;
export let hi_seg = -1; //highlighted segment
export let start_hi = -1; 
export let hi_len = -1;
let canrun = true;

export function resetsegment(){
    hi_seg = -1;
    start_hi = -1;
    hi_len = -1;
}

import { ptsPerSeg } from "./curve";

export function findsegment(fieldx: number, fieldY: number){
  
    if(fieldx > 144 || fieldY > 144 || fieldx < 0 || fieldY < 0) return;

    resetsegment()


    for(let i = 0; i < pathpoints.length; i++){

        let deltaX = pathpoints[i].x - fieldx;
        let deltaY = pathpoints[i].y - fieldY;

        let dist = Math.hypot(deltaX, deltaY)

        
        if(dist > radius) continue;

        let pps = ptsPerSeg

        let index = i;

        let seg = Math.floor(index/pps);


        if(seg >= numSegments){
            seg = numSegments - 1;
            hi_len = totalSeg - seg*pps;
        }else{
            hi_len = pps
        }

        start_hi = seg*pps;
        hi_seg = seg;
        
    }

}

