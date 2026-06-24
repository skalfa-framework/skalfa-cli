import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fetchLatestTarballUrl, downloadTarball } from "../utils/npm";
import { copyTemplate } from "../utils/copier";
import { findProjectRoot, exists } from "../utils/fs";
import { installPackage } from "../utils/installer";

export const extensions = {
  mail: "@skalfa/mail",
  redis: "@skalfa/skalfa-redis",
  queue: "@skalfa/skalfa-queue",
  cache: "@skalfa/skalfa-cache",
  cron: "@skalfa/skalfa-cron",
  da: "@skalfa/skalfa-da",
  socket: "@skalfa/skalfa-socket",
  orm: "@skalfa/skalfa-orm"
} as const;

export const extensionNames = Object.keys(extensions);

export async function addExtension(extensionName: string): Promise<void> {
  const packageName = extensions[extensionName as keyof typeof extensions];

  if (!packageName) {
    throw new Error(
      `Unknown extension "${extensionName}". Available extensions: ${extensionNames.join(", ")}`
    );
  }

  const projectRoot = findProjectRoot(process.cwd());

  if (!projectRoot) {
    throw new Error("No package.json found. Run this command inside a Skalfa API project.");
  }

  const isDev = !!process.env["SKALFA_API_TEMPLATE"];

  if (extensionName === "orm") {
    console.log("Installing Skalfa ORM and database dependencies...");
    installPackage(projectRoot, isDev ? "file:../skalfa-orm" : "@skalfa/skalfa-orm");
    installPackage(projectRoot, "knex");
    installPackage(projectRoot, "pg");
    await scaffoldOrmExtension(projectRoot);
  } else if (["redis", "queue", "cache", "cron", "da", "socket"].includes(extensionName)) {
    console.log(`Installing Skalfa extension: ${extensionName}...`);
    
    // Install the main package
    installPackage(projectRoot, isDev ? `file:../${packageName.split("/")[1]}` : packageName);

    // Install peer dependencies if any
    if (extensionName === "redis") {
      installPackage(projectRoot, "ioredis");
    } else if (extensionName === "da") {
      installPackage(projectRoot, "@clickhouse/client");
    } else if (extensionName === "socket") {
      installPackage(projectRoot, "socket.io");
    }

    // Auto-install Redis if Queue or Cache is added
    if (extensionName === "queue" || extensionName === "cache") {
      console.log(`Extension ${extensionName} requires Redis. Automatically installing @skalfa/skalfa-redis...`);
      installPackage(projectRoot, isDev ? "file:../skalfa-redis" : "@skalfa/skalfa-redis");
      installPackage(projectRoot, "ioredis");
    }

    await scaffoldUtilityExtension(projectRoot, extensionName);
  } else {
    console.log(`Installing Skalfa extension: ${extensionName}`);
    installPackage(projectRoot, packageName);
    console.log(`Installed ${packageName}`);
  }
}

async function getTemplateSource(projectRoot: string): Promise<{ templateSource: string; cleanup: () => void }> {
  const envTemplateSource = process.env["SKALFA_API_TEMPLATE"];
  let tempExtractDir: string | null = null;
  let templateSource = "";

  if (envTemplateSource) {
    templateSource = path.resolve(envTemplateSource);
    if (!exists(templateSource)) {
      throw new Error(`Template source override not found: ${templateSource}`);
    }
    return { templateSource, cleanup: () => {} };
  } else {
    // Dynamic download from npm registry
    const templatePackageName = "@skalfa/skalfa-api";
    console.log(`Fetching latest template info for ${templatePackageName} from npm registry...`);
    const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

    const parentDir = path.dirname(projectRoot);
    tempExtractDir = path.join(parentDir, `skalfa-temp-extract-${Date.now()}`);
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

    templateSource = path.join(tempExtractDir, "package");
    if (!exists(templateSource)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      throw new Error("Invalid template structure: 'package' folder not found inside tarball.");
    }

    return {
      templateSource,
      cleanup: () => {
        if (tempExtractDir && exists(tempExtractDir)) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
      }
    };
  }
}

async function scaffoldOrmExtension(projectRoot: string): Promise<void> {
  const { templateSource, cleanup } = await getTemplateSource(projectRoot);

  try {
    // 1. Copy database/ folder and app/models/ folder from template
    console.log("Scaffolding database and model directories...");
    const dbSrc = path.join(templateSource, "database");
    const dbDest = path.join(projectRoot, "database");
    if (exists(dbSrc)) {
      copyTemplate(dbSrc, dbDest);
    }

    const modelsSrc = path.join(templateSource, "app", "models");
    const modelsDest = path.join(projectRoot, "app", "models");
    if (exists(modelsSrc)) {
      copyTemplate(modelsSrc, modelsDest);
    }

    // 2. Copy database-enabled UserController and AuthController from template
    console.log("Restoring database-enabled controllers...");
    const authControllerSrc = path.join(templateSource, "app", "controllers", "iam", "auth.controller.ts");
    const authControllerDest = path.join(projectRoot, "app", "controllers", "iam", "auth.controller.ts");
    if (exists(authControllerSrc)) {
      fs.mkdirSync(path.dirname(authControllerDest), { recursive: true });
      fs.copyFileSync(authControllerSrc, authControllerDest);
    }

    const userControllerSrc = path.join(templateSource, "app", "controllers", "iam", "user.controller.ts");
    const userControllerDest = path.join(projectRoot, "app", "controllers", "iam", "user.controller.ts");
    if (exists(userControllerSrc)) {
      fs.mkdirSync(path.dirname(userControllerDest), { recursive: true });
      fs.copyFileSync(userControllerSrc, userControllerDest);
    }

    // 3. Restore database CLI commands loader if missing
    console.log("Restoring database CLI commands...");
    const commandsSrc = path.join(templateSource, "utils", "commands");
    const commandsDest = path.join(projectRoot, "utils", "commands");
    if (exists(commandsSrc)) {
      const skalfaCliSrc = path.join(commandsSrc, "skalfa.ts");
      const skalfaCliDest = path.join(commandsDest, "skalfa.ts");
      if (exists(skalfaCliSrc) && !exists(skalfaCliDest)) {
        fs.mkdirSync(path.dirname(skalfaCliDest), { recursive: true });
        fs.copyFileSync(skalfaCliSrc, skalfaCliDest);
      }
    }

    // 4. Restore the database initialization block and imports in app/app.ts
    console.log("Restoring database initialization in app/app.ts...");
    const appTsSrc = path.join(templateSource, "app", "app.ts");
    const appTsDest = path.join(projectRoot, "app", "app.ts");
    if (exists(appTsSrc) && exists(appTsDest)) {
      const templateAppTs = fs.readFileSync(appTsSrc, "utf8");
      const regex = /(\/\/ ## Init: database\s*\r?\n\/\/ =====================================>\r?\n)([\s\S]*?)(\r?\n\/\/ =====================================>)/;
      const match = templateAppTs.match(regex);
      if (match) {
        const dbBlock = match[2];
        let targetAppTs = fs.readFileSync(appTsDest, "utf8");
        targetAppTs = targetAppTs.replace(
          /(\/\/ ## Init: database\s*\r?\n\/\/ =====================================>\r?\n)([\s\S]*?)(\r?\n\/\/ =====================================>)/,
          `$1${dbBlock}$3`
        );
        if (!targetAppTs.match(/\bdb\b/)) {
          targetAppTs = targetAppTs.replace(/(\bcontroller\b|\blogger\b)/, "db, $1");
        }
        fs.writeFileSync(appTsDest, targetAppTs, "utf8");
      }
    }

    // 5. Update tsconfig.json path mappings
    console.log("Updating tsconfig.json paths...");
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    if (exists(tsconfigPath)) {
      let content = fs.readFileSync(tsconfigPath, "utf8");
      if (!content.includes("@skalfa/skalfa-orm")) {
        content = content.replace(
          /("@utils\/\*"\s*:\s*\[\s*"utils\/\*",)/,
          `$1\n        "node_modules/@skalfa/skalfa-orm/dist/*",`
        );
        fs.writeFileSync(tsconfigPath, content, "utf8");
      }
    }

    // 6. Update utils/index.ts exports
    console.log("Updating utils/index.ts exports...");
    const utilsIndexPath = path.join(projectRoot, "utils", "index.ts");
    if (exists(utilsIndexPath)) {
      let content = fs.readFileSync(utilsIndexPath, "utf8");
      if (!content.includes("@skalfa/skalfa-orm")) {
        content = content.replace(
          /export \* from "@skalfa\/skalfa-api-core";/,
          `export * from "@skalfa/skalfa-api-core";\nexport * from "@skalfa/skalfa-orm";`
        );
        content = content.replace(/export const db: any = null;\r?\n/, "");
        content = content.replace(/export const Model: any = null;\r?\n/, "");
        fs.writeFileSync(utilsIndexPath, content, "utf8");
      }
    }
  } finally {
    cleanup();
  }

  console.log("✓ ORM initialization and scaffolding successfully restored!");
}

async function scaffoldUtilityExtension(projectRoot: string, ext: string): Promise<void> {
  const { templateSource, cleanup } = await getTemplateSource(projectRoot);

  try {
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    const utilsIndexPath = path.join(projectRoot, "utils", "index.ts");
    const appTsPath = path.join(projectRoot, "app", "app.ts");

    // 1. Copy relevant template folders
    if (ext === "queue") {
      console.log("Copying Queue worker examples...");
      const src = path.join(templateSource, "app", "jobs", "queues");
      const dest = path.join(projectRoot, "app", "jobs", "queues");
      copyTemplate(src, dest);

      // Check if project has DA or Notification packages
      const packageJsonPath = path.join(projectRoot, "package.json");
      let hasDa = false;
      let hasNotification = false;
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        const deps = pkg.dependencies || {};
        hasDa = !!deps["@skalfa/skalfa-da"];
        hasNotification = !!deps["@skalfa/notification"] || !!deps["skalfa-notification"];
      }
      cleanQueueWorkers(projectRoot, hasDa, hasNotification);
    } else if (ext === "cron") {
      console.log("Copying Cron job examples...");
      const src = path.join(templateSource, "app", "jobs", "crons");
      const dest = path.join(projectRoot, "app", "jobs", "crons");
      copyTemplate(src, dest);
    } else if (ext === "socket") {
      console.log("Copying Socket.io handler examples...");
      const src = path.join(templateSource, "app", "jobs", "sockets");
      const dest = path.join(projectRoot, "app", "jobs", "sockets");
      copyTemplate(src, dest);
    } else if (ext === "da") {
      console.log("Copying Data Analytics OLAP migrations...");
      const src = path.join(templateSource, "database", "da.migrations");
      const dest = path.join(projectRoot, "database", "da.migrations");
      copyTemplate(src, dest);
    }

    // 2. Update tsconfig.json path mappings
    addTsconfigPath(tsconfigPath, `@skalfa/skalfa-${ext}`);
    if (ext === "queue" || ext === "cache") {
      addTsconfigPath(tsconfigPath, "@skalfa/skalfa-redis");
    }

    // 3. Update utils/index.ts exports
    addUtilExport(utilsIndexPath, `@skalfa/skalfa-${ext}`);
    if (ext === "queue" || ext === "cache") {
      addUtilExport(utilsIndexPath, "@skalfa/skalfa-redis");
    }

    // 4. Uncomment initialization blocks and update imports in app/app.ts
    if (fs.existsSync(appTsPath)) {
      let content = fs.readFileSync(appTsPath, "utf8");
      const importsToAdd: string[] = [];

      if (ext === "redis" || ext === "queue" || ext === "cache") {
        importsToAdd.push("redis");
        // Uncomment Redis block
        content = content.replace(
          /\/\/ if \(process\.env\.REDIS_HOST[\s\S]*?\/\/ \}/g,
          (match) => match.replace(/^\/\/ ?/gm, "")
        );
      }
      if (ext === "da") {
        importsToAdd.push("daClient");
        // Uncomment DA block
        content = content.replace(
          /\/\/ if \(process\.env\.DA_HOST[\s\S]*?\/\/ }/g,
          (match) => match.replace(/^\/\/ ?/gm, "")
        );
      }

      // Update import statement at the top of app.ts
      if (importsToAdd.length > 0) {
        const importRegex = /import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*["']@utils["']/;
        const match = content.match(importRegex);
        if (match) {
          const currentImports = match[1].split(",").map(i => i.trim()).filter(Boolean);
          const finalImports = Array.from(new Set([...currentImports, ...importsToAdd]));
          const newImportLine = `import { ${finalImports.join(", ")} } from "@utils"`;
          content = content.replace(importRegex, newImportLine);
        }
      }

      fs.writeFileSync(appTsPath, content, "utf8");
    }

    // 5. Update package.json scripts for workers
    const packageJsonPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(packageJsonPath) && ["cron", "queue", "socket"].includes(ext)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      pkg.scripts = pkg.scripts || {};

      let scriptKey = "";
      let scriptVal = "";
      if (ext === "cron") {
        scriptKey = "start:cron";
        scriptVal = "bun run app/jobs/crons/worker.cron.ts";
      } else if (ext === "queue") {
        scriptKey = "start:queue";
        scriptVal = "bun run app/jobs/queues/worker.queue.ts";
      } else if (ext === "socket") {
        scriptKey = "start:socket";
        scriptVal = "bun run app/jobs/sockets/worker.socket.ts";
      }

      if (scriptKey) {
        pkg.scripts[scriptKey] = scriptVal;

        // Update dev concurrently command
        const devScript = pkg.scripts["dev"] || "";
        const runCmd = `bun ${scriptKey}`;

        if (devScript.includes("concurrently")) {
          if (!devScript.includes(runCmd)) {
            const cleanDev = devScript.trim();
            pkg.scripts["dev"] = `${cleanDev} "${runCmd}"`;
          }
        } else {
          pkg.scripts["dev"] = `concurrently --raw "bun run --watch app/app.ts" "bun skalfa watch:barrels" "${runCmd}"`;
        }
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
    }
  } finally {
    cleanup();
  }

  console.log(`✓ Extension "${ext}" successfully configured!`);
}

function addTsconfigPath(tsconfigPath: string, packageName: string): void {
  if (!fs.existsSync(tsconfigPath)) return;
  let content = fs.readFileSync(tsconfigPath, "utf8");
  if (!content.includes(packageName)) {
    content = content.replace(
      /("@utils\/\*"\s*:\s*\[\s*"utils\/\*",)/,
      `$1\n        "node_modules/${packageName}/dist/*",`
    );
    fs.writeFileSync(tsconfigPath, content, "utf8");
  }
}

function addUtilExport(utilsIndexPath: string, packageName: string): void {
  if (!fs.existsSync(utilsIndexPath)) return;
  let content = fs.readFileSync(utilsIndexPath, "utf8");
  if (!content.includes(packageName)) {
    content += `export * from "${packageName}";\n`;
    fs.writeFileSync(utilsIndexPath, content, "utf8");
  }
}

function cleanQueueWorkers(targetDir: string, hasDa: boolean, hasNotification: boolean): void {
  const queuesDir = path.join(targetDir, "app", "jobs", "queues");
  const workerQueuePath = path.join(queuesDir, "worker.queue.ts");
  if (!fs.existsSync(workerQueuePath)) return;

  let content = fs.readFileSync(workerQueuePath, "utf8");

  if (!hasDa) {
    const daFiles = [
      "access-log.queue.worker.ts",
      "activity-log.queue.worker.ts",
      "error-log.queue.worker.ts"
    ];
    for (const file of daFiles) {
      const p = path.join(queuesDir, file);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    content = content.replace(/import\s*\{\s*activityLogQueueWorker\s*\}\s*from\s*["']\.\/activity-log\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/import\s*\{\s*accessLogQueueWorker\s*\}\s*from\s*["']\.\/access-log\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/import\s*\{\s*errorLogQueueWorker\s*\}\s*from\s*["']\.\/error-log\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/activityLogQueueWorker\(\)\r?\n?/g, "");
    content = content.replace(/accessLogQueueWorker\(\)\r?\n?/g, "");
    content = content.replace(/errorLogQueueWorker\(\)\r?\n?/g, "");
  }

  if (!hasNotification) {
    const p = path.join(queuesDir, "notification.queue.worker.ts");
    if (fs.existsSync(p)) fs.unlinkSync(p);
    content = content.replace(/import\s*\{\s*notificationQueueWorker\s*\}\s*from\s*["']\.\/notification\.queue\.worker["'];?\r?\n?/g, "");
    content = content.replace(/notificationQueueWorker\(\)\r?\n?/g, "");
  }

  fs.writeFileSync(workerQueuePath, content, "utf8");
}