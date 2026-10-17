export const canvas = document.getElementById("path") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const graph = document.getElementById("graph") as HTMLCanvasElement;
export const overlay = document.getElementById("overlay") as HTMLCanvasElement;

import fieldH2H from "./assets/V5RC-Override-H2H-TopDownHighlighted-TileColor66_71@0.1.png";
import fieldSkills from "./assets/V5RC-Override-Skills-TopDownHighlighted-TileColor66_71@0.1.png";
import { computePathProfile } from './path-profile';

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
export let MAX_LINEAR_VELOCITY = 75;   // Straight-line wheel velocity in inches per second
export let MAX_TURN_VELOCITY = 55;     // Turning wheel velocity in inches per second
export let LINEAR_TAU = 0.25;          // Seconds
export let TURN_TAU = 0.2;             // Seconds
export let SATURATION = 80;            // Percent
export let MAX_ACCELERATION = 75;      // Maximum acceleration in inches per second squared
export let MAX_DECELERATION = 75;      // Maximum deceleration in inches per second squared

export function getSaturatedLinearVelocityCap(): number {
    return MAX_LINEAR_VELOCITY * clamp(SATURATION / 100, 0, 1);
}

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
    trackwidth: 11.25,
};
    
export let STATE = "Waypoints"


export const totalInterp = 1000;

export type PersistedSettings = {
    maxLinearVelocity: number;
    maxTurnVelocity: number;
    linearTau: number;
    turnTau: number;
    saturation: number;
    maxAcceleration: number;
    maxDeceleration: number;
    botWidth: number;
    botLength: number;
    trackWidth: number;
};

function getSettingsInputs() {
    return {
        maxdecelInput: document.getElementById("maxdecel") as HTMLInputElement | null,
        maxAccelInput: document.getElementById("maxaccel") as HTMLInputElement | null,
        maxLinearVelocityInput: document.getElementById("maxlinearvel") as HTMLInputElement | null,
        maxTurnVelocityInput: document.getElementById("maxturnvel") as HTMLInputElement | null,
        linearTauInput: document.getElementById("lineartau") as HTMLInputElement | null,
        turnTauInput: document.getElementById("turntau") as HTMLInputElement | null,
        saturationInput: document.getElementById("saturation") as HTMLInputElement | null,
        lenInput: document.getElementById("botlen") as HTMLInputElement | null,
        widthInput: document.getElementById("botwidth") as HTMLInputElement | null,
        trackWidthInput: document.getElementById("trackwidth") as HTMLInputElement | null,
    };
}

export function getPersistedSettings(): PersistedSettings {
    return {
        maxLinearVelocity: MAX_LINEAR_VELOCITY,
        maxTurnVelocity: MAX_TURN_VELOCITY,
        linearTau: LINEAR_TAU,
        turnTau: TURN_TAU,
        saturation: SATURATION,
        maxAcceleration: MAX_ACCELERATION,
        maxDeceleration: MAX_DECELERATION,
        botWidth: bot.width,
        botLength: bot.length,
        trackWidth: bot.trackwidth,
    };
}

export function syncSettingsInputs() {
    const {
        maxdecelInput,
        maxAccelInput,
        maxLinearVelocityInput,
        maxTurnVelocityInput,
        linearTauInput,
        turnTauInput,
        saturationInput,
        lenInput,
        widthInput,
        trackWidthInput,
    } = getSettingsInputs();

    if (maxdecelInput) maxdecelInput.value = String(MAX_DECELERATION);
    if (maxAccelInput) maxAccelInput.value = String(MAX_ACCELERATION);
    if (maxLinearVelocityInput) maxLinearVelocityInput.value = String(MAX_LINEAR_VELOCITY);
    if (maxTurnVelocityInput) maxTurnVelocityInput.value = String(MAX_TURN_VELOCITY);
    if (linearTauInput) linearTauInput.value = String(LINEAR_TAU);
    if (turnTauInput) turnTauInput.value = String(TURN_TAU);
    if (saturationInput) saturationInput.value = String(SATURATION);
    if (lenInput) lenInput.value = String(bot.length);
    if (widthInput) widthInput.value = String(bot.width);
    if (trackWidthInput) trackWidthInput.value = String(bot.trackwidth);
    syncSettingsSummary();
}

function syncSettingsSummary() {
    const formatNumber = (value: number) => Number(value.toFixed(2)).toString();
    const maxSpeed = document.getElementById("robot-max-speed");
    const turnSpeed = document.getElementById("robot-turn-speed");
    const saturation = document.getElementById("robot-saturation");
    const maxAcceleration = document.getElementById("robot-max-acceleration");
    const maxDeceleration = document.getElementById("robot-max-deceleration");
    const trackWidth = document.getElementById("robot-track-width");

    if (maxSpeed) maxSpeed.textContent = `${formatNumber(MAX_LINEAR_VELOCITY)} in/s`;
    if (turnSpeed) turnSpeed.textContent = `${formatNumber(MAX_TURN_VELOCITY)} in/s`;
    if (saturation) saturation.textContent = `${formatNumber(SATURATION)}%`;
    if (maxAcceleration) maxAcceleration.textContent = `${formatNumber(MAX_ACCELERATION)} in/s²`;
    if (maxDeceleration) maxDeceleration.textContent = `${formatNumber(MAX_DECELERATION)} in/s²`;
    if (trackWidth) trackWidth.textContent = `${formatNumber(bot.trackwidth)} in`;
}

export function applyPersistedSettings(settings: PersistedSettings) {
    MAX_LINEAR_VELOCITY = settings.maxLinearVelocity;
    MAX_TURN_VELOCITY = settings.maxTurnVelocity;
    LINEAR_TAU = settings.linearTau;
    TURN_TAU = settings.turnTau;
    SATURATION = settings.saturation;
    MAX_ACCELERATION = settings.maxAcceleration;
    MAX_DECELERATION = settings.maxDeceleration;
    bot.width = settings.botWidth;
    bot.length = settings.botLength;
    bot.trackwidth = settings.trackWidth;
    syncSettingsInputs();
}

export function updateActivePathSettings(settings: PersistedSettings) {
    const active = getActivePath();
    active.settings = { ...settings };
    applyPersistedSettings(active.settings);
}

export function updateAllPathSettings(settings: PersistedSettings) {
    for (const path of paths) {
        path.settings = { ...settings };
    }
    applyPersistedSettings(settings);
}

function readSettingsInputs(): PersistedSettings | null {
    const inputs = getSettingsInputs();
    const allInputs = Object.values(inputs);
    if (allInputs.some((input) => !input || !input.checkValidity())) return null;

    const values = allInputs.map((input) => Number(input!.value));
    if (values.some((value) => !Number.isFinite(value))) return null;

    const [maxDeceleration, maxAcceleration, maxLinearVelocity, maxTurnVelocity, linearTau, turnTau, saturation, botLength, botWidth, trackWidth] = values;
    return { maxLinearVelocity, maxTurnVelocity, linearTau, turnTau, saturation, maxAcceleration, maxDeceleration, botWidth, botLength, trackWidth };
}


document.addEventListener("DOMContentLoaded", () => {
    const editButton = document.getElementById("edit-robot-config") as HTMLButtonElement | null;
    const modal = document.getElementById("robot-config-modal") as HTMLDivElement | null;
    const scrim = document.getElementById("robot-config-scrim") as HTMLDivElement | null;
    const saveButton = document.getElementById("robot-config-save") as HTMLButtonElement | null;
    const applyAllButton = document.getElementById("robot-config-apply-all") as HTMLButtonElement | null;
    const cancelButton = document.getElementById("robot-config-cancel") as HTMLButtonElement | null;
    const error = document.getElementById("robot-config-error") as HTMLParagraphElement | null;

    syncSettingsInputs();

    const closeModal = () => {
        modal?.classList.add("is-hidden");
        if (error) error.textContent = "";
        editButton?.focus();
    };

    const openModal = () => {
        syncSettingsInputs();
        if (error) error.textContent = "";
        modal?.classList.remove("is-hidden");
        (document.getElementById("botwidth") as HTMLInputElement | null)?.focus();
    };

    const saveSettings = () => {
        const settings = readSettingsInputs();
        if (!settings) {
            if (error) error.textContent = "Enter a valid value for every setting.";
            return;
        }
        updateActivePathSettings(settings);
        computePathProfile();
        document.dispatchEvent(new CustomEvent("drawpath", { detail: { controlpoints } }));
        closeModal();
    };

    const applyAllSettings = () => {
        const settings = readSettingsInputs();
        if (!settings) {
            if (error) error.textContent = "Enter a valid value for every setting.";
            return;
        }
        const currentPathIndex = activePathIndex;
        updateAllPathSettings(settings);
        for (let index = 0; index < paths.length; index++) {
            setActivePathIndex(index);
            computePathProfile();
        }
        setActivePathIndex(currentPathIndex);
        document.dispatchEvent(new CustomEvent("drawpath", { detail: { controlpoints } }));
        closeModal();
    };

    editButton?.addEventListener("click", openModal);
    saveButton?.addEventListener("click", saveSettings);
    applyAllButton?.addEventListener("click", applyAllSettings);
    cancelButton?.addEventListener("click", closeModal);
    scrim?.addEventListener("click", closeModal);
    modal?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeModal();
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) saveSettings();
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
    settings: PersistedSettings;
}

export function createPathModel(name: string): PathModel {
    return {
        name,
        controlpoints: [],
        sections: [],
        pathpoints: [],
        flags: [],
        settings: getPersistedSettings(),
    };
}

export let paths: PathModel[] = [createPathModel("Path 1")];
export let routeName = "Paths";
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
    const active = getActivePath();
    if (active.settings) applyPersistedSettings(active.settings);
}

export function replacePaths(nextPaths: PathModel[]) {
    paths = nextPaths;
    activePathIndex = 0;
    syncActivePathRefs();
}

export function setRouteName(name: string) {
    routeName = name;
}
