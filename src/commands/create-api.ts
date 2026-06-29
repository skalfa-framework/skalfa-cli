import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import readline from "node:readline";
import { fetchLatestTarballUrl, downloadTarball } from "../utils/npm";
import { installDependenciesAsync } from "../utils/installer";
import { Spinner } from "../utils/spinner";
import {
  assertInsideDirectory,
  exists,
  readJsonFile,
  removeDirectory,
  writeJsonFile
} from "../utils/fs";
import { copyTemplate } from "../utils/copier";

const TEMPLATE_ENV_KEY = "SKALFA_API_TEMPLATE";

class Questioner {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  ask(query: string, defaultValue = ""): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  close() {
    this.rl.close();
  }
}

export interface CreateApiOptions {
  redis?: boolean;
  queue?: boolean;
  cache?: boolean;
  cron?: boolean;
  da?: boolean;
  socket?: boolean;
}

export async function createApi(projectName: string, options?: CreateApiOptions): Promise<void> {
  const cwd = process.cwd();
  const target = path.resolve(cwd, projectName);
  const packageName = path.basename(target);

  assertInsideDirectory(cwd, target);

  if (exists(target)) {
    throw new Error(`Target directory already exists: ${target}`);
  }

  let hasRedis = options?.redis ?? false;
  let hasQueue = options?.queue ?? false;
  let hasCache = options?.cache ?? false;
  let hasCron = options?.cron ?? false;
  let hasDa = options?.da ?? false;
  let hasSocket = options?.socket ?? false;

  if (!options) {
    // Ask interactive questions sequentially using a single readline interface
    const q = new Questioner();
    try {
      hasRedis = (await q.ask("Do you need Redis? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasQueue = (await q.ask("Do you need Queue? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasCache = (await q.ask("Do you need Cache? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasCron = (await q.ask("Do you need Cron? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasDa = (await q.ask("Do you need Data Analytics? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasSocket = (await q.ask("Do you need Socket? (y/N): ", "No")).toLowerCase().startsWith("y");
    } finally {
      q.close();
    }
  }

  // Dependency relation: Queue or Cache requires Redis
  const finalRedis = hasRedis || hasQueue || hasCache;

  const spinner = new Spinner("Preparing project...");
  spinner.start();

  try {
    const envTemplateSource = process.env[TEMPLATE_ENV_KEY];

    if (envTemplateSource) {
      // Local copy mode (e.g. for development / override)
      const templateSource = path.resolve(envTemplateSource);
      spinner.update(`Copying template from ${templateSource}...`);
      if (!exists(templateSource)) {
        throw new Error(`Template source override not found: ${templateSource}`);
      }
      copyTemplate(templateSource, target);
    } else {
      // Dynamic download from npm registry
      const templatePackageName = "@skalfa/skalfa-api";
      spinner.update(`Fetching latest template info for ${templatePackageName}...`);
      const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

      // Create a temporary extraction directory inside parent folder of target
      const parentDir = path.dirname(target);
      const tempExtractDir = path.join(parentDir, `${packageName}-temp-extract`);
      if (exists(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempExtractDir, { recursive: true });

      const tarballPath = path.join(tempExtractDir, "template.tgz");
      spinner.update("Downloading template tarball...");
      await downloadTarball(tarballUrl, tarballPath);

      spinner.update("Extracting template...");
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

    spinner.update("Customizing project files...");
    // Cleanup git and github directories if present and rename package
    removeDirectory(path.join(target, ".git"));
    removeDirectory(path.join(target, ".github"));
    const filesToDelete = ["CONTRIBUTING.md", "LICENSE"];
    for (const file of filesToDelete) {
      const filePath = path.join(target, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    renamePackage(target, packageName);

    // Write template README.md file
    const readmePath = path.join(target, "README.md");
    const readmeContent = `# [Project Name] - Backend Service

## Overview
- **Description:** [Provide a short description of this project]
- **What it does:** [Briefly explain what this project does]
- **Why it exists:** [Explain why this project was created]
- **Main Goals:** [List the main goals of this service]
- **Target Users:** [Specify the target users/consumers of this service]

## Skalfa Stack
This backend service is built on top of **@skalfa/skalfa-api** with the following configured utilities:
- **Core:** \\\`@skalfa/skalfa-api-core\\\`
- **Database / ORM:** \\\`@skalfa/skalfa-orm\\\` (Knex)
- **Redis Connection:** \`${finalRedis ? "Enabled (@skalfa/skalfa-redis)" : "Disabled"}\`
- **Queue Worker:** \`${hasQueue ? "Enabled (@skalfa/skalfa-queue)" : "Disabled"}\`
- **Cache Manager:** \`${hasCache ? "Enabled (@skalfa/skalfa-cache)" : "Disabled"}\`
- **Cron Scheduler:** \`${hasCron ? "Enabled (@skalfa/skalfa-cron)" : "Disabled"}\`
- **Data Analytics:** \`${hasDa ? "Enabled (@skalfa/skalfa-da / ClickHouse)" : "Disabled"}\`
- **WebSocket Server:** \`${hasSocket ? "Enabled (@skalfa/skalfa-socket)" : "Disabled"}\`

## Features & Status
Here is the list of features and their development status:

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Login** | API Login | \\\`[x] Completed\\\` |

## Development Setup

### Prerequisites
Ensure you have [Bun](https://bun.sh) or [Node.js](https://nodejs.org) installed.

### Commands
| Task | Bun | npm |
| :--- | :--- | :--- |
| **Install Dependencies** | \\\`bun install\\\` | \\\`npm install\\\` |
| **Start Dev Server** | \\\`bun run dev\\\` | \\\`npm run dev\\\` |
| **Build Production** | \\\`bun run build\\\` | \\\`npm run build\\\` |
| **Start Production** | \\\`bun run start\\\` | \\\`npm run start\\\` |

## Agent Instructions
If you are an AI coding agent assisting with this project, please make sure to read the workspace instructions and guidelines located in the [API Agent Rules](file:///.agents/AGENTS.md) or the root monorepo [Agent Rules](file:///../.agents/AGENTS.md) folder before making modifications.
`;
    fs.writeFileSync(readmePath, readmeContent, "utf8");

    // Rename .npmignore to .gitignore if it exists (npm renames .gitignore to .npmignore during pack/publish)
    const npmignorePath = path.join(target, ".npmignore");
    const gitignorePath = path.join(target, ".gitignore");
    if (fs.existsSync(npmignorePath) && !fs.existsSync(gitignorePath)) {
      fs.renameSync(npmignorePath, gitignorePath);
    }

    // Customize project with selected options
    customizeProject(target, {
      redis: finalRedis,
      queue: hasQueue,
      cache: hasCache,
      cron: hasCron,
      da: hasDa,
      socket: hasSocket
    });
    
    spinner.update("Installing dependencies (this may take a moment)...");
    await installDependenciesAsync(target);

    spinner.stop(true, "Skalfa API project is ready.");
    console.log(`\nNext steps:\n  cd ${projectName}\n  bun run dev`);
  } catch (error) {
    spinner.stop(false, `Failed to prepare project: ${(error as Error).message}`);
    throw error;
  }
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

interface CustomizationOptions {
  redis: boolean;
  queue: boolean;
  cache: boolean;
  cron: boolean;
  da: boolean;
  socket: boolean;
}

function customizeProject(target: string, opts: CustomizationOptions): void {
  const packageJsonPath = path.join(target, "package.json");
  const tsconfigPath = path.join(target, "tsconfig.json");
  const utilsIndexPath = path.join(target, "utils", "index.ts");
  const appTsPath = path.join(target, "app", "app.ts");
  const isDev = !!process.env[TEMPLATE_ENV_KEY];

  // 1. Update dependencies and scripts in package.json
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    pkg.dependencies = pkg.dependencies || {};
    pkg.scripts = pkg.scripts || {};

    // Base ORM integration (always included)
    pkg.dependencies["@skalfa/skalfa-orm"] = isDev ? "file:../skalfa-orm" : "^1.0.0";
    if (isDev) {
      pkg.dependencies["@skalfa/skalfa-api-core"] = "file:../skalfa-api-core";
    }

    const devCommands = ["bun run --watch app/app.ts", "bun skalfa watch:barrels"];

    if (opts.redis) {
      pkg.dependencies["@skalfa/skalfa-redis"] = isDev ? "file:../skalfa-redis" : "^1.0.0";
      pkg.dependencies["ioredis"] = "^5.4.1";
    }
    if (opts.queue) {
      pkg.dependencies["@skalfa/skalfa-queue"] = isDev ? "file:../skalfa-queue" : "^1.0.0";
      pkg.scripts["start:queue"] = "bun run app/jobs/queues/worker.queue.ts";
      devCommands.push("bun start:queue");
    }
    if (opts.cache) {
      pkg.dependencies["@skalfa/skalfa-cache"] = isDev ? "file:../skalfa-cache" : "^1.0.0";
    }
    if (opts.cron) {
      pkg.dependencies["@skalfa/skalfa-cron"] = isDev ? "file:../skalfa-cron" : "^1.0.0";
      pkg.scripts["start:cron"] = "bun run app/jobs/crons/worker.cron.ts";
      devCommands.push("bun start:cron");
    }
    if (opts.da) {
      pkg.dependencies["@skalfa/skalfa-da"] = isDev ? "file:../skalfa-da" : "^1.0.0";
      pkg.dependencies["@clickhouse/client"] = "^1.6.0";
    }
    if (opts.socket) {
      pkg.dependencies["@skalfa/skalfa-socket"] = isDev ? "file:../skalfa-socket" : "^1.0.0";
      pkg.dependencies["socket.io"] = "^4.7.5";
      pkg.scripts["start:socket"] = "bun run app/jobs/sockets/worker.socket.ts";
      devCommands.push("bun start:socket");
    }

    // Update dev script with concurrently
    pkg.scripts["dev"] = `concurrently --raw ${devCommands.map(cmd => `\\"${cmd}\\"`).join(" ")}`;

    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
  }

  // 2. Add path mappings in tsconfig.json
  addTsconfigPath(tsconfigPath, "@skalfa/skalfa-orm");
  if (opts.redis) addTsconfigPath(tsconfigPath, "@skalfa/skalfa-redis");
  if (opts.queue) addTsconfigPath(tsconfigPath, "@skalfa/skalfa-queue");
  if (opts.cache) addTsconfigPath(tsconfigPath, "@skalfa/skalfa-cache");
  if (opts.cron) addTsconfigPath(tsconfigPath, "@skalfa/skalfa-cron");
  if (opts.da) addTsconfigPath(tsconfigPath, "@skalfa/skalfa-da");
  if (opts.socket) addTsconfigPath(tsconfigPath, "@skalfa/skalfa-socket");

  // 3. Write exports to utils/index.ts
  if (fs.existsSync(utilsIndexPath)) {
    let exports = `export * from "@skalfa/skalfa-api-core";\nexport * from "@skalfa/skalfa-orm";\n`;
    if (opts.redis) exports += `export * from "@skalfa/skalfa-redis";\n`;
    if (opts.queue) exports += `export * from "@skalfa/skalfa-queue";\n`;
    if (opts.cache) exports += `export * from "@skalfa/skalfa-cache";\n`;
    if (opts.cron) exports += `export * from "@skalfa/skalfa-cron";\n`;
    if (opts.da) exports += `export * from "@skalfa/skalfa-da";\n`;
    if (opts.socket) exports += `export * from "@skalfa/skalfa-socket";\n`;
    fs.writeFileSync(utilsIndexPath, exports, "utf8");
  }

  // 4. Clean up folders/files that are not wanted
  if (!opts.queue) {
    const queueDir = path.join(target, "app", "jobs", "queues");
    if (fs.existsSync(queueDir)) {
      fs.rmSync(queueDir, { recursive: true, force: true });
    }
  } else {
    cleanQueueWorkers(target, opts.da, false);
  }
  if (!opts.cron) {
    const cronDir = path.join(target, "app", "jobs", "crons");
    if (fs.existsSync(cronDir)) {
      fs.rmSync(cronDir, { recursive: true, force: true });
    }
  }
  if (!opts.socket) {
    const socketDir = path.join(target, "app", "jobs", "sockets");
    if (fs.existsSync(socketDir)) {
      fs.rmSync(socketDir, { recursive: true, force: true });
    }
  }
  if (!opts.da) {
    const daDir = path.join(target, "database", "da.migrations");
    if (fs.existsSync(daDir)) {
      fs.rmSync(daDir, { recursive: true, force: true });
    }
  }

  // Clean up parent jobs folder if completely empty
  const jobsDir = path.join(target, "app", "jobs");
  if (fs.existsSync(jobsDir)) {
    const files = fs.readdirSync(jobsDir);
    if (files.length === 0) {
      fs.rmSync(jobsDir, { recursive: true, force: true });
    }
  }

  // 5. Uncomment initialization blocks and update imports in app/app.ts
  if (fs.existsSync(appTsPath)) {
    let content = fs.readFileSync(appTsPath, "utf8");
    const importsToAdd: string[] = [];

    if (opts.redis) {
      importsToAdd.push("redis");
      // Uncomment Redis block
      content = content.replace(
        /\/\/ if \(process\.env\.REDIS_HOST[\s\S]*?\/\/ \}/g,
        (match) => match.replace(/^\/\/ ?/gm, "")
      );
    }
    if (opts.da) {
      importsToAdd.push("daClient");
      // Uncomment DA block
      content = content.replace(
        /\/\/ if \(process\.env\.DA_HOST[\s\S]*?\/\/ }/g,
        (match) => match.replace(/^\/\/ ?/gm, "")
      );
    }

    // Update import statement at the top of app.ts
    if (importsToAdd.length > 0) {
      const baseImports = ["controller", "db", "logger", "middleware", "storage", "registry"];
      const finalImports = [...baseImports, ...importsToAdd];
      const targetRegex = /import\s*\{\s*controller,\s*db,\s*logger,\s*middleware,\s*storage,\s*registry\s*\}\s*from\s*["']@utils["']/;
      const newImportLine = `import { ${finalImports.join(", ")} } from "@utils"`;
      content = content.replace(targetRegex, newImportLine);
    }

    fs.writeFileSync(appTsPath, content, "utf8");
  }
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