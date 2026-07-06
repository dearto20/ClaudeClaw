import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const scriptsRoot = path.dirname(__filename);

export const harnessRoot = path.resolve(scriptsRoot, "..");
export const workspaceRoot = path.resolve(harnessRoot, "..");
export const developmentRoot = path.join(workspaceRoot, "development");
export const sourceMarkerPath = path.join(developmentRoot, "developmentharness-source.json");

export const validSourcePhases = new Set(["coexistence", "final"]);

export const pathExists = async (absolutePath) => {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
};

export const readJson = async (absolutePath) => {
  const content = await readFile(absolutePath, "utf8");
  return JSON.parse(content);
};

export const getValidationMode = async () => {
  if (!(await pathExists(sourceMarkerPath))) {
    return {
      mode: "target",
      isSource: false,
      isSourceFinal: false,
      isSourceCoexistence: false,
      markerPath: sourceMarkerPath,
      developmentRoot,
      harnessRoot,
      workspaceRoot,
    };
  }

  let marker;
  try {
    marker = await readJson(sourceMarkerPath);
  } catch {
    return {
      mode: "target",
      isSource: false,
      isSourceFinal: false,
      isSourceCoexistence: false,
      markerPath: sourceMarkerPath,
      developmentRoot,
      harnessRoot,
      workspaceRoot,
      invalidMarker: true,
    };
  }

  const allowedExtraFields = Object.keys(marker).every((field) =>
    ["schemaVersion", "repoKind", "migrationPhase", "sourceRoot"].includes(field) || field.startsWith("x_")
  );
  const valid =
    marker?.schemaVersion === "1.0.0" &&
    marker?.repoKind === "DevelopmentHarnessSource" &&
    validSourcePhases.has(marker?.migrationPhase) &&
    marker?.sourceRoot === "development" &&
    allowedExtraFields;

  if (!valid) {
    return {
      mode: "target",
      isSource: false,
      isSourceFinal: false,
      isSourceCoexistence: false,
      markerPath: sourceMarkerPath,
      developmentRoot,
      harnessRoot,
      workspaceRoot,
      invalidMarker: true,
    };
  }

  return {
    mode: `source-${marker.migrationPhase}`,
    phase: marker.migrationPhase,
    isSource: true,
    isSourceFinal: marker.migrationPhase === "final",
    isSourceCoexistence: marker.migrationPhase === "coexistence",
    marker,
    markerPath: sourceMarkerPath,
    developmentRoot,
    harnessRoot,
    workspaceRoot,
  };
};
