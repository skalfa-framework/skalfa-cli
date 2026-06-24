import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import readline from "node:readline";
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

const TEMPLATE_ENV_KEY = "SKALFA_APP_TEMPLATE";

class Questioner {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  ask(query: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }

  close() {
    this.rl.close();
  }
}

export async function createApp(projectName: string): Promise<void> {
  const cwd = process.cwd();
  const target = path.resolve(cwd, projectName);
  const packageName = path.basename(target);

  assertInsideDirectory(cwd, target);

  if (exists(target)) {
    throw new Error(`Target directory already exists: ${target}`);
  }

  // Ask interactive questions sequentially
  const q = new Questioner();
  let hasIdb = false;
  let hasSocket = false;
  let hasDocument = false;

  try {
    hasIdb = (await q.ask("Do you need IndexedDB (IDB)? (y/N): ")).toLowerCase().startsWith("y");
    hasSocket = (await q.ask("Do you need Socket.io Client? (y/N): ")).toLowerCase().startsWith("y");
    hasDocument = (await q.ask("Do you need Document Export/Viewer (PDF/Excel)? (y/N): ")).toLowerCase().startsWith("y");
  } finally {
    q.close();
  }

  const envTemplateSource = process.env[TEMPLATE_ENV_KEY];

  if (envTemplateSource) {
    // Local copy mode
    const templateSource = path.resolve(envTemplateSource);
    console.log(`Creating Skalfa App project from local template override: ${templateSource}`);
    if (!exists(templateSource)) {
      throw new Error(`Template source override not found: ${templateSource}`);
    }
    copyTemplate(templateSource, target);
  } else {
    // Dynamic download from npm registry
    const templatePackageName = "@skalfa/skalfa-app";
    console.log(`Fetching latest template info for ${templatePackageName} from npm registry...`);
    const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

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

    fs.renameSync(packageDir, target);
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  // Cleanup git and github directories
  removeDirectory(path.join(target, ".git"));
  removeDirectory(path.join(target, ".github"));
  renamePackage(target, packageName);

  // Rename .npmignore to .gitignore if it exists
  const npmignorePath = path.join(target, ".npmignore");
  const gitignorePath = path.join(target, ".gitignore");
  if (fs.existsSync(npmignorePath) && !fs.existsSync(gitignorePath)) {
    fs.renameSync(npmignorePath, gitignorePath);
  }

  // Customize project with selected options
  customizeProject(target, {
    idb: hasIdb,
    socket: hasSocket,
    document: hasDocument
  });
  
  console.log("Installing dependencies...");
  installDependencies(target);

  console.log("");
  console.log("✓ Skalfa App Next.js project is ready.");
  console.log(`Next steps:\n  cd ${projectName}\n  bun run dev`);
}

function renamePackage(target: string, packageName: string): void {
  const packageJsonPath = path.join(target, "package.json");

  if (!exists(packageJsonPath)) {
    console.warn("Skipped package rename: package.json was not found.");
    return;
  }

  const packageJson = readJsonFile<Record<string, unknown>>(packageJsonPath);
  packageJson.name = packageName;
  writeJsonFile(packageJsonPath, packageJson);
}

interface CustomizationOptions {
  idb: boolean;
  socket: boolean;
  document: boolean;
}

function customizeProject(target: string, opts: CustomizationOptions): void {
  const packageJsonPath = path.join(target, "package.json");
  const baseComponentsIndexPath = path.join(target, "components", "base.components", "index.ts");
  const isDev = !!process.env[TEMPLATE_ENV_KEY];

  // 1. Update dependencies and scripts in package.json
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    pkg.dependencies = pkg.dependencies || {};

    // Core dependency
    pkg.dependencies["@skalfa/skalfa-app-core"] = isDev ? "file:../skalfa-app-core" : "^1.0.0";

    // A. IndexedDB Option
    if (opts.idb) {
      pkg.dependencies["@skalfa/skalfa-idb"] = isDev ? "file:../skalfa-idb" : "^1.0.0";
    } else {
      // Delete schema directory
      const schemaDir = path.join(target, "schema");
      if (fs.existsSync(schemaDir)) {
        fs.rmSync(schemaDir, { recursive: true, force: true });
      }

      // Delete IDBProvider component
      const idbProviderPath = path.join(target, "components", "base.components", "wrap", "IDBProvider.tsx");
      if (fs.existsSync(idbProviderPath)) {
        fs.unlinkSync(idbProviderPath);
      }

      // Remove export from base.components/index.ts
      if (fs.existsSync(baseComponentsIndexPath)) {
        let content = fs.readFileSync(baseComponentsIndexPath, "utf8");
        content = content.replace(/export \* from "\.\/wrap\/IDBProvider";\r?\n?/g, "");
        fs.writeFileSync(baseComponentsIndexPath, content, "utf8");
      }

      // Modify app/layout.tsx to remove IDBProvider wrapper
      const layoutPath = path.join(target, "app", "layout.tsx");
      if (fs.existsSync(layoutPath)) {
        let content = fs.readFileSync(layoutPath, "utf8");
        content = content
          .replace(/import\s*\{\s*IDBProvider\s*,\s*ShortcutProvider\s*\}\s*from\s*["']@components["'];?/g, 'import { ShortcutProvider } from "@components";')
          .replace(/<IDBProvider>\s*\r?\n?/g, "")
          .replace(/<\/IDBProvider>\s*\r?\n?/g, "");
        fs.writeFileSync(layoutPath, content, "utf8");
      }
    }

    // B. Socket Option
    if (opts.socket) {
      pkg.dependencies["@skalfa/skalfa-socket-client"] = isDev ? "file:../skalfa-socket-client" : "^1.0.0";
      pkg.dependencies["socket.io-client"] = "^4.8.1";
    }

    // C. Document Option
    if (opts.document) {
      pkg.dependencies["@skalfa/skalfa-document"] = isDev ? "file:../skalfa-document" : "^1.0.0";
      pkg.dependencies["exceljs"] = "^4.4.0";
      pkg.dependencies["pdf-lib"] = "^1.17.1";
      pkg.dependencies["pdfjs-dist"] = "^4.4.168";
    } else {
      // Delete local document folder
      const documentDir = path.join(target, "components", "base.components", "document");
      if (fs.existsSync(documentDir)) {
        fs.rmSync(documentDir, { recursive: true, force: true });
      }
      
      // Delete public pdf worker
      const workerPath = path.join(target, "public", "pdf.worker.min.mjs");
      if (fs.existsSync(workerPath)) {
        fs.unlinkSync(workerPath);
      }

      // Remove exports from base.components/index.ts
      if (fs.existsSync(baseComponentsIndexPath)) {
        let content = fs.readFileSync(baseComponentsIndexPath, "utf8");
        content = content
          .replace(/export \* from "\.\/document\/DocumentViewer\.component";\r?\n?/g, "")
          .replace(/export \* from "\.\/document\/ExportExcel\.component";\r?\n?/g, "")
          .replace(/export \* from "\.\/document\/ImportExcel\.component";\r?\n?/g, "")
          .replace(/export \* from "\.\/document\/PrintTable\.component";\r?\n?/g, "")
          .replace(/export \* from "\.\/document\/RenderPDF\.component";\r?\n?/g, "");
        fs.writeFileSync(baseComponentsIndexPath, content, "utf8");
      }
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
  }
}
