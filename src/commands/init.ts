import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";
import { createApi } from "./create-api";
import { createApp } from "./create-app";
import { installAgent } from "./agent";
import { exists, assertInsideDirectory } from "../utils/fs";

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

export async function initProject(projectName: string): Promise<void> {
  const cwd = process.cwd();
  const target = path.resolve(cwd, projectName);

  assertInsideDirectory(cwd, target);

  if (exists(target)) {
    throw new Error(`Target directory already exists: ${target}`);
  }

  // Ask interactive questions sequentially
  const q = new Questioner();
  
  // API Options
  let apiRedis = false;
  let apiQueue = false;
  let apiCache = false;
  let apiCron = false;
  let apiDa = false;
  let apiSocket = false;

  // APP Options
  let appIdb = false;
  let appSocket = false;
  let appDocument = false;
  let appPwa = false;
  let appTauriDesktop = false;
  let appTauriMobile = false;

  try {
    console.log("\n--- Configure API (Backend) ---");
    apiRedis = (await q.ask("Do you need Redis? (y/N): ", "No")).toLowerCase().startsWith("y");
    apiQueue = (await q.ask("Do you need Queue? (y/N): ", "No")).toLowerCase().startsWith("y");
    apiCache = (await q.ask("Do you need Cache? (y/N): ", "No")).toLowerCase().startsWith("y");
    apiCron = (await q.ask("Do you need Cron? (y/N): ", "No")).toLowerCase().startsWith("y");
    apiDa = (await q.ask("Do you need Data Analytics? (y/N): ", "No")).toLowerCase().startsWith("y");
    apiSocket = (await q.ask("Do you need Socket? (y/N): ", "No")).toLowerCase().startsWith("y");

    console.log("\n--- Configure App (Frontend) ---");
    appIdb = (await q.ask("Do you need IndexedDB (IDB)? (y/N): ", "No")).toLowerCase().startsWith("y");
    appSocket = (await q.ask("Do you need Socket Client? (y/N): ", "No")).toLowerCase().startsWith("y");
    appDocument = (await q.ask("Do you need Document Export/Viewer (PDF/Excel)? (y/N): ", "No")).toLowerCase().startsWith("y");
    appPwa = (await q.ask("Do you want to enable Progressive Web App (PWA)? (y/N): ", "No")).toLowerCase().startsWith("y");
    appTauriDesktop = (await q.ask("Do you want to enable Tauri Desktop support (Windows/macOS/Linux)? (y/N): ", "No")).toLowerCase().startsWith("y");
    appTauriMobile = (await q.ask("Do you want to enable Tauri Mobile support (Android/iOS)? (y/N): ", "No")).toLowerCase().startsWith("y");
  } finally {
    q.close();
  }

  console.log(`\nInitializing Skalfa project in ${target}...`);
  fs.mkdirSync(target, { recursive: true });

  const apiDir = path.join(target, "api");
  const appDir = path.join(target, "app");

  console.log("\nCreating API...");
  await createApi(apiDir, {
    redis: apiRedis,
    queue: apiQueue,
    cache: apiCache,
    cron: apiCron,
    da: apiDa,
    socket: apiSocket,
  });

  console.log("\nCreating App...");
  await createApp(appDir, {
    idb: appIdb,
    socket: appSocket,
    document: appDocument,
    pwa: appPwa,
    tauriDesktop: appTauriDesktop,
    tauriMobile: appTauriMobile,
  });

  console.log("\nInstalling AI Agents...");
  try {
    await installAgent("api", apiDir);
  } catch (err: any) {
    console.error(`Failed to install API agent: ${err.message}`);
  }

  try {
    await installAgent("app", appDir);
  } catch (err: any) {
    console.error(`Failed to install App agent: ${err.message}`);
  }

  console.log("\nConfiguring root files...");
  
  // 1. Root package.json
  const rootPackageJson = {
    name: projectName,
    private: true,
    workspaces: [
      "api",
      "app"
    ]
  };
  fs.writeFileSync(
    path.join(target, "package.json"),
    JSON.stringify(rootPackageJson, null, 2),
    "utf8"
  );

  // 2. Root .gitignore
  const rootGitignore = `node_modules/
.agents/
`;
  fs.writeFileSync(path.join(target, ".gitignore"), rootGitignore, "utf8");

  // 3. Root README.md
  const rootReadme = `# ${projectName}

This is a Skalfa monorepo project containing both the backend (API) and the frontend (App).

## Structure
- \`api/\` - Backend service (Elysia, Knex, etc.)
- \`app/\` - Frontend application (Next.js)

## Getting Started

To install dependencies for both projects:
\`\`\`bash
bun install
\`\`\`

To run the development servers:
- **API**: \`cd api && bun run dev\`
- **App**: \`cd app && bun run dev\`
`;
  fs.writeFileSync(path.join(target, "README.md"), rootReadme, "utf8");

  // 4. Root .agents folder
  const agentsDir = path.join(target, ".agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  // 5. Root .agents/skills.json
  const skillsJson = {
    entries: [
      { path: "../api/.agents" },
      { path: "../app/.agents" }
    ]
  };
  fs.writeFileSync(
    path.join(agentsDir, "skills.json"),
    JSON.stringify(skillsJson, null, 2),
    "utf8"
  );

  // 6. Root .agents/AGENTS.md
  const agentsMd = `# Monorepo Rules

This is a combined Skalfa project containing both the backend (\`api\`) and frontend (\`app\`).

## Project Structure
- **Backend (API)**: Located in the [api](file:///api) directory.
- **Frontend (APP)**: Located in the [app](file:///app) directory.

## Instructions
1. When working on backend features, APIs, database migrations, or models, make changes inside the [api](file:///api) directory. Refer to [api/.agents](file:///api/.agents) for backend-specific guidelines.
2. When working on frontend features, pages, components, or state management, make changes inside the [app](file:///app) directory. Refer to [app/.agents](file:///app/.agents) for frontend-specific guidelines.
3. Always ensure that API contracts and communication between the frontend and backend are aligned.
`;
  fs.writeFileSync(path.join(agentsDir, "AGENTS.md"), agentsMd, "utf8");

  console.log(`\nSuccessfully initialized ${projectName}!`);
  console.log(`\nNext steps:\n  cd ${projectName}\n  bun install\n  bun run --cwd api dev (or cd api && bun run dev)\n  bun run --cwd app dev (or cd app && bun run dev)`);
}
