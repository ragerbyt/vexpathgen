export const canvas = document.getElementById("path") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const graph = document.getElementById("graph") as HTMLCanvasElement;

import vexfield from './assets/vexfield.png';
import { computeBezierWaypoints } from './curve';

export const background = new Image();
background.src = vexfield;

// Constants (all distances in inches)
export const FIELD_WIDTH_INCHES = 144;
export let MAX_VELOCITY = 50;         // Maximum velocity in inches per second
export let MAX_ACCELERATION = 50;      // Maximum acceleration in inches per second squared

export let top = 0;
export let left = 0;

export let bottom = 144;
export let right = 144;

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
export let leftdt: Point[] = [];
export let rightdt: Point[] = [];

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
    curvature: number; // The curvature (radians per inch)
    angularVelocity: number; // Angular velocity (rad/s)
    accel: number;
    dist: number;
    time: number;
    orientation: number; // Orientation (heading) in degrees
    rev: boolean;

    t: number;

    leftdist: number; //from prev to curr point distance
    rightdist: number;

    leftvel: number; //vel at point
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

export interface Point{
    x: number;
    y: number;
    vel: number;
    neg: boolean;
    rev: boolean;
}

export interface section{
    startcontrol: number;
    endcontrol: number; //INCLUSIve

    startpath?: number;
    endpath?: number

    type: "bezier" | "line";
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