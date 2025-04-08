export const canvas = document.getElementById("path") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const graph = document.getElementById("graph") as HTMLCanvasElement;
import vexfield from './assets/vexfield.png';

export const background = new Image();
background.src = vexfield;

// Constants (all distances in inches)
export const FIELD_WIDTH_INCHES = 144;
export const MAX_VELOCITY = 50;         // Maximum velocity in inches per second
export const MAX_ACCELERATION = 50;      // Maximum acceleration in inches per second squared
export const MAX_JERK = 100;           // Maximum jerk in inches per second cubed


export let top = 0;
export let left = 0;

export let bottom = 144;
export let right = 144;