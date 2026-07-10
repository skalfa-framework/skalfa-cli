import fs from "node:fs";
import path from "node:path";
import { LangConfig } from "@skalfa/skalfa-lang";

export interface ScannedFile {
  type: "backend" | "frontend-global" | "frontend-module";
  moduleName?: string; // e.g. "dashboard/users"
  locale: string;      // e.g. "id", "en"
  namespace: string;   // e.g. "common", "modalDelete"
  filePath: string;
}

export function scanLangs(projectRoot: string, config: LangConfig): ScannedFile[] {
  const files: ScannedFile[] = [];

  // 1. Scan Backend Locales (Flat)
  if (config.backend?.path) {
    const backendDir = path.resolve(projectRoot, config.backend.path);
    if (fs.existsSync(backendDir)) {
      const localesList = fs.readdirSync(backendDir, { withFileTypes: true });
      for (const localeDir of localesList) {
        if (localeDir.isDirectory() && !localeDir.name.startsWith(".")) {
          const localeCode = localeDir.name;
          const localePath = path.join(backendDir, localeCode);
          const jsonFiles = fs.readdirSync(localePath);
          for (const file of jsonFiles) {
            if (file.endsWith(".json")) {
              files.push({
                type: "backend",
                locale: localeCode,
                namespace: path.basename(file, ".json"),
                filePath: path.join(localePath, file)
              });
            }
          }
        }
      }
    }
  }

  // 2. Scan Frontend Global Locales
  if (config.frontend?.global) {
    const globalDir = path.resolve(projectRoot, config.frontend.global);
    if (fs.existsSync(globalDir)) {
      const localesList = fs.readdirSync(globalDir, { withFileTypes: true });
      for (const localeDir of localesList) {
        if (localeDir.isDirectory() && !localeDir.name.startsWith(".")) {
          const localeCode = localeDir.name;
          const localePath = path.join(globalDir, localeCode);
          const jsonFiles = fs.readdirSync(localePath);
          for (const file of jsonFiles) {
            if (file.endsWith(".json")) {
              files.push({
                type: "frontend-global",
                locale: localeCode,
                namespace: path.basename(file, ".json"),
                filePath: path.join(localePath, file)
              });
            }
          }
        }
      }
    }
  }

  // 3. Scan Frontend Module-level _langs Locales
  const searchRoots = ["src/app", "app"].map(p => path.resolve(projectRoot, p)).filter(fs.existsSync);

  for (const searchRoot of searchRoots) {
    const foundLangsDirs: string[] = [];

    const findLangsDirs = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (item.name === "_langs") {
            foundLangsDirs.push(fullPath);
          } else if (item.name !== "node_modules" && !item.name.startsWith(".")) {
            findLangsDirs(fullPath);
          }
        }
      }
    };

    findLangsDirs(searchRoot);

    for (const langsDir of foundLangsDirs) {
      const relative = path.relative(searchRoot, langsDir);
      const moduleName = path.dirname(relative).replace(/\\/g, "/");

      const localesList = fs.readdirSync(langsDir, { withFileTypes: true });
      for (const localeDir of localesList) {
        if (localeDir.isDirectory() && !localeDir.name.startsWith(".")) {
          const localeCode = localeDir.name;
          const localePath = path.join(langsDir, localeCode);
          const jsonFiles = fs.readdirSync(localePath);
          for (const file of jsonFiles) {
            if (file.endsWith(".json")) {
              files.push({
                type: "frontend-module",
                moduleName,
                locale: localeCode,
                namespace: path.basename(file, ".json"),
                filePath: path.join(localePath, file)
              });
            }
          }
        }
      }
    }
  }

  return files;
}
