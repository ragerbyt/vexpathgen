import vexfield from "../assets/vexfield.png";
import {
  ROBOT_CENTER_OFFSET_FROM_BACK,
  ROBOT_LENGTH,
  ROBOT_WIDTH,
  SENSOR_ANGLES,
  SENSOR_OFFSETS,
  WARNING_PORT_META,
  type ViewerFrame,
  type ViewerRobotState
} from "./constants";

type ViewerElements = {
  startupScreen: HTMLElement;
  chooseFileBtn: HTMLButtonElement;
  fileInput: HTMLInputElement;
  viewerApp: HTMLElement;
  canvas: HTMLCanvasElement;
  info: HTMLElement;
  frameSlider: HTMLInputElement;
  skipFramesInput: HTMLInputElement;
  playBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
  startupStatus: HTMLElement;
  robotX: HTMLElement;
  robotY: HTMLElement;
  robotTheta: HTMLElement;
  batteryPercent: HTMLElement;
  intakeTemp: HTMLElement;
  leftTemp: HTMLElement;
  rightTemp: HTMLElement;
  leftOutput: HTMLElement;
  rightOutput: HTMLElement;
  tickTime: HTMLElement;
  elapsedTime: HTMLElement;
  sensorFrontValid: HTMLElement;
  sensorFrontDist: HTMLElement;
  sensorFrontPos: HTMLElement;
  sensorRightValid: HTMLElement;
  sensorRightDist: HTMLElement;
  sensorRightPos: HTMLElement;
  sensorBackValid: HTMLElement;
  sensorBackDist: HTMLElement;
  sensorBackPos: HTMLElement;
  sensorLeftValid: HTMLElement;
  sensorLeftDist: HTMLElement;
  sensorLeftPos: HTMLElement;
  warningLog: HTMLElement;
};

type ViewerState = {
  frames: ViewerFrame[];
  warningEvents: Array<{ frameIndex: number; elapsed: number; message: string }>;
  frameIndex: number;
  skipFrames: number;
  isPlaying: boolean;
  playbackStartTime: number;
  playbackStartFrame: number;
};

const ROOT_ID = "viewerWorkspace";
let initialized = false;

document.addEventListener("DOMContentLoaded", initViewer);

function getRequiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing viewer element: ${selector}`);
  }
  return element as T;
}

function createViewerState(): ViewerState {
  return {
    frames: [],
    warningEvents: [],
    frameIndex: 0,
    skipFrames: 20,
    isPlaying: false,
    playbackStartTime: 0,
    playbackStartFrame: 0
  };
}

function initViewer(): void {
  if (initialized) {
    return;
  }

  const root = document.getElementById(ROOT_ID);
  if (!root) {
    return;
  }

  const elements: ViewerElements = {
    startupScreen: getRequiredElement<HTMLElement>(root, "#viewerStartupScreen"),
    chooseFileBtn: getRequiredElement<HTMLButtonElement>(root, "#viewerChooseFileBtn"),
    fileInput: getRequiredElement<HTMLInputElement>(root, "#viewerFileInput"),
    viewerApp: getRequiredElement<HTMLElement>(root, "#viewerApp"),
    canvas: getRequiredElement<HTMLCanvasElement>(root, "#viewerCanvas"),
    info: getRequiredElement<HTMLElement>(root, "#viewerInfo"),
    frameSlider: getRequiredElement<HTMLInputElement>(root, "#viewerFrameSlider"),
    skipFramesInput: getRequiredElement<HTMLInputElement>(root, "#viewerSkipFrames"),
    playBtn: getRequiredElement<HTMLButtonElement>(root, "#viewerPlayBtn"),
    stopBtn: getRequiredElement<HTMLButtonElement>(root, "#viewerStopBtn"),
    startupStatus: getRequiredElement<HTMLElement>(root, "#viewerStartupStatus"),
    robotX: getRequiredElement<HTMLElement>(root, "#viewerRobotX"),
    robotY: getRequiredElement<HTMLElement>(root, "#viewerRobotY"),
    robotTheta: getRequiredElement<HTMLElement>(root, "#viewerRobotTheta"),
    batteryPercent: getRequiredElement<HTMLElement>(root, "#viewerBatteryPercent"),
    intakeTemp: getRequiredElement<HTMLElement>(root, "#viewerIntakeTemp"),
    leftTemp: getRequiredElement<HTMLElement>(root, "#viewerLeftTemp"),
    rightTemp: getRequiredElement<HTMLElement>(root, "#viewerRightTemp"),
    leftOutput: getRequiredElement<HTMLElement>(root, "#viewerLeftOutput"),
    rightOutput: getRequiredElement<HTMLElement>(root, "#viewerRightOutput"),
    tickTime: getRequiredElement<HTMLElement>(root, "#viewerTickTime"),
    elapsedTime: getRequiredElement<HTMLElement>(root, "#viewerElapsedTime"),
    sensorFrontValid: getRequiredElement<HTMLElement>(root, "#viewerSensorFrontValid"),
    sensorFrontDist: getRequiredElement<HTMLElement>(root, "#viewerSensorFrontDist"),
    sensorFrontPos: getRequiredElement<HTMLElement>(root, "#viewerSensorFrontPos"),
    sensorRightValid: getRequiredElement<HTMLElement>(root, "#viewerSensorRightValid"),
    sensorRightDist: getRequiredElement<HTMLElement>(root, "#viewerSensorRightDist"),
    sensorRightPos: getRequiredElement<HTMLElement>(root, "#viewerSensorRightPos"),
    sensorBackValid: getRequiredElement<HTMLElement>(root, "#viewerSensorBackValid"),
    sensorBackDist: getRequiredElement<HTMLElement>(root, "#viewerSensorBackDist"),
    sensorBackPos: getRequiredElement<HTMLElement>(root, "#viewerSensorBackPos"),
    sensorLeftValid: getRequiredElement<HTMLElement>(root, "#viewerSensorLeftValid"),
    sensorLeftDist: getRequiredElement<HTMLElement>(root, "#viewerSensorLeftDist"),
    sensorLeftPos: getRequiredElement<HTMLElement>(root, "#viewerSensorLeftPos"),
    warningLog: getRequiredElement<HTMLElement>(root, "#viewerWarningLog")
  };

  const ctx = elements.canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Viewer canvas context unavailable");
  }

  const state = createViewerState();
  const bgImage = new Image();
  bgImage.src = vexfield;

  const draw = (): void => {
    if (!state.frames.length) {
      ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
      ctx.fillStyle = "#aab3c2";
      ctx.font = "16px monospace";
      ctx.fillText("Load a file to begin", elements.canvas.width / 2 - 84, elements.canvas.height / 2);
      resetViewerLabels(elements);
      renderWarningLog(elements.warningLog, state.warningEvents, 0);
      return;
    }

    const frame = state.frames[state.frameIndex];
    const width = elements.canvas.width;
    const height = elements.canvas.height;
    const worldSize = 80;
    const fieldSize = 72;
    const scale = width / (worldSize * 2);
    const cx = width / 2;
    const cy = height / 2;

    ctx.clearRect(0, 0, width, height);

    if (bgImage.complete) {
      ctx.drawImage(bgImage, cx - fieldSize * scale, cy - fieldSize * scale, fieldSize * 2 * scale, fieldSize * 2 * scale);
    }

    drawPathTrace(ctx, state.frames, state.skipFrames, state.frameIndex, cx, cy, scale);
    drawParticles(ctx, frame, cx, cy, scale);
    drawRobot(ctx, frame.robot, cx, cy, scale);
    drawSensors(ctx, frame, cx, cy, scale);
    updateRightPanel(elements, state.frames, state.skipFrames, state.frameIndex);
    renderWarningLog(elements.warningLog, state.warningEvents, state.frameIndex);
  };

  const stopPlayback = (): void => {
    state.isPlaying = false;
    elements.playBtn.style.display = "inline-block";
    elements.stopBtn.style.display = "none";
  };

  const startPlayback = (): void => {
    if (!state.frames.length) {
      return;
    }

    state.isPlaying = true;
    state.playbackStartTime = performance.now();
    state.playbackStartFrame = state.skipFrames;
    elements.playBtn.style.display = "none";
    elements.stopBtn.style.display = "inline-block";

    const playbackLoop = (currentTime: number): void => {
      if (!state.isPlaying) {
        return;
      }

      const elapsed = currentTime - state.playbackStartTime;
      let targetFrame = state.playbackStartFrame;

      for (let index = state.playbackStartFrame; index < state.frames.length; index++) {
        if (state.frames[index].robot.elapsed >= elapsed) {
          targetFrame = index;
          break;
        }
      }

      state.frameIndex = Math.min(targetFrame, state.frames.length - 1);
      elements.frameSlider.value = String(state.frameIndex);
      draw();

      if (state.frameIndex < state.frames.length - 1) {
        requestAnimationFrame(playbackLoop);
      } else {
        stopPlayback();
      }
    };

    requestAnimationFrame(playbackLoop);
  };

  const parseLog = async (file: File): Promise<void> => {
    elements.startupStatus.textContent = "Loading file...";
    const text = await file.text();

    state.frames = [];
    state.warningEvents = [];

    let currentFrame: ViewerFrame | null = null;
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts[0] === "R") {
        if (currentFrame) {
          state.frames.push(currentFrame);
        }

        currentFrame = {
          robot: {
            x: Number(parts[1]),
            y: Number(parts[2]),
            theta: Number(parts[3]),
            tick: Number(parts[5]),
            elapsed: Number(parts[4]),
            battery: parts[6] !== undefined ? Number(parts[6]) : NaN,
            leftOutput: parts[7] !== undefined ? Number(parts[7]) : NaN,
            rightOutput: parts[8] !== undefined ? Number(parts[8]) : NaN,
            intakeTemp: parts[9] !== undefined ? Number(parts[9]) : NaN,
            leftTemp: parts[10] !== undefined ? Number(parts[10]) : NaN,
            rightTemp: parts[11] !== undefined ? Number(parts[11]) : NaN
          },
          connections: null,
          distances: null,
          particles: []
        };
      } else if (parts[0] === "C" && currentFrame) {
        currentFrame.connections = {
          imu: parts[1] === "1",
          distFront: parts[2] === "1",
          distRight: parts[3] === "1",
          distBack: parts[4] === "1",
          distLeft: parts[5] === "1",
          encFL: parts[6] === "1",
          encML: parts[7] === "1",
          encBL: parts[8] === "1",
          encFR: parts[9] === "1",
          encMR: parts[10] === "1",
          encBR: parts[11] === "1",
          encIntake1: parts[12] === "1",
          encIntake2: parts[13] === "1"
        };
      } else if (parts[0] === "D" && currentFrame) {
        currentFrame.distances = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4])];
        const flagString = parts[5] || "";
        currentFrame.sensorValid = [flagString[0] === "T", flagString[1] === "T", flagString[2] === "T", flagString[3] === "T"];
      } else if (parts[0] === "E" && currentFrame) {
        currentFrame.rayEndpoints = [
          { x: Number(parts[1]), y: Number(parts[2]) },
          { x: Number(parts[3]), y: Number(parts[4]) },
          { x: Number(parts[5]), y: Number(parts[6]) },
          { x: Number(parts[7]), y: Number(parts[8]) }
        ];
      } else if (parts[0] === "P" && currentFrame) {
        currentFrame.particles.push({ x: Number(parts[1]), y: Number(parts[2]), w: Number(parts[3]) });
      }
    }

    if (currentFrame) {
      state.frames.push(currentFrame);
    }

    if (!state.frames.length) {
      elements.startupStatus.textContent = "No valid frames found in file";
      return;
    }

    buildWarningEvents(state.frames, state.warningEvents);

    elements.startupStatus.textContent = "";
    elements.startupScreen.style.display = "none";
    elements.viewerApp.style.display = "block";

    state.skipFrames = findInitialFrame(state.frames);
    elements.skipFramesInput.value = String(state.skipFrames);
    state.frameIndex = state.skipFrames;
    elements.frameSlider.min = String(state.skipFrames);
    elements.frameSlider.max = String(state.frames.length - 1);
    elements.frameSlider.value = String(state.skipFrames);
    draw();
  };

  elements.chooseFileBtn.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", async () => {
    const file = elements.fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      await parseLog(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      elements.startupStatus.textContent = `Error: ${message}`;
    }
  });

  elements.skipFramesInput.addEventListener("change", () => {
    state.skipFrames = Math.max(0, Number.parseInt(elements.skipFramesInput.value, 10) || 0);
    elements.skipFramesInput.value = String(state.skipFrames);

    if (state.frames.length > 0) {
      elements.frameSlider.min = String(state.skipFrames);
      state.frameIndex = Math.max(state.frameIndex, state.skipFrames);
      elements.frameSlider.value = String(state.frameIndex);
      draw();
    }
  });

  elements.frameSlider.addEventListener("input", () => {
    stopPlayback();
    state.frameIndex = Number.parseInt(elements.frameSlider.value, 10);
    draw();
  });

  elements.playBtn.addEventListener("click", startPlayback);
  elements.stopBtn.addEventListener("click", stopPlayback);

  window.addEventListener("keydown", (event) => {
    if (!state.frames.length || state.isPlaying) {
      return;
    }

    if (event.key === "ArrowRight") {
      state.frameIndex = Math.min(state.frameIndex + 1, state.frames.length - 1);
      elements.frameSlider.value = String(state.frameIndex);
      draw();
    }

    if (event.key === "ArrowLeft") {
      state.frameIndex = Math.max(state.frameIndex - 1, state.skipFrames);
      elements.frameSlider.value = String(state.frameIndex);
      draw();
    }
  });

  bgImage.onload = () => draw();

  initialized = true;
  draw();
}

function findInitialFrame(frames: ViewerFrame[]): number {
  for (let index = 0; index < frames.length; index++) {
    const distance = Math.sqrt(frames[index].robot.x ** 2 + frames[index].robot.y ** 2);
    if (distance > 1.0) {
      return index;
    }
  }

  return 0;
}

function buildWarningEvents(
  frames: ViewerFrame[],
  warningEvents: Array<{ frameIndex: number; elapsed: number; message: string }>
): void {
  const disconnectStreakFrames = 2;
  const badStreak = WARNING_PORT_META.map(() => 0);
  const isDisconnected = WARNING_PORT_META.map(() => false);

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];
    if (!frame.connections) {
      continue;
    }

    WARNING_PORT_META.forEach((sensorMeta, sensorIndex) => {
      const connected = frame.connections?.[sensorMeta.key] === true;
      const bad = !connected;

      if (bad) {
        badStreak[sensorIndex] += 1;
      } else {
        badStreak[sensorIndex] = 0;
        isDisconnected[sensorIndex] = false;
      }

      if (!isDisconnected[sensorIndex] && badStreak[sensorIndex] >= disconnectStreakFrames) {
        isDisconnected[sensorIndex] = true;
        warningEvents.push({
          frameIndex,
          elapsed: frame.robot?.elapsed ?? 0,
          message: `warning: ${sensorMeta.name} disconnected (port ${sensorMeta.port})`
        });
      }
    });
  }
}

function formatWarningTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function renderWarningLog(
  warningLog: HTMLElement,
  warningEvents: Array<{ frameIndex: number; elapsed: number; message: string }>,
  currentFrameIndex: number
): void {
  const visibleWarnings = warningEvents.filter((event) => event.frameIndex <= currentFrameIndex);
  if (!visibleWarnings.length) {
    warningLog.innerHTML = '<div class="viewer-warning-empty">No warnings</div>';
    return;
  }

  warningLog.innerHTML = visibleWarnings
    .map((event) => `<div class="viewer-warning-entry">[${formatWarningTimestamp(event.elapsed)}] ${event.message}</div>`)
    .join("");
  warningLog.scrollTop = warningLog.scrollHeight;
}

function resetViewerLabels(elements: Pick<ViewerElements, "robotX" | "robotY" | "robotTheta" | "batteryPercent" | "intakeTemp" | "leftTemp" | "rightTemp" | "leftOutput" | "rightOutput" | "tickTime" | "elapsedTime" | "sensorFrontValid" | "sensorFrontDist" | "sensorFrontPos" | "sensorRightValid" | "sensorRightDist" | "sensorRightPos" | "sensorBackValid" | "sensorBackDist" | "sensorBackPos" | "sensorLeftValid" | "sensorLeftDist" | "sensorLeftPos">): void {
  elements.robotX.textContent = "-";
  elements.robotY.textContent = "-";
  elements.robotTheta.textContent = "-";
  elements.batteryPercent.textContent = "-";
  elements.intakeTemp.textContent = "-";
  elements.leftTemp.textContent = "-";
  elements.rightTemp.textContent = "-";
  elements.leftOutput.textContent = "-";
  elements.rightOutput.textContent = "-";
  elements.tickTime.textContent = "-";
  elements.elapsedTime.textContent = "-";
  elements.sensorFrontValid.textContent = "-";
  elements.sensorFrontDist.textContent = "-";
  elements.sensorFrontPos.textContent = "-";
  elements.sensorRightValid.textContent = "-";
  elements.sensorRightDist.textContent = "-";
  elements.sensorRightPos.textContent = "-";
  elements.sensorBackValid.textContent = "-";
  elements.sensorBackDist.textContent = "-";
  elements.sensorBackPos.textContent = "-";
  elements.sensorLeftValid.textContent = "-";
  elements.sensorLeftDist.textContent = "-";
  elements.sensorLeftPos.textContent = "-";
}

function updateRightPanel(
  elements: ViewerElements,
  frames: ViewerFrame[],
  skipFrames: number,
  frameIndex: number
): void {
  const frame = frames[frameIndex];

  elements.robotX.textContent = frame.robot?.x.toFixed(2) ?? "-";
  elements.robotY.textContent = frame.robot?.y.toFixed(2) ?? "-";
  elements.robotTheta.textContent = frame.robot?.theta.toFixed(1) ?? "-";
  elements.tickTime.textContent = ((frame.robot?.tick ?? 0) / 1000).toFixed(3);

  const startFrameElapsed = frames[skipFrames]?.robot?.elapsed ?? 0;
  const relativeElapsed = (frame.robot?.elapsed ?? 0) - startFrameElapsed;
  elements.elapsedTime.textContent = relativeElapsed.toFixed(0);

  const battery = frame.robot?.battery;
  elements.batteryPercent.textContent = Number.isFinite(battery) ? `${battery.toFixed(1)}%` : "-";
  const intakeTemp = frame.robot?.intakeTemp;
  const leftTemp = frame.robot?.leftTemp;
  const rightTemp = frame.robot?.rightTemp;
  elements.intakeTemp.textContent = Number.isFinite(intakeTemp) ? intakeTemp.toFixed(1) : "-";
  elements.leftTemp.textContent = Number.isFinite(leftTemp) ? leftTemp.toFixed(1) : "-";
  elements.rightTemp.textContent = Number.isFinite(rightTemp) ? rightTemp.toFixed(1) : "-";
  const leftOutput = frame.robot?.leftOutput;
  const rightOutput = frame.robot?.rightOutput;
  elements.leftOutput.textContent = Number.isFinite(leftOutput) ? leftOutput.toFixed(0) : "-";
  elements.rightOutput.textContent = Number.isFinite(rightOutput) ? rightOutput.toFixed(0) : "-";

  const validElements = [
    elements.sensorFrontValid,
    elements.sensorRightValid,
    elements.sensorBackValid,
    elements.sensorLeftValid
  ];
  const distElements = [
    elements.sensorFrontDist,
    elements.sensorRightDist,
    elements.sensorBackDist,
    elements.sensorLeftDist
  ];
  const posElements = [
    elements.sensorFrontPos,
    elements.sensorRightPos,
    elements.sensorBackPos,
    elements.sensorLeftPos
  ];

  for (let sensorIndex = 0; sensorIndex < 4; sensorIndex++) {
    if (frame.distances && frame.distances[sensorIndex] !== undefined) {
      distElements[sensorIndex].textContent = frame.distances[sensorIndex].toFixed(2);
    } else {
      distElements[sensorIndex].textContent = "-";
    }

    if (frame.rayEndpoints && frame.rayEndpoints[sensorIndex]) {
      const endpoint = frame.rayEndpoints[sensorIndex];
      posElements[sensorIndex].textContent = `${endpoint.x.toFixed(1)}, ${endpoint.y.toFixed(1)}`;
    } else {
      posElements[sensorIndex].textContent = "-";
    }

    if (frame.sensorValid && frame.sensorValid[sensorIndex] !== undefined) {
      validElements[sensorIndex].textContent = frame.sensorValid[sensorIndex] ? "(valid)" : "(invalid)";
      validElements[sensorIndex].style.color = frame.sensorValid[sensorIndex] ? "#4da6ff" : "#ff6666";
    } else {
      validElements[sensorIndex].textContent = "-";
      validElements[sensorIndex].style.color = "#4da6ff";
    }
  }

  elements.info.textContent = `Frame ${frameIndex + 1} / ${frames.length}`;
}

function drawPathTrace(
  ctx: CanvasRenderingContext2D,
  frames: ViewerFrame[],
  skipFrames: number,
  frameIndex: number,
  cx: number,
  cy: number,
  scale: number
): void {
  if (frames.length > 1 && frameIndex >= skipFrames) {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let index = skipFrames; index <= frameIndex; index++) {
      const pathFrame = frames[index];
      const screenX = cx + pathFrame.robot.x * scale;
      const screenY = cy - pathFrame.robot.y * scale;

      if (index === skipFrames) {
        ctx.moveTo(screenX, screenY);
      } else {
        ctx.lineTo(screenX, screenY);
      }
    }

    ctx.stroke();
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  frame: ViewerFrame,
  cx: number,
  cy: number,
  scale: number
): void {
  ctx.fillStyle = "rgba(0,255,255,0.5)";
  frame.particles.forEach((particle) => {
    ctx.beginPath();
    ctx.arc(cx + particle.x * scale, cy - particle.y * scale, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRobot(ctx: CanvasRenderingContext2D, robot: ViewerRobotState, cx: number, cy: number, scale: number): void {
  const thetaRad = robot.theta * Math.PI / 180;
  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);
  const frontDist = ROBOT_LENGTH - ROBOT_CENTER_OFFSET_FROM_BACK;
  const backDist = -ROBOT_CENTER_OFFSET_FROM_BACK;
  const halfWidth = ROBOT_WIDTH / 2;

  const corners: Array<[number, number]> = [
    [frontDist, -halfWidth],
    [frontDist, halfWidth],
    [backDist, halfWidth],
    [backDist, -halfWidth]
  ];

  ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();

  corners.forEach((corner, cornerIndex) => {
    const worldX = robot.x + (cosTheta * corner[0] - sinTheta * corner[1]);
    const worldY = robot.y + (sinTheta * corner[0] + cosTheta * corner[1]);
    const screenX = cx + worldX * scale;
    const screenY = cy - worldY * scale;

    if (cornerIndex === 0) {
      ctx.moveTo(screenX, screenY);
    } else {
      ctx.lineTo(screenX, screenY);
    }
  });

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "darkred";
  ctx.lineWidth = 1;
  const sideOffset = 2.5;
  const leftLineLocalY = -halfWidth + sideOffset;
  const rightLineLocalY = halfWidth - sideOffset;

  const leftBackWorldX = robot.x + (cosTheta * backDist - sinTheta * leftLineLocalY);
  const leftBackWorldY = robot.y + (sinTheta * backDist + cosTheta * leftLineLocalY);
  const leftFrontWorldX = robot.x + (cosTheta * frontDist - sinTheta * leftLineLocalY);
  const leftFrontWorldY = robot.y + (sinTheta * frontDist + cosTheta * leftLineLocalY);
  ctx.beginPath();
  ctx.moveTo(cx + leftBackWorldX * scale, cy - leftBackWorldY * scale);
  ctx.lineTo(cx + leftFrontWorldX * scale, cy - leftFrontWorldY * scale);
  ctx.stroke();

  const rightBackWorldX = robot.x + (cosTheta * backDist - sinTheta * rightLineLocalY);
  const rightBackWorldY = robot.y + (sinTheta * backDist + cosTheta * rightLineLocalY);
  const rightFrontWorldX = robot.x + (cosTheta * frontDist - sinTheta * rightLineLocalY);
  const rightFrontWorldY = robot.y + (sinTheta * frontDist + cosTheta * rightLineLocalY);
  ctx.beginPath();
  ctx.moveTo(cx + rightBackWorldX * scale, cy - rightBackWorldY * scale);
  ctx.lineTo(cx + rightFrontWorldX * scale, cy - rightFrontWorldY * scale);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(cx + robot.x * scale, cy - robot.y * scale, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "black";
  ctx.lineWidth = 3;
  const arrowLen = 4;
  const arrowWidth = 2;
  const frontX = robot.x + cosTheta * frontDist;
  const frontY = robot.y + sinTheta * frontDist;
  const tipX = frontX + cosTheta * arrowLen;
  const tipY = frontY + sinTheta * arrowLen;
  const leftWingX = frontX + cosTheta * arrowLen / 2 - sinTheta * arrowWidth;
  const leftWingY = frontY + sinTheta * arrowLen / 2 + cosTheta * arrowWidth;
  const rightWingX = frontX + cosTheta * arrowLen / 2 + sinTheta * arrowWidth;
  const rightWingY = frontY + sinTheta * arrowLen / 2 - cosTheta * arrowWidth;

  ctx.beginPath();
  ctx.moveTo(cx + frontX * scale, cy - frontY * scale);
  ctx.lineTo(cx + tipX * scale, cy - tipY * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + tipX * scale, cy - tipY * scale);
  ctx.lineTo(cx + leftWingX * scale, cy - leftWingY * scale);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + tipX * scale, cy - tipY * scale);
  ctx.lineTo(cx + rightWingX * scale, cy - rightWingY * scale);
  ctx.stroke();

  ctx.lineWidth = 1;
}

function drawSensors(ctx: CanvasRenderingContext2D, frame: ViewerFrame, cx: number, cy: number, scale: number): void {
  const robot = frame.robot;
  if (!frame.distances) {
    return;
  }

  const thetaRad = robot.theta * Math.PI / 180;
  const cosTheta = Math.cos(thetaRad);
  const sinTheta = Math.sin(thetaRad);

  ctx.lineWidth = 2;
  frame.distances.forEach((distance, sensorIndex) => {
    const localX = SENSOR_OFFSETS[sensorIndex][0];
    const localY = SENSOR_OFFSETS[sensorIndex][1];
    const worldOffsetX = cosTheta * localX - sinTheta * localY;
    const worldOffsetY = sinTheta * localX + cosTheta * localY;
    const sensorX = robot.x + worldOffsetX;
    const sensorY = robot.y + worldOffsetY;
    const angle = thetaRad + SENSOR_ANGLES[sensorIndex];
    const isValid = frame.sensorValid && frame.sensorValid[sensorIndex];

    ctx.strokeStyle = isValid ? "lime" : "red";
    ctx.beginPath();
    ctx.moveTo(cx + sensorX * scale, cy - sensorY * scale);
    const endX = sensorX + Math.cos(angle) * distance;
    const endY = sensorY + Math.sin(angle) * distance;
    ctx.lineTo(cx + endX * scale, cy - endY * scale);
    ctx.stroke();

    ctx.fillStyle = isValid ? "lime" : "red";
    ctx.beginPath();
    ctx.arc(cx + sensorX * scale, cy - sensorY * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(cx + endX * scale, cy - endY * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  if (frame.rayEndpoints) {
    const sensorColors = ["cyan", "magenta", "purple", "orange"];
    frame.rayEndpoints.forEach((endpoint, sensorIndex) => {
      if (endpoint && endpoint.x !== 0 && endpoint.y !== 0) {
        const screenX = cx + endpoint.x * scale;
        const screenY = cy - endpoint.y * scale;
        const crossSize = 5;
        ctx.strokeStyle = sensorColors[sensorIndex];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX - crossSize, screenY);
        ctx.lineTo(screenX + crossSize, screenY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - crossSize);
        ctx.lineTo(screenX, screenY + crossSize);
        ctx.stroke();
      }
    });
  }
}
