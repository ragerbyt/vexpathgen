export const canvas = document.getElementById("path") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const graph = document.getElementById("graph") as HTMLCanvasElement;
export const overlay = document.getElementById("overlay") as HTMLCanvasElement;

import vexfield from './assets/vexfield.png';
import { computeBezierWaypoints } from './curve';

export const background = new Image();
background.src = vexfield;

// Constants (all distances in inches)
export const FIELD_WIDTH_INCHES = 144;
export const FIELD_HEIGHT_INCHES = 144;
export let MAX_VELOCITY = 80;         // Maximum velocity in inches per second
export let MAX_ACCELERATION = 80;      // Maximum acceleration in inches per second squared

export let top = 0;
export let left = 0;

export let bottom = 144;
export let right = 144;

const MIN_FIELD_VIEW_SPAN_RATIO = 0.03;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function getFieldView() {
    return { left, right, top, bottom };
}

export function setFieldView(newLeft: number, newRight: number, newTop: number, newBottom: number) {
    const fieldWidth = FIELD_WIDTH_INCHES;
    const fieldHeight = FIELD_HEIGHT_INCHES;
    const minSpanX = fieldWidth * MIN_FIELD_VIEW_SPAN_RATIO;
    const minSpanY = fieldHeight * MIN_FIELD_VIEW_SPAN_RATIO;

    const desiredSpanX = clamp(newRight - newLeft, minSpanX, fieldWidth);
    const desiredSpanY = clamp(newBottom - newTop, minSpanY, fieldHeight);

    const maxLeft = Math.max(0, fieldWidth - desiredSpanX);
    const maxTop = Math.max(0, fieldHeight - desiredSpanY);

    const nextLeft = clamp(newLeft, 0, maxLeft);
    const nextTop = clamp(newTop, 0, maxTop);
    const nextRight = nextLeft + desiredSpanX;
    const nextBottom = nextTop + desiredSpanY;

    left = nextLeft;
    right = nextRight;
    top = nextTop;
    bottom = nextBottom;
}

export function resetFieldView() {
    left = 0;
    right = FIELD_WIDTH_INCHES;
    top = 0;
    bottom = FIELD_HEIGHT_INCHES;
}

export function panFieldView(deltaX: number, deltaY: number) {
    setFieldView(left + deltaX, right + deltaX, top + deltaY, bottom + deltaY);
}

export function zoomFieldView(scale: number, anchorX: number, anchorY: number) {
    const fieldWidth = FIELD_WIDTH_INCHES;
    const fieldHeight = FIELD_HEIGHT_INCHES;
    const minSpanX = fieldWidth * MIN_FIELD_VIEW_SPAN_RATIO;
    const minSpanY = fieldHeight * MIN_FIELD_VIEW_SPAN_RATIO;

    const currentSpanX = Math.max(right - left, minSpanX);
    const currentSpanY = Math.max(bottom - top, minSpanY);
    const nextSpanX = clamp(currentSpanX * scale, minSpanX, fieldWidth);
    const nextSpanY = clamp(currentSpanY * scale, minSpanY, fieldHeight);

    const anchorRatioX = currentSpanX > 0 ? (anchorX - left) / currentSpanX : 0.5;
    const anchorRatioY = currentSpanY > 0 ? (anchorY - top) / currentSpanY : 0.5;

    const nextLeft = anchorX - anchorRatioX * nextSpanX;
    const nextTop = anchorY - anchorRatioY * nextSpanY;

    setFieldView(nextLeft, nextLeft + nextSpanX, nextTop, nextTop + nextSpanY);
}

export function fieldToCanvasX(fieldX: number, canvasWidth: number): number {
    const span = Math.max(right - left, 1e-9);
    return ((fieldX - left) / span) * canvasWidth;
}

export function fieldToCanvasY(fieldY: number, canvasHeight: number): number {
    const span = Math.max(bottom - top, 1e-9);
    return ((bottom - fieldY) / span) * canvasHeight;
}

export function canvasToFieldX(canvasX: number, canvasWidth: number): number {
    const span = right - left;
    return left + (canvasX / Math.max(canvasWidth, 1)) * span;
}

export function canvasToFieldY(canvasY: number, canvasHeight: number): number {
    const span = bottom - top;
    return bottom - (canvasY / Math.max(canvasHeight, 1)) * span;
}

export const bot = {
    x: 0,
    y: 0,
    o: 0,      
    width: 16,  
    length: 16,
    trackwidth: 10,
};
    
export let STATE = "Waypoints"

export let controlpoints: controlPoint[] = [];
export let sections: section[] = [];
export let pathpoints: pathPoint[] = [];


export const totalInterp = 1000;


document.addEventListener("DOMContentLoaded", () => {
    const maxaccelInput = document.getElementById("maxaccel") as HTMLInputElement;
    const maxvelInput = document.getElementById("maxvel") as HTMLInputElement;
    const len = document.getElementById("botlen") as HTMLInputElement;
    const width = document.getElementById("botwidth") as HTMLInputElement;
    const trackw = document.getElementById("trackwidth") as HTMLInputElement;
    

    maxaccelInput.addEventListener("input", () => {
        MAX_ACCELERATION = Number(maxaccelInput.value);
        computeBezierWaypoints();
    });

    maxvelInput.addEventListener("input", () => {
        MAX_VELOCITY = Number(maxvelInput.value);
        computeBezierWaypoints();
    });

    len.addEventListener("input", () => {
        bot.length = Number(len.value);
    });
    width.addEventListener("input", () => {
        bot.width = Number(width.value);
        computeBezierWaypoints();
    });

    trackw.addEventListener("input", () => {
        bot.trackwidth = Number(trackw.value);
        computeBezierWaypoints();
    });

    const input = document.getElementById("import") as HTMLInputElement;

    input.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            console.log("Selected file:", file.name);
        }
    });
});


export interface pathPoint {
    x: number;         // x-coordinate in inches
    y: number;         // y-coordinate in inches
    velocity: number;  // Linear velocity (inches/s)
    angularVelocity: number; // Angular velocity (rad/s)
    accel: number;
    dist: number;
    time: number;
    orientation: number; // Orientation (heading) in degrees
    rev: boolean;

    curvature: number;
    curvaturePrime: number; //derivative of curvature


    leftdist: number; //from prev to curr point distance
    leftx: number;
    lefty: number;
    leftvel: number;

    rightdist: number
    rightx: number
    righty: number
    rightvel: number;
}

export interface controlPoint {
    x: number;
    y: number;
    index: number;
    color: string;
    dist: number;
    isMain?: boolean;
    anglex?: number;
    angley?: number;
    size?: number;
    rev?: boolean;
}


export interface section{
    startcontrol: number;
    endcontrol: number; //INCLUSIve

    startpath?: number;
    endpath?: number

    type: "bezier" | "bezier3" | "line" | "arc";
    rev: boolean
    startangle: number,
    endangle: number

    startx: number
    starty: number
    endx: number
    endy: number
}

pause(100)
    async function pause(time: number){
      await new Promise(resolve => setTimeout(resolve, time));
    }