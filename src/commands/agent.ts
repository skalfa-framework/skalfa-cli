import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export async function installAgent(overrideType?: string): Promise<void> {
  let type = overrideType;

  // 1. Auto-detect project type if not overridden
  if (!type) {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(pkgPath)) {
      throw new Error("package.json not found. Please run this command in your project root.");
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      const isApi = !!(deps["elysia"] || deps["knex"] || deps["@skalfa/skalfa-api-core"]);
      const isApp = !!(deps["react"] || deps["next"] || deps["vite"] || deps["skalfa-app-core"]);

      if (isApi) {
        type = "api";
      } else if (isApp) {
        type = "app";
      } else {
        throw new Error("Could not auto-detect project type. Please specify using --type api or --type app.");
      }
    } catch (e: any) {
      throw new Error(`Failed to auto-detect project type: ${e.message}`);
    }
  }

  if (type !== "api" && type !== "app") {
    throw new Error("Invalid agent type. Must be 'api' or 'app'.");
  }

  const targetDir = path.join(process.cwd(), ".agents");
  if (fs.existsSync(targetDir)) {
    throw new Error(".agents folder already exists. Run 'skalfa agent:update' to pull the latest changes.");
  }

  const repoUrl = `https://github.com/skalfa-framework/agent-${type}.git`;
  console.log(`Cloning agent-${type} from ${repoUrl}...`);

  try {
    // Clone repo directly into .agents/
    execSync(`git clone ${repoUrl} "${targetDir}"`, { stdio: "inherit" });
  } catch (e: any) {
    throw new Error(`Failed to clone agent repository: ${e.message}`);
  }

  // 2. Copy template files to records/
  const templatesDir = path.join(targetDir, "templates");
  const recordsDir = path.join(targetDir, "records");

  if (fs.existsSync(templatesDir)) {
    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }

    const files = fs.readdirSync(templatesDir);
    for (const file of files) {
      const srcFile = path.join(templatesDir, file);
      const destFile = path.join(recordsDir, file);

      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Created initial record: ${file}`);
      }
    }
  }

  // 3. Add /.agents/ to project's .gitignore
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  let gitignoreContent = "";
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
  }

  if (!gitignoreContent.includes("/.agents/")) {
    const separator = gitignoreContent.endsWith("\n") || gitignoreContent === "" ? "" : "\n";
    fs.appendFileSync(gitignorePath, `${separator}/.agents/\n`);
    console.log("Added /.agents/ to .gitignore");
  }

  console.log(`\nSuccessfully installed agent-${type}!`);
}

export async function updateAgent(): Promise<void> {
  const targetDir = path.join(process.cwd(), ".agents");
  if (!fs.existsSync(targetDir)) {
    throw new Error("No agent installed in this project. Run 'skalfa agent:install' first.");
  }

  const gitDir = path.join(targetDir, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error(".agents folder is not a Git repository.");
  }

  console.log("Updating agent to the latest version...");
  try {
    execSync("git pull", { cwd: targetDir, stdio: "inherit" });
    console.log("Agent updated successfully!");
  } catch (e: any) {
    throw new Error(`Failed to update agent: ${e.message}`);
  }
}
