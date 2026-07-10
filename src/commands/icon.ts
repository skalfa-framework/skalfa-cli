import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { findProjectRoot } from "../utils/fs";

function runGenerate(projectRoot: string, quiet = false): boolean {
  let scriptPath = path.join(projectRoot, "node_modules", "@skalfa", "skalfa-icon", "scripts", "generate.ts");
  if (!fs.existsSync(scriptPath)) {
    // Fallback for monorepo development
    scriptPath = path.resolve(projectRoot, "..", "skalfa-icon", "scripts", "generate.ts");
  }

  if (fs.existsSync(scriptPath)) {
    try {
      execSync(`bun run "${scriptPath}"${quiet ? " --quiet" : ""}`, { stdio: "inherit", cwd: projectRoot });
      return true;
    } catch (err) {
      console.error("❌ Failed to execute icon generator script");
      return false;
    }
  } else {
    console.error("❌ Error: @skalfa/skalfa-icon package not found. Make sure it is installed.");
    return false;
  }
}

export async function runBuildIcon(projectRoot: string, quiet = false): Promise<boolean> {
  if (!quiet) console.log("🔍 Building custom SVG icons...");
  return runGenerate(projectRoot, quiet);
}

export async function startDevIcon(projectRoot: string, quiet = false): Promise<void> {
  const iconsDir = path.resolve(projectRoot, "icons");
  if (!fs.existsSync(iconsDir)) {
    if (!quiet) console.log(`📁 Creating missing icons folder: ${iconsDir}`);
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  if (quiet) {
    console.log(`[START] Icon watcher running for: ${iconsDir}`);
  } else {
    console.log("👀 Starting icon development watcher...");
    console.log(`📺 Watching SVG files in: ${iconsDir}`);
  }

  runGenerate(projectRoot, quiet);

  let isThrottled = false;
  fs.watch(iconsDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith(".svg")) {
      if (isThrottled) return;
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, 300); // 300ms throttle to prevent double runs

      console.log(`\n⚡ Icon file change detected: ${filename} (${eventType})`);
      runGenerate(projectRoot, quiet);
    }
  });
}
