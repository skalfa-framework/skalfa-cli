import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fetchLatestTarballUrl, downloadTarball } from "../utils/npm";
import { installDependencies } from "../utils/installer";
import {
  assertInsideDirectory,
  exists,
  readJsonFile,
  removeDirectory,
  writeJsonFile
} from "../utils/fs";
import { copyTemplate } from "../utils/copier";

const TEMPLATE_ENV_KEY = "KAVA_API_TEMPLATE";

export async function createApi(projectName: string): Promise<void> {
  const cwd = process.cwd();
  const target = path.resolve(cwd, projectName);
  const packageName = path.basename(target);

  assertInsideDirectory(cwd, target);

  if (exists(target)) {
    throw new Error(`Target directory already exists: ${target}`);
  }

  const envTemplateSource = process.env[TEMPLATE_ENV_KEY];

  if (envTemplateSource) {
    // Local copy mode (e.g. for development / override)
    const templateSource = path.resolve(envTemplateSource);
    console.log(`Creating Kava API project from local template override: ${templateSource}`);
    if (!exists(templateSource)) {
      throw new Error(`Template source override not found: ${templateSource}`);
    }
    copyTemplate(templateSource, target);
  } else {
    // Dynamic download from npm registry
    const templatePackageName = "@kava/kava-api";
    console.log(`Fetching latest template info for ${templatePackageName} from npm registry...`);
    const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

    // Create a temporary extraction directory inside parent folder of target
    const parentDir = path.dirname(target);
    const tempExtractDir = path.join(parentDir, `${projectName}-temp-extract`);
    if (exists(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExtractDir, { recursive: true });

    const tarballPath = path.join(tempExtractDir, "template.tgz");
    console.log("Downloading template tarball...");
    await downloadTarball(tarballUrl, tarballPath);

    console.log("Extracting template...");
    try {
      execSync(`tar -xzf "${tarballPath}" -C "${tempExtractDir}"`, { stdio: "ignore" });
    } catch (err) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error(`Failed to extract template tarball. Please ensure 'tar' command is available: ${(err as Error).message}`);
    }

    const packageDir = path.join(tempExtractDir, "package");
    if (!exists(packageDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error("Invalid template structure: 'package' folder not found inside tarball.");
    }

    // Rename/move extracted folder to target path
    fs.renameSync(packageDir, target);

    // Cleanup temp extract folder
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  // Cleanup git directory if present and rename package
  removeDirectory(path.join(target, ".git"));
  renamePackage(target, packageName);
  
  console.log("Installing dependencies...");
  installDependencies(target);

  console.log("");
  console.log("✓ Kava API project is ready.");
  console.log(`Next steps:\n  cd ${projectName}\n  bun run dev`);
}

export function renamePackage(target: string, packageName: string): void {
  const packageJsonPath = path.join(target, "package.json");

  if (!exists(packageJsonPath)) {
    console.warn("Skipped package rename: package.json was not found.");
    return;
  }

  const packageJson = readJsonFile<Record<string, unknown>>(packageJsonPath);
  packageJson.name = packageName;
  writeJsonFile(packageJsonPath, packageJson);
}