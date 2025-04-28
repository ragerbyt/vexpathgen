//dik
import { pathpoints,totalInterp } from "./globals";
import { numSegments } from "./curve";

const radius = 5;

export function findsegment(fieldx: number, fieldY: number){

    for(let i = 0; i < pathpoints.length; i++){

        let deltaX = pathpoints[i].x - fieldx;
        let deltaY = pathpoints[i].y - fieldY;

        let dist = Math.hypot(deltaX, deltaY)

        if(dist > radius) continue;

        let pps = Math.floor(totalInterp/numSegments)

        let index = i;

        let seg = Math.floor(index/pps);

        if(seg = numSegments){
            seg = numSegments - 1;
        }

        console.log(seg)
        console.log(index)





    }

}