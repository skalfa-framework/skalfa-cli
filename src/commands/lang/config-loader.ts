import path from "node:path";
import fs from "node:fs";
import { LangConfig } from "@skalfa/skalfa-lang";

export async function loadConfig(projectRoot: string): Promise<LangConfig> {
  const tsConfigPath = path.join(projectRoot, "lang.config.ts");
  const jsConfigPath = path.join(projectRoot, "lang.config.js");

  let configPath = "";
  if (fs.existsSync(tsConfigPath)) {
    configPath = tsConfigPath;
  } else if (fs.existsSync(jsConfigPath)) {
    configPath = jsConfigPath;
  }

  const DEFAULT_CONFIG: LangConfig = {
    defaultLocale: "id",
    locales: ["id", "en"],
    backend: {
      path: "langs"
    },
    output: "langs/.generated"
  };

  if (configPath) {
    try {
      const { pathToFileURL } = require("node:url");
      const imported = await import(pathToFileURL(configPath).href);
      const config = imported.default || imported;
      return { ...DEFAULT_CONFIG, ...config };
    } catch (err) {
      try {
        const { execSync } = require("node:child_process");
        const escapedPath = configPath.replace(/\\/g, "/");
        const stdout = execSync(`bun -e "import config from '${escapedPath}'; console.log(JSON.stringify(config))"`, { stdio: "pipe" }).toString();
        const config = JSON.parse(stdout);
        return { ...DEFAULT_CONFIG, ...config };
      } catch (bunErr) {
        console.warn(`[skalfa-lang] Warning: Failed to load config from ${configPath} dynamically. Using default configurations.`);
      }
    }
  }

  return DEFAULT_CONFIG;
}
