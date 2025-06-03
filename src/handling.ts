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

export function selectSegment(index : number){
    const currseg = sections[index];

    start_hi = currseg.startpath!
    end_hi = currseg.endpath!
    hi_seg = index;
}

export function deselectSegment(index : number){
    resetsegment();
}