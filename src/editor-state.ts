export const canvas = document.getElementById("path") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const graph = document.getElementById("graph") as HTMLCanvasElement;
export const overlay = document.getElementById("overlay") as HTMLCanvasElement;

import fieldH2H from "./assets/V5RC-Override-H2H-TopDownHighlighted-TileColor66_71@0.1.png";
import fieldSkills from "./assets/V5RC-Override-Skills-TopDownHighlighted-TileColor66_71@0.1.png";
import { computePathProfile } from './curve';

export const background = new Image();

export type FieldBackgroundMode = "H2H" | "Skills";

const FIELD_BACKGROUNDS: Record<FieldBackgroundMode, string> = {
    H2H: fieldH2H,
    Skills: fieldSkills,
};

export let FIELD_BACKGROUND_MODE: FieldBackgroundMode = "H2H";

export function setFieldBackgroundMode(mode: FieldBackgroundMode) {
    FIELD_BACKGROUND_MODE = mode;
    background.src = FIELD_BACKGROUNDS[mode];
}

setFieldBackgroundMode(FIELD_BACKGROUND_MODE);

// Constants (all distances in inches)
export const FIELD_WIDTH_INCHES = 144;
export const FIELD_HEIGHT_INCHES = 144;
export let MAX_VELOCITY = 80;         // Maximum velocity in inches per second
export let MAX_ACCELERATION = 140;      // Maximum acceleration in inches per second squared
export let MAX_DECELERATION = 150;      // Maximum deceleration in inches per second squared

export let top = -FIELD_HEIGHT_INCHES / 2;
export let left = -FIELD_WIDTH_INCHES / 2;

export let bottom = FIELD_HEIGHT_INCHES / 2;
export let right = FIELD_WIDTH_INCHES / 2;

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

    const minLeft = -fieldWidth / 2;
    const minTop = -fieldHeight / 2;
    const maxLeft = fieldWidth / 2 - desiredSpanX;
    const maxTop = fieldHeight / 2 - desiredSpanY;

    const nextLeft = clamp(newLeft, minLeft, maxLeft);
    const nextTop = clamp(newTop, minTop, maxTop);
    const nextRight = nextLeft + desiredSpanX;
    const nextBottom = nextTop + desiredSpanY;

    left = nextLeft;
    right = nextRight;
    top = nextTop;
    bottom = nextBottom;
}

export function resetFieldView() {
    left = -FIELD_WIDTH_INCHES / 2;
    right = FIELD_WIDTH_INCHES / 2;
    top = -FIELD_HEIGHT_INCHES / 2;
    bottom = FIELD_HEIGHT_INCHES / 2;
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
    width: 13.5,  
    length: 15,
    trackwidth: 10,
};
    
export let STATE = "Waypoints"


export const totalInterp = 1000;

type PersistedSettings = {
    maxVelocity: number;
    maxAcceleration: number;
    maxDeceleration: number;
    botWidth: number;
    botLength: number;
    trackWidth: number;
};

function getSettingsInputs() {
    return {
        maxaccelInput: document.getElementById("maxaccel") as HTMLInputElement | null,
        maxdecelInput: document.getElementById("maxdecel") as HTMLInputElement | null,
        maxvelInput: document.getElementById("maxvel") as HTMLInputElement | null,
        lenInput: document.getElementById("botlen") as HTMLInputElement | null,
        widthInput: document.getElementById("botwidth") as HTMLInputElement | null,
        trackWidthInput: document.getElementById("trackwidth") as HTMLInputElement | null,
    };
}

export function getPersistedSettings(): PersistedSettings {
    return {
        maxVelocity: MAX_VELOCITY,
        maxAcceleration: MAX_ACCELERATION,
        maxDeceleration: MAX_DECELERATION,
        botWidth: bot.width,
        botLength: bot.length,
        trackWidth: bot.trackwidth,
    };
}

export function syncSettingsInputs() {
    const {
        maxaccelInput,
        maxdecelInput,
        maxvelInput,
        lenInput,
        widthInput,
        trackWidthInput,
    } = getSettingsInputs();

    if (maxaccelInput) maxaccelInput.value = String(MAX_ACCELERATION);
    if (maxdecelInput) maxdecelInput.value = String(MAX_DECELERATION);
    if (maxvelInput) maxvelInput.value = String(MAX_VELOCITY);
    if (lenInput) lenInput.value = String(bot.length);
    if (widthInput) widthInput.value = String(bot.width);
    if (trackWidthInput) trackWidthInput.value = String(bot.trackwidth);
}

export function applyPersistedSettings(settings: PersistedSettings) {
    MAX_VELOCITY = settings.maxVelocity;
    MAX_ACCELERATION = settings.maxAcceleration;
    MAX_DECELERATION = settings.maxDeceleration;
    bot.width = settings.botWidth;
    bot.length = settings.botLength;
    bot.trackwidth = settings.trackWidth;
    syncSettingsInputs();
}


document.addEventListener("DOMContentLoaded", () => {
    const {
        maxaccelInput,
        maxdecelInput,
        maxvelInput,
        lenInput,
        widthInput,
        trackWidthInput,
    } = getSettingsInputs();

    syncSettingsInputs();

    maxaccelInput?.addEventListener("input", () => {
        MAX_ACCELERATION = Number(maxaccelInput.value);
        computePathProfile();
    });

    maxdecelInput?.addEventListener("input", () => {
        MAX_DECELERATION = Number(maxdecelInput.value);
        computePathProfile();
    });

    maxvelInput?.addEventListener("input", () => {
        MAX_VELOCITY = Number(maxvelInput.value);
        computePathProfile();
    });

    lenInput?.addEventListener("input", () => {
        bot.length = Number(lenInput.value);
    });
    widthInput?.addEventListener("input", () => {
        bot.width = Number(widthInput.value);
        computePathProfile();
    });

    trackWidthInput?.addEventListener("input", () => {
        bot.trackwidth = Number(trackWidthInput.value);
        computePathProfile();
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

    type: "bezier" | "line";
    rev: boolean
    startangle: number,
    endangle: number

    startx: number
    starty: number
    endx: number
    endy: number
    name?: string;
}

export interface FlagModel {
    id: string;
    pathDistance: number;
    type: "string" | "velocity";
    label: string;
    velocityLimit: number | null;
}

export interface PathModel {
    name: string;
    controlpoints: controlPoint[];
    sections: section[];
    pathpoints: pathPoint[];
    flags: FlagModel[];
}

export function createPathModel(name: string): PathModel {
    return {
        name,
        controlpoints: [],
        sections: [],
        pathpoints: [],
        flags: [],
    };
}

export let paths: PathModel[] = [createPathModel("Path 1")];
export let activePathIndex = 0;

export let controlpoints: controlPoint[] = paths[0].controlpoints;
export let sections: section[] = paths[0].sections;
export let pathpoints: pathPoint[] = paths[0].pathpoints;
export let flags: FlagModel[] = paths[0].flags;

export function getActivePath(): PathModel {
    return paths[activePathIndex];
}

export function syncActivePathRefs() {
    if (paths.length === 0) {
        controlpoints = [];
        sections = [];
        pathpoints = [];
        flags = [];
        return;
    }
    const active = getActivePath();
    controlpoints = active.controlpoints;
    sections = active.sections;
    pathpoints = active.pathpoints;
    flags = active.flags;
}

export function setActivePathIndex(index: number) {
    if (paths.length === 0) {
        activePathIndex = 0;
        syncActivePathRefs();
        return;
    }
    const nextIndex = Math.max(0, Math.min(index, paths.length - 1));
    activePathIndex = nextIndex;
    syncActivePathRefs();
}

export function replacePaths(nextPaths: PathModel[]) {
    paths = nextPaths;
    activePathIndex = 0;
    syncActivePathRefs();
}
