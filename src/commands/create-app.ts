import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import readline from "node:readline";
import { fetchLatestTarballUrl, downloadTarball, fetchLatestVersion } from "../utils/npm";
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

const TEMPLATE_ENV_KEY = "SKALFA_APP_TEMPLATE";

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

export interface CreateAppOptions {
  idb?: boolean;
  socket?: boolean;
  document?: boolean;
  pwa?: boolean;
  tauriDesktop?: boolean;
  tauriMobile?: boolean;
  authType?: "username" | "email";
}

export async function createApp(projectName: string, options?: CreateAppOptions): Promise<void> {
  const cwd = process.cwd();
  const target = path.resolve(cwd, projectName);
  const packageName = path.basename(target);

  assertInsideDirectory(cwd, target);

  if (exists(target)) {
    throw new Error(`Target directory already exists: ${target}`);
  }

  let hasIdb = options?.idb ?? false;
  let hasSocket = options?.socket ?? false;
  let hasDocument = options?.document ?? false;
  let hasPwa = options?.pwa ?? false;
  let hasTauriDesktop = options?.tauriDesktop ?? false;
  let hasTauriMobile = options?.tauriMobile ?? false;
  let authType: "username" | "email" = options?.authType ?? "username";

  if (!options) {
    // Ask interactive questions sequentially
    const q = new Questioner();
    try {
      const authChoice = (await q.ask("Choose authentication type (username/email) [default: username]: ", "username")).toLowerCase();
      authType = authChoice === "email" ? "email" : "username";
      hasIdb = (await q.ask("Do you need IndexedDB (IDB)? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasSocket = (await q.ask("Do you need Socket Client? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasDocument = (await q.ask("Do you need Document Export/Viewer (PDF/Excel)? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasPwa = (await q.ask("Do you want to enable Progressive Web App (PWA)? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasTauriDesktop = (await q.ask("Do you want to enable Tauri Desktop support (Windows/macOS/Linux)? (y/N): ", "No")).toLowerCase().startsWith("y");
      hasTauriMobile = (await q.ask("Do you want to enable Tauri Mobile support (Android/iOS)? (y/N): ", "No")).toLowerCase().startsWith("y");
    } finally {
      q.close();
    }
  }

  const spinner = new Spinner("Preparing project...");
  spinner.start();

  try {
    const envTemplateSource = process.env[TEMPLATE_ENV_KEY];
    const isDev = !!envTemplateSource;

    if (envTemplateSource) {
      // Local copy mode
      const templateSource = path.resolve(envTemplateSource);
      spinner.update(`Copying template from ${templateSource}...`);
      if (!exists(templateSource)) {
        throw new Error(`Template source override not found: ${templateSource}`);
      }
      copyTemplate(templateSource, target);
    } else {
      // Dynamic download from npm registry
      const templatePackageName = "@skalfa/skalfa-app";
      spinner.update(`Fetching latest template info for ${templatePackageName}...`);
      const tarballUrl = await fetchLatestTarballUrl(templatePackageName);

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

      fs.renameSync(packageDir, target);
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }

    spinner.update("Customizing project files...");
    // Cleanup git and github directories
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
    const readmeContent = `# [Project Name] - Frontend Application

## Overview
- **Description:** [Provide a short description of this project]
- **What it does:** [Briefly explain what this project does]
- **Why it exists:** [Explain why this project was created]
- **Main Goals:** [List the main goals of this application]
- **Target Users:** [Specify the target users of this application]

## Skalfa Stack
This frontend application is built on top of **@skalfa/skalfa-app** with the following configured utilities:
- **Core:** \\\`@skalfa/skalfa-app-core\\\`
- **IndexedDB Storage:** \`${hasIdb ? "Enabled (@skalfa/skalfa-idb)" : "Disabled"}\`
- **Socket Client:** \`${hasSocket ? "Enabled (@skalfa/skalfa-socket-client)" : "Disabled"}\`
- **Document Export:** \`${hasDocument ? "Enabled (@skalfa/skalfa-document)" : "Disabled"}\`
- **PWA Support:** \`${hasPwa ? "Enabled (@ducanh2912/next-pwa)" : "Disabled"}\`
- **Tauri Support:** \`${hasTauriDesktop || hasTauriMobile ? `Enabled (@tauri-apps/api) - ${[hasTauriDesktop ? "Desktop" : "", hasTauriMobile ? "Mobile" : ""].filter(Boolean).join("/")}` : "Disabled"}\`

## Features & Status
Here is the list of features and their development status:

| Feature | Description | Status |
| :--- | :--- | :---: |
| **Login** | Login pages | \\\`[x] Completed\\\` |

## Development Setup

### Prerequisites
Make sure you have [Bun](https://bun.sh) or [Node.js](https://nodejs.org) installed.

### Commands
| Task | Bun | npm |
| :--- | :--- | :--- |
| **Install Dependencies** | \\\`bun install\\\` | \\\`npm install\\\` |
| **Start Dev Server** | \\\`bun run dev\\\` | \\\`npm run dev\\\` |
| **Build Production** | \\\`bun run build\\\` | \\\`npm run build\\\` |
| **Start Production** | \\\`bun run start\\\` | \\\`npm run start\\\` |

## Agent Instructions
If you are an AI coding agent assisting with this project, please make sure to read the workspace instructions and guidelines located in the [App Agent Rules](file:///.agents/AGENTS.md) or the root monorepo [Agent Rules](file:///../.agents/AGENTS.md) folder before making modifications.
`;
    fs.writeFileSync(readmePath, readmeContent, "utf8");

    // Rename .npmignore to .gitignore if it exists
    const npmignorePath = path.join(target, ".npmignore");
    const gitignorePath = path.join(target, ".gitignore");
    if (fs.existsSync(npmignorePath) && !fs.existsSync(gitignorePath)) {
      fs.renameSync(npmignorePath, gitignorePath);
    }

    // Ensure .gitignore has content (fallback if npm excluded it)
    if (!fs.existsSync(gitignorePath) || fs.readFileSync(gitignorePath, "utf8").trim() === "") {
      const defaultGitignore = `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/test
/coverage

# production
/.next
/build
/out
*.tsbuildinfo
next-env.d.ts

# bundle
**/*.trace
**/*.zip
**/*.tar.gz
**/*.tgz
**/*.log
**/*.bun
*.pem
.DS_Store

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env
.env
.env.local
.env.dev
.env.production

# vercel
.vercel

# ide
.vscode

# public
public/pdf.worker.*

# compiled output (accidentally generated by tsc without --noEmit)
contexts/*.js
contexts/*.d.ts
utils/*.js
utils/*.d.ts
app/*.js
app/*.d.ts
`;
      fs.writeFileSync(gitignorePath, defaultGitignore, "utf8");
    }

    let versions: CustomizationOptions["versions"] = undefined;
    if (!isDev) {
      spinner.update("Fetching latest package versions...");
      try {
        const [appCore, component, idb, document, icon] = await Promise.all([
          fetchLatestVersion("@skalfa/skalfa-app-core").catch(() => "1.0.12"),
          fetchLatestVersion("@skalfa/skalfa-component").catch(() => "1.0.6"),
          fetchLatestVersion("@skalfa/skalfa-idb").catch(() => "1.0.0"),
          fetchLatestVersion("@skalfa/skalfa-document").catch(() => "1.0.0"),
          fetchLatestVersion("@skalfa/skalfa-icon").catch(() => "1.0.0"),
        ]);
        versions = {
          appCore: `^${appCore}`,
          component: `^${component}`,
          idb: `^${idb}`,
          document: `^${document}`,
          icon: `^${icon}`,
        };
      } catch (err) {
        versions = {
          appCore: "^1.0.12",
          component: "^1.0.6",
          idb: "^1.0.0",
          document: "^1.0.0",
          icon: "^1.0.0",
        };
      }
    }

    // Customize project with selected options
    customizeProject(target, {
      idb: hasIdb,
      socket: hasSocket,
      document: hasDocument,
      pwa: hasPwa,
      tauriDesktop: hasTauriDesktop,
      tauriMobile: hasTauriMobile,
      authType: authType,
      versions
    });
    
    spinner.update("Installing dependencies (this may take a moment)...");
    await installDependenciesAsync(target);

    spinner.stop(true, "Skalfa App Next.js project is ready.");
    console.log(`\nNext steps:\n  cd ${projectName}\n  bun run dev`);
  } catch (error) {
    spinner.stop(false, `Failed to prepare project: ${(error as Error).message}`);
    throw error;
  }
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
  pwa: boolean;
  tauriDesktop: boolean;
  tauriMobile: boolean;
  authType: "username" | "email";
  versions?: {
    appCore: string;
    component: string;
    idb: string;
    document: string;
    icon: string;
  };
}

function customizeProject(target: string, opts: CustomizationOptions): void {
  const packageJsonPath = path.join(target, "package.json");
  const baseComponentsIndexPath = path.join(target, "components", "base.components", "index.ts");
  const isDev = !!process.env[TEMPLATE_ENV_KEY];
  const isMonorepo = path.basename(target) === "api" || path.basename(target) === "app";
  const devPathPrefix = isMonorepo ? "file:../../" : "file:../";

  // 1. Update dependencies and scripts in package.json
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    pkg.dependencies = pkg.dependencies || {};
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.scripts = pkg.scripts || {};

    const v = opts.versions;

    // Core dependency
    pkg.dependencies["@skalfa/skalfa-app-core"] = isDev ? `${devPathPrefix}skalfa-app-core` : (v?.appCore ?? "^1.0.12");
    if (pkg.dependencies["@skalfa/skalfa-component"]) {
      pkg.dependencies["@skalfa/skalfa-component"] = isDev ? `${devPathPrefix}skalfa-component` : (v?.component ?? "^1.0.6");
    }
    if (pkg.dependencies["@skalfa/skalfa-icon"]) {
      pkg.dependencies["@skalfa/skalfa-icon"] = isDev ? `${devPathPrefix}skalfa-icon` : (v?.icon ?? "^1.0.0");
    }

    // A. IndexedDB Option
    if (opts.idb) {
      pkg.dependencies["@skalfa/skalfa-idb"] = isDev ? `${devPathPrefix}skalfa-idb` : (v?.idb ?? "^1.0.0");
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
      pkg.dependencies["@skalfa/skalfa-socket-client"] = isDev ? `${devPathPrefix}skalfa-socket-client` : "^1.0.0";
      pkg.dependencies["socket.io-client"] = "^4.8.1";
    }

    // C. Document Option
    if (opts.document) {
      pkg.dependencies["@skalfa/skalfa-document"] = isDev ? `${devPathPrefix}skalfa-document` : (v?.document ?? "^1.0.0");
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

    // D. PWA Option
    if (opts.pwa) {
      pkg.dependencies["@ducanh2912/next-pwa"] = "^10.2.9";
      
      // Wrap next.config.ts with withPWA
      const nextConfigPath = path.join(target, "next.config.ts");
      if (fs.existsSync(nextConfigPath)) {
        let content = fs.readFileSync(nextConfigPath, "utf8");
        if (!content.includes("@ducanh2912/next-pwa")) {
          content = `import withPWAInit from "@ducanh2912/next-pwa";\n` + content;
          content = content.replace(
            /export default nextConfig;/,
            `const withPWA = withPWAInit({\n  dest: "public",\n  disable: process.env.NODE_ENV === "development",\n});\n\nexport default withPWA(nextConfig);`
          );
          fs.writeFileSync(nextConfigPath, content, "utf8");
        }
      }
    } else {
      // Delete manifest.ts
      const manifestPath = path.join(target, "app", "manifest.ts");
      if (fs.existsSync(manifestPath)) {
        fs.unlinkSync(manifestPath);
      }
    }

    // E. Tauri Option
    if (opts.tauriDesktop || opts.tauriMobile) {
      pkg.dependencies["@tauri-apps/api"] = "^2.0.0";
      pkg.devDependencies["@tauri-apps/cli"] = "^2.0.0";
      pkg.devDependencies["cross-env"] = "^7.0.3";

      pkg.scripts["tauri"] = "cross-env IS_TAURI=true tauri";
      if (opts.tauriMobile) {
        pkg.scripts["tauri:android"] = "cross-env IS_TAURI=true tauri android";
        pkg.scripts["tauri:ios"] = "cross-env IS_TAURI=true tauri ios";
      }
    } else {
      // Delete src-tauri folder
      const tauriDir = path.join(target, "src-tauri");
      if (fs.existsSync(tauriDir)) {
        fs.rmSync(tauriDir, { recursive: true, force: true });
      }
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), "utf8");
  }

  // 5. Clean up tsconfig.json and next.config.ts for production templates (non-monorepo dev)
  const tsconfigTemplatePath = path.join(target, "tsconfig.template.json");
  const nextConfigTemplatePath = path.join(target, "next.config.template.ts");

  if (!isDev) {
    if (fs.existsSync(tsconfigTemplatePath)) {
      fs.renameSync(tsconfigTemplatePath, path.join(target, "tsconfig.json"));
    }
    if (fs.existsSync(nextConfigTemplatePath)) {
      fs.renameSync(nextConfigTemplatePath, path.join(target, "next.config.ts"));
    }
  } else {
    if (fs.existsSync(tsconfigTemplatePath)) {
      fs.unlinkSync(tsconfigTemplatePath);
    }
    if (fs.existsSync(nextConfigTemplatePath)) {
      fs.unlinkSync(nextConfigTemplatePath);
    }
  }

  // 6. Handle authentication type customization
  if (opts.authType === "email") {
    const stubsDir = path.join(__dirname, "..", "stubs", "auth-email");
    const pagesStubDir = path.join(stubsDir, "page");

    if (fs.existsSync(pagesStubDir)) {
      // A. Overwrite app/auth/login/page.tsx
      const loginStubPath = path.join(pagesStubDir, "login", "page.stub");
      if (fs.existsSync(loginStubPath)) {
        const loginPageDir = path.join(target, "app", "auth", "login");
        fs.mkdirSync(loginPageDir, { recursive: true });
        fs.writeFileSync(
          path.join(loginPageDir, "page.tsx"),
          fs.readFileSync(loginStubPath, "utf8"),
          "utf8"
        );
      }

      // B. Create app/auth/register/page.tsx
      const registerStubPath = path.join(pagesStubDir, "register", "page.stub");
      if (fs.existsSync(registerStubPath)) {
        const registerPageDir = path.join(target, "app", "auth", "register");
        fs.mkdirSync(registerPageDir, { recursive: true });
        fs.writeFileSync(
          path.join(registerPageDir, "page.tsx"),
          fs.readFileSync(registerStubPath, "utf8"),
          "utf8"
        );
      }

      // C. Create app/auth/verify/page.tsx
      const verifyStubPath = path.join(pagesStubDir, "verify", "page.stub");
      if (fs.existsSync(verifyStubPath)) {
        const verifyPageDir = path.join(target, "app", "auth", "verify");
        fs.mkdirSync(verifyPageDir, { recursive: true });
        fs.writeFileSync(
          path.join(verifyPageDir, "page.tsx"),
          fs.readFileSync(verifyStubPath, "utf8"),
          "utf8"
        );
      }

      // D. Overwrite app/dashboard/user/page.tsx
      const userStubPath = path.join(pagesStubDir, "user", "page.stub");
      if (fs.existsSync(userStubPath)) {
        const userPageDir = path.join(target, "app", "dashboard", "user");
        fs.mkdirSync(userPageDir, { recursive: true });
        fs.writeFileSync(
          path.join(userPageDir, "page.tsx"),
          fs.readFileSync(userStubPath, "utf8"),
          "utf8"
        );
      }
    }
  } else if (opts.authType === "username") {
    // If username auth, the default template is already set to username.
    // However, we clean up the register and verify folders in case they exist by default.
    const registerDir = path.join(target, "app", "auth", "register");
    if (fs.existsSync(registerDir)) {
      fs.rmSync(registerDir, { recursive: true, force: true });
    }
    const verifyDir = path.join(target, "app", "auth", "verify");
    if (fs.existsSync(verifyDir)) {
      fs.rmSync(verifyDir, { recursive: true, force: true });
    }
  }
}
