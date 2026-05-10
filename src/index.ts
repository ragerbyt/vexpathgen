import "./point";
import "./draw";
import "./curve";
import "./plot";
import "./css/styles.css";
import "./ui";
import "./sidebar";

import {
  activePathIndex,
  PathModel,
  applyPersistedSettings,
  controlPoint,
  getPersistedSettings,
  pathPoint,
  paths,
  section,
  setActivePathIndex,
} from "./globals";
import { computePathProfile } from "./curve";
import { replaceEditorPaths } from "./point";

const EXPORT_SCHEMA_VERSION = 1;
const cursor = document.getElementById("cursorDot");

type PersistedSettings = ReturnType<typeof getPersistedSettings>;

type ExportedPathFile = {
  version: number;
  pathName: string;
  controlpoints: controlPoint[];
  sections: section[];
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

function createExportPayload(path: PathModel): ExportedPathFile {
  return {
    version: EXPORT_SCHEMA_VERSION,
    pathName: path.name,
    controlpoints: cloneControlPoints(path.controlpoints),
    sections: cloneSections(path.sections),
    settings: getPersistedSettings(),
  };
}

function buildCppContent(routeName: string, points: pathPoint[]): string {
  const mode = "BACK";
  const rows = points.map((wp) => {
    const orientation = mode === "BACK" ? wp.orientation + Math.PI : wp.orientation;
    const velocity = mode === "BACK" ? -wp.velocity : wp.velocity;
    return `    {${Math.round(wp.time * 1000)}, ${Math.round(wp.x * 50)}, ${Math.round(wp.y * 50)}, ${Math.round(orientation * 100)}, ${Math.round(velocity * 100)}, ${Math.round(wp.angularVelocity * 1000)}}`;
  });

  return `#include "paths.h"\n\nconst std::vector<Data> ${routeName} = {\n${rows.join(",\n")}\n};`;
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
  if (!validateSettings(parsed.settings)) {
    throw new Error(`${fileName}: invalid settings.`);
  }

  return {
    version: parsed.version,
    pathName: parsed.pathName,
    controlpoints: cloneControlPoints(parsed.controlpoints),
    sections: cloneSections(parsed.sections),
    settings: parsed.settings,
  };
}

function toPathModel(payload: ExportedPathFile): PathModel {
  return {
    name: payload.pathName,
    controlpoints: cloneControlPoints(payload.controlpoints),
    sections: cloneSections(payload.sections),
    pathpoints: [],
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
      const cppContent = buildCppContent(routeName, path.pathpoints);
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
