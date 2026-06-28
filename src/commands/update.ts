import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fetchLatestVersion } from "../utils/npm";

const PACKAGE_NAME = "@skalfa/skalfa-cli";

export async function updateCli(): Promise<void> {
  // 1. Get current version
  const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
  let currentVersion = "0.0.0";
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    currentVersion = packageJson.version;
  } catch (err) {
    throw new Error(`Failed to read local package.json from ${packageJsonPath}: ${(err as Error).message}`);
  }

  console.log(`Current version: v${currentVersion}`);
  console.log("Checking for updates...");

  // 2. Fetch latest version from registry
  let latestVersion: string;
  try {
    latestVersion = await fetchLatestVersion(PACKAGE_NAME);
  } catch (err) {
    throw new Error(`Failed to fetch latest version: ${(err as Error).message}`);
  }

  console.log(`Latest version:  v${latestVersion}`);

  if (currentVersion === latestVersion) {
    console.log(`\n✓ ${PACKAGE_NAME} is already up to date.`);
    return;
  }

  console.log(`\nUpdating ${PACKAGE_NAME} from v${currentVersion} to v${latestVersion}...`);

  // 3. Detect package manager and install
  const scriptPath = process.argv[1] || "";
  const normalizedPath = scriptPath.toLowerCase();
  
  let packageManager = "npm";
  if (normalizedPath.includes(".bun") || normalizedPath.includes("bun")) {
    packageManager = "bun";
  } else if (normalizedPath.includes("yarn")) {
    packageManager = "yarn";
  } else if (normalizedPath.includes("pnpm")) {
    packageManager = "pnpm";
  } else if (typeof (process as any).versions?.bun !== "undefined") {
    packageManager = "bun";
  }

  let updateCommand = "";
  if (packageManager === "bun") {
    updateCommand = `bun install -g ${PACKAGE_NAME}@latest`;
  } else if (packageManager === "yarn") {
    updateCommand = `yarn global add ${PACKAGE_NAME}@latest`;
  } else if (packageManager === "pnpm") {
    updateCommand = `pnpm add -g ${PACKAGE_NAME}@latest`;
  } else {
    updateCommand = `npm install -g ${PACKAGE_NAME}@latest`;
  }

  console.log(`Running: ${updateCommand}`);
  try {
    execSync(updateCommand, { stdio: "inherit" });
    console.log(`\n✓ Successfully updated ${PACKAGE_NAME} to v${latestVersion}!`);
  } catch (err) {
    throw new Error(`Failed to run update command: ${(err as Error).message}`);
  }
}
