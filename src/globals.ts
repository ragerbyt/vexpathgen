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
    width: 12,  
    length: 18
};
    
export let STATE = "Waypoints"

export let controlpoints: controlPoint[] = [];
export let pathpoints: pathPoint[] = [];

document.addEventListener("DOMContentLoaded", () => {
    const maxaccelInput = document.getElementById("maxaccel") as HTMLInputElement;
    const maxvelInput = document.getElementById("maxvel") as HTMLInputElement;


    maxaccelInput.addEventListener("input", () => {
        MAX_ACCELERATION = Number(maxaccelInput.value);
        computeBezierWaypoints();
    });

    maxvelInput.addEventListener("input", () => {
        MAX_VELOCITY = Number(maxaccelInput.value);
        computeBezierWaypoints();
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
}