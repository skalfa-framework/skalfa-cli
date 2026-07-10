import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config-loader";
import { scanLangs } from "./scanner";
import { parseAssets } from "./parser";
import { validateAssets } from "./validator";
import { generateTypes } from "./type-generator";
import {
  generateGlobalLocale,
  generateModuleLocale,
  generateManifest,
  generateIndex
} from "./runtime-generator";

function writeGeneratedFiles(
  projectRoot: string,
  outputDir: string,
  assets: any[],
  locales: string[],
  defaultLocale: string
) {
  const resolvedOutDir = path.resolve(projectRoot, outputDir);
  const localesDir = path.join(resolvedOutDir, "locales");
  const modulesDir = path.join(resolvedOutDir, "modules");

  fs.mkdirSync(resolvedOutDir, { recursive: true });
  fs.mkdirSync(localesDir, { recursive: true });
  fs.mkdirSync(modulesDir, { recursive: true });

  const typesContent = generateTypes(assets, defaultLocale);
  fs.writeFileSync(path.join(resolvedOutDir, "types.ts"), typesContent, "utf8");

  for (const locale of locales) {
    const localeContent = generateGlobalLocale(locale, assets);
    fs.writeFileSync(path.join(localesDir, `${locale}.ts`), localeContent, "utf8");
  }

  const modules = Array.from(
    new Set(assets.filter(a => a.type === "frontend-module").map(a => a.moduleName || ""))
  ).filter(Boolean);

  for (const mod of modules) {
    const moduleContent = generateModuleLocale(mod, assets);
    const escapedFilename = mod.replace(/\//g, ".");
    fs.writeFileSync(path.join(modulesDir, `${escapedFilename}.ts`), moduleContent, "utf8");
  }

  const manifestContent = generateManifest(locales, modules);
  fs.writeFileSync(path.join(resolvedOutDir, "manifest.ts"), manifestContent, "utf8");

  const indexContent = generateIndex(locales);
  fs.writeFileSync(path.join(resolvedOutDir, "index.ts"), indexContent, "utf8");
}

export async function runBuild(projectRoot: string, isWatch = false, quiet = false): Promise<boolean> {
  if (!quiet) console.log("🔍 Scanning translation assets...");
  const config = await loadConfig(projectRoot);
  const files = scanLangs(projectRoot, config);
  const assets = parseAssets(files);

  if (!quiet) console.log(`✅ Scanned ${assets.length} JSON files.`);

  if (!quiet) console.log("🛡️ Validating locales consistency...");
  const errors = validateAssets(assets, config.defaultLocale);

  if (errors.length > 0) {
    console.error(`\n❌ Validation Failed with ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`  - [${err.type.toUpperCase()}] ${err.message}`);
      console.error(`    File: ${err.filePath}\n`);
    }
    if (!isWatch) {
      return false;
    }
  } else {
    if (!quiet) console.log("✨ Validation passed successfully.");
  }

  if (!quiet) console.log("📦 Generating runtime assets...");
  writeGeneratedFiles(projectRoot, config.output || ".generated", assets, config.locales, config.defaultLocale);
  if (!quiet) console.log("🚀 Code generation completed successfully.\n");
  return true;
}

export async function startDev(projectRoot: string, quiet = false): Promise<void> {
  const config = await loadConfig(projectRoot);
  const watchPaths: string[] = [];

  if (config.backend?.path) {
    watchPaths.push(path.resolve(projectRoot, config.backend.path));
  }
  if (config.frontend?.global) {
    watchPaths.push(path.resolve(projectRoot, config.frontend.global));
  }
  if (config.frontend?.modules) {
    const appDir = path.resolve(projectRoot, "src/app");
    if (fs.existsSync(appDir)) {
      watchPaths.push(appDir);
    } else {
      const appDirAlt = path.resolve(projectRoot, "app");
      if (fs.existsSync(appDirAlt)) {
        watchPaths.push(appDirAlt);
      }
    }
  }

  if (quiet) {
    console.log(`[START] Lang watcher running for: ${watchPaths.map(p => path.basename(p)).join(", ")}`);
  } else {
    console.log("👀 Starting lang dev (watch mode)...");
    console.log("📺 Watching paths:", watchPaths);
  }

  await runBuild(projectRoot, true, quiet);

  let isThrottled = false;
  for (const watchPath of watchPaths) {
    if (fs.existsSync(watchPath)) {
      fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith(".json")) {
          if (isThrottled) return;
          isThrottled = true;
          setTimeout(() => {
            isThrottled = false;
          }, 100);
 
          console.log(`\n⚡ File change detected: ${filename} (${eventType})`);
          runBuild(projectRoot, true, quiet).catch(err => {
            console.error("Failed to run generation:", err);
          });
        }
      });
    }
  }
}
export { loadConfig } from "./config-loader";
export { scanLangs } from "./scanner";
export { parseAssets } from "./parser";
export { validateAssets } from "./validator";
export { generateTypes } from "./type-generator";
export {
  generateGlobalLocale,
  generateModuleLocale,
  generateManifest,
  generateIndex
} from "./runtime-generator";
