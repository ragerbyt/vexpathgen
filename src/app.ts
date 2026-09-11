import "./canvas-interaction";
import "./field-renderer";
import "./path-profile";
import "./velocity-graph";
import "./css/styles.css";
import "./coordinate-display";
import "./drawing-mode";

import {
  activePathIndex,
  PathModel,
  applyPersistedSettings,
  controlPoint,
  FlagModel,
  getPersistedSettings,
  pathPoint,
  paths,
  section,
  setActivePathIndex,
} from "./editor-state";
import { computePathProfile } from "./path-profile";
import { replaceEditorPaths } from "./canvas-interaction";

const EXPORT_SCHEMA_VERSION = 4;
const cursor = document.getElementById("cursorDot");

type PersistedSettings = ReturnType<typeof getPersistedSettings>;

type ExportedPathFile = {
  version: number;
  pathName: string;
  controlpoints: controlPoint[];
  sections: section[];
  flags: FlagModel[];
  settings: PersistedSettings;
};

type DirectoryHandleLike = {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  values(): AsyncIterable<{ kind: string; name: string; getFile?: () => Promise<File> }>;
};

function sanitizeBaseName(name: string): string {
  const trimmed = name.trim();
  const normalized = trimmed.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "path";
}

function sanitizeCppIdentifier(name: string): string {
  const fallback = sanitizeBaseName(name);
  return /^[a-zA-Z_]/.test(fallback) ? fallback : `path_${fallback}`;
}

function buildUniqueBaseNames(items: PathModel[]): string[] {
  const counts = new Map<string, number>();

  return items.map((path) => {
    const baseName = sanitizeBaseName(path.name);
    const seen = counts.get(baseName) ?? 0;
    counts.set(baseName, seen + 1);
    return seen === 0 ? baseName : `${baseName}_${seen + 1}`;
  });
}

function cloneControlPoints(points: controlPoint[]): controlPoint[] {
  return points.map((point, index) => ({ ...point, index }));
}

function cloneSections(items: section[]): section[] {
  return items.map((item) => ({ ...item }));
}

function cloneFlags(items: FlagModel[]): FlagModel[] {
  return items.map((item) => ({ ...item }));
}

function createExportPayload(path: PathModel): ExportedPathFile {
  return {
    version: EXPORT_SCHEMA_VERSION,
    pathName: path.name,
    controlpoints: cloneControlPoints(path.controlpoints),
    sections: cloneSections(path.sections),
    flags: cloneFlags(path.flags),
    settings: getPersistedSettings(),
  };
}

type ExportPoint = Pick<pathPoint, "x" | "y" | "velocity" | "accel" | "angularVelocity" | "time" | "orientation">;

function interpolateExportPoints(points: pathPoint[]): ExportPoint[] {
  if (points.length === 0) return [];

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const sampleInterval = 0.01;
  const timeEpsilon = 1e-9;
  const finalTime = lastPoint.time;
  const sampleTimes: number[] = [];
  const regularSampleCount = Math.floor((finalTime - firstPoint.time) / sampleInterval + timeEpsilon);

  for (let sampleIndex = 0; sampleIndex <= regularSampleCount; sampleIndex++) {
    sampleTimes.push(firstPoint.time + sampleIndex * sampleInterval);
  }
  if (finalTime - sampleTimes[sampleTimes.length - 1] > timeEpsilon) {
    sampleTimes.push(finalTime);
  }

  const normalizeAngle = (angle: number): number => {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  };

  const interpolatedPoints = sampleTimes.map((time) => {
    let upperIndex = 1;
    while (upperIndex < points.length && points[upperIndex].time < time) {
      upperIndex++;
    }

    if (upperIndex >= points.length) return { ...lastPoint, time };

    const lowerPoint = points[upperIndex - 1];
    const upperPoint = points[upperIndex];
    const timeSpan = upperPoint.time - lowerPoint.time;
    if (timeSpan <= 0 || time === lowerPoint.time) return { ...lowerPoint, time };

    const amount = (time - lowerPoint.time) / timeSpan;
    const orientationDelta = normalizeAngle(upperPoint.orientation - lowerPoint.orientation);
    return {
      time,
      x: lowerPoint.x + (upperPoint.x - lowerPoint.x) * amount,
      y: lowerPoint.y + (upperPoint.y - lowerPoint.y) * amount,
      velocity: lowerPoint.velocity + (upperPoint.velocity - lowerPoint.velocity) * amount,
      accel: 0,
      angularVelocity: lowerPoint.angularVelocity
        + (upperPoint.angularVelocity - lowerPoint.angularVelocity) * amount,
      orientation: lowerPoint.orientation + orientationDelta * amount,
    };
  });

  for (let index = 0; index < interpolatedPoints.length - 1; index++) {
    const currentPoint = interpolatedPoints[index];
    const nextPoint = interpolatedPoints[index + 1];
    const timeStep = nextPoint.time - currentPoint.time;
    currentPoint.accel = timeStep > 0
      ? (nextPoint.velocity - currentPoint.velocity) / timeStep
      : 0;
  }
  interpolatedPoints[interpolatedPoints.length - 1].accel = 0;

  return interpolatedPoints;
}

function buildCppContent(routeName: string, points: ExportPoint[]): string {
  const radiansToDegrees = 180 / Math.PI;
  const rows = points.map((wp, index) => {
    const previousPoint = points[index - 1];
    const timeStep = previousPoint ? wp.time - previousPoint.time : 0;
    const angularAcceleration = previousPoint && timeStep > 0
      ? (wp.angularVelocity - previousPoint.angularVelocity) / timeStep
      : 0;
    return `    {${Math.round(wp.time * 1000)}, {${Math.round(wp.x * 50)}, ${Math.round(wp.y * 50)}, ${Math.round(wp.orientation * radiansToDegrees * 10)}}, ${Math.round(wp.velocity * 50)}, ${Math.round(wp.accel * 50)}, ${Math.round(wp.angularVelocity * radiansToDegrees * 20)}, ${Math.round(angularAcceleration * radiansToDegrees * 20)}}`;
  });

  return `#include "motionprofile.h"\n\nconst size_t ${routeName}Size = ${points.length};\nconst ProfilePoint ${routeName}[] = {\n${rows.join(",\n")}\n};`;
}

async function writeTextFile(directoryHandle: DirectoryHandleLike, fileName: string, contents: string) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

function validateNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateControlPoint(value: unknown): value is controlPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<controlPoint>;
  return validateNumber(point.x)
    && validateNumber(point.y)
    && validateNumber(point.index)
    && typeof point.color === "string"
    && validateNumber(point.dist);
}

function validateSection(value: unknown): value is section {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<section>;
  return validateNumber(item.startcontrol)
    && validateNumber(item.endcontrol)
    && (item.type === "bezier" || item.type === "line")
    && typeof item.rev === "boolean"
    && validateNumber(item.startangle)
    && validateNumber(item.endangle)
    && validateNumber(item.startx)
    && validateNumber(item.starty)
    && validateNumber(item.endx)
    && validateNumber(item.endy);
}

function validateSettings(value: unknown): value is PersistedSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<PersistedSettings>;
  return validateNumber(settings.maxVelocity)
    && validateNumber(settings.maxAcceleration)
    && validateNumber(settings.maxDeceleration)
    && validateNumber(settings.botWidth)
    && validateNumber(settings.botLength)
    && validateNumber(settings.trackWidth);
}

function validateFlag(value: unknown): value is FlagModel {
  if (!value || typeof value !== "object") return false;
  const flag = value as Partial<FlagModel>;
  return typeof flag.id === "string"
    && flag.id.length > 0
    && validateNumber(flag.pathDistance)
    && (flag.type === undefined || flag.type === "string" || flag.type === "velocity")
    && typeof flag.label === "string"
    && (flag.velocityLimit === undefined || flag.velocityLimit === null || validateNumber(flag.velocityLimit));
}

function normalizeFlag(flag: FlagModel): FlagModel {
  return {
    id: flag.id,
    pathDistance: Math.max(0, Number.isFinite(flag.pathDistance) ? flag.pathDistance : 0),
    type: flag.type ?? "string",
    label: flag.label ?? "",
    velocityLimit: flag.type === "velocity"
      ? (flag.velocityLimit ?? null)
      : null,
  };
}

function normalizeFlags(flags: FlagModel[]): FlagModel[] {
  return flags.map((flag) => normalizeFlag(flag));
}

function parseExportPayload(rawText: string, fileName: string): ExportedPathFile {
  const parsed = JSON.parse(rawText) as Partial<ExportedPathFile>;

  if (parsed.version !== EXPORT_SCHEMA_VERSION) {
    throw new Error(`${fileName}: unsupported schema version.`);
  }
  if (typeof parsed.pathName !== "string" || parsed.pathName.trim().length === 0) {
    throw new Error(`${fileName}: missing path name.`);
  }
  if (!Array.isArray(parsed.controlpoints) || !parsed.controlpoints.every(validateControlPoint)) {
    throw new Error(`${fileName}: invalid controlpoints.`);
  }
  if (!Array.isArray(parsed.sections) || !parsed.sections.every(validateSection)) {
    throw new Error(`${fileName}: invalid sections.`);
  }
  if (!Array.isArray(parsed.flags) || !parsed.flags.every(validateFlag)) {
    throw new Error(`${fileName}: invalid flags.`);
  }
  if (!validateSettings(parsed.settings)) {
    throw new Error(`${fileName}: invalid settings.`);
  }

  return {
    version: parsed.version,
    pathName: parsed.pathName,
    controlpoints: cloneControlPoints(parsed.controlpoints),
    sections: cloneSections(parsed.sections),
    flags: normalizeFlags(cloneFlags(parsed.flags)),
    settings: parsed.settings,
  };
}

function toPathModel(payload: ExportedPathFile): PathModel {
  return {
    name: payload.pathName,
    controlpoints: cloneControlPoints(payload.controlpoints),
    sections: cloneSections(payload.sections),
    pathpoints: [],
    flags: normalizeFlags(cloneFlags(payload.flags)),
  };
}

async function recomputeAllPaths(): Promise<void> {
  const activeIndex = activePathIndex;
  for (let i = 0; i < paths.length; i++) {
    setActivePathIndex(i);
    computePathProfile();
  }
  setActivePathIndex(activeIndex);
}

async function exportPathFolder(): Promise<void> {
  if (paths.every((path) => path.controlpoints.length === 0)) {
    alert("No paths available to export.");
    return;
  }

  try {
    const directoryHandle = await (window as typeof window & {
      showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
    }).showDirectoryPicker?.();

    if (!directoryHandle) {
      alert("Folder export was cancelled or is not supported in this browser.");
      return;
    }

    await recomputeAllPaths();

    const exportablePaths = paths.filter((path) => path.controlpoints.length > 0);
    const baseNames = buildUniqueBaseNames(exportablePaths);

    for (let i = 0; i < exportablePaths.length; i++) {
      const path = exportablePaths[i];
      const baseName = baseNames[i];
      const routeName = sanitizeCppIdentifier(baseName);
      const cppContent = buildCppContent(routeName, interpolateExportPoints(path.pathpoints));
      const jsonContent = JSON.stringify(createExportPayload(path), null, 2);

      await writeTextFile(directoryHandle, `${baseName}.cpp`, cppContent);
      await writeTextFile(directoryHandle, `${baseName}.json`, `${jsonContent}\n`);
    }
  } catch (err) {
    console.error("Folder export failed:", err);
    alert("Folder export failed. Make sure your browser supports directory access.");
  }
}

async function readJsonFilesFromDirectory(directoryHandle: DirectoryHandleLike): Promise<File[]> {
  const files: File[] = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== "file" || !entry.name.toLowerCase().endsWith(".json") || !entry.getFile) {
      continue;
    }
    files.push(await entry.getFile());
  }

  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

async function importPathFolder(): Promise<void> {
  try {
    const directoryHandle = await (window as typeof window & {
      showDirectoryPicker?: () => Promise<DirectoryHandleLike>;
    }).showDirectoryPicker?.();

    if (!directoryHandle) {
      alert("Folder import was cancelled or is not supported in this browser.");
      return;
    }

    const files = await readJsonFilesFromDirectory(directoryHandle);
    if (files.length === 0) {
      alert("No path metadata JSON files were found in that folder.");
      return;
    }

    const importedPaths: PathModel[] = [];
    let importedSettings: PersistedSettings | null = null;
    const skippedFiles: string[] = [];

    for (const file of files) {
      try {
        const payload = parseExportPayload(await file.text(), file.name);
        if (!importedSettings) {
          importedSettings = payload.settings;
        }
        importedPaths.push(toPathModel(payload));
      } catch (error) {
        console.warn("Skipping invalid import file:", file.name, error);
        skippedFiles.push(file.name);
      }
    }

    if (importedPaths.length === 0 || !importedSettings) {
      alert("No valid path metadata files were found in that folder.");
      return;
    }

    applyPersistedSettings(importedSettings);
    replaceEditorPaths(importedPaths, 0);

    if (skippedFiles.length > 0) {
      alert(`Imported ${importedPaths.length} path(s). Skipped: ${skippedFiles.join(", ")}`);
    }
  } catch (err) {
    console.error("Folder import failed:", err);
    alert("Folder import failed. Make sure your browser supports directory access.");
  }
}

document.addEventListener("mousemove", (e) => {
  if (!cursor) return;
  cursor.style.left = `${e.clientX}px`;
  cursor.style.top = `${e.clientY}px`;
});

document.addEventListener("DOMContentLoaded", () => {
  const saveCppButton = document.getElementById("saveCpp") as HTMLButtonElement | null;
  const importFolderButton = document.getElementById("importFolder") as HTMLButtonElement | null;

  saveCppButton?.addEventListener("click", () => {
    void exportPathFolder();
  });

  importFolderButton?.addEventListener("click", () => {
    void importPathFolder();
  });
});
