//dik
import { controlpoints, pathpoints,sections,totalInterp } from "./globals";
import { numSegments, totalSeg } from "./curve";

const radius = 2;
export let hi_seg = -1; //highlighted segment
export let start_hi = -1; 
export let end_hi = -1;
let canrun = true;

export function resetsegment(){
    hi_seg = -1;
    start_hi = -1;
    end_hi = -1;
}


export function findsegment(fieldx: number, fieldY: number){
  
    if(fieldx > 144 || fieldY > 144 || fieldx < 0 || fieldY < 0) return;

    resetsegment()

    for(let seg = 0; seg < sections.length; seg++){
        let currseg = sections[seg];

        let X = 0, Y = 0, x = 144, y = 144;

        for(let i = currseg.startcontrol; i <= currseg.endcontrol; i++){
            X = Math.max(controlpoints[i].x,X)   
            x = Math.min(controlpoints[i].x,x)   

            Y = Math.max(controlpoints[i].y,Y)
            y = Math.min(controlpoints[i].y,y)   
        }
        


        if(fieldx > X || fieldx < x || fieldY > Y || fieldY< y) continue;

        for(let i = currseg.startpath!; i <= currseg.endpath!; i++){

            let deltaX = pathpoints[i].x - fieldx;
            let deltaY = pathpoints[i].y - fieldY;
            let dist = Math.hypot(deltaX, deltaY)
            if(dist > radius) continue;
            
            start_hi = currseg.startpath!
            end_hi = currseg.endpath!
            hi_seg = seg;
        }


    }
}

