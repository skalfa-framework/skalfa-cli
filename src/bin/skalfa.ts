#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { addExtension, extensionNames } from "../commands/add-extension";
import { createApi } from "../commands/create-api";
import { createApp } from "../commands/create-app";
import { initProject } from "../commands/init";
import { pickUtility, UTILITIES } from "../commands/pick";
import { updateCli } from "../commands/update";
import { installAgent, updateAgent } from "../commands/agent";
import { findProjectRoot } from "../utils/fs";

// Dynamic routing / forwarding logic
const args = process.argv.slice(2);
const knownCommands = ["init", "create:api", "create:app", "add", "pick", "update", "agent:install", "agent:update"];

if (args.length > 0 && !knownCommands.includes(args[0]) && !["-h", "--help", "-v", "--version", "help"].includes(args[0])) {
  const projectRoot = findProjectRoot(process.cwd());
  if (projectRoot) {
    const localCliPath = path.join(projectRoot, "utils", "commands", "skalfa.ts");
    if (fs.existsSync(localCliPath)) {
      try {
        // Forward arguments directly to local skalfa.ts using Bun
        execSync(`bun run utils/commands/skalfa.ts ${args.join(" ")}`, { stdio: "inherit" });
        process.exit(0);
      } catch (err) {
        process.exit(1);
      }
    }
  }
}

const packageJsonPath = path.join(__dirname, "..", "..", "package.json");
let version = "1.0.0";
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  version = packageJson.version;
} catch (e) {
  // fallback if package.json is not found
}

const program = new Command();

const banner = `
############ WELCOME TO ###############
  _____ _____ _____ __    _____ _____ 
 |   __|  |  |  _  |  |  |   __|  _  |
 |__   |    -|     |  |__|   __|     |
 |_____|__|__|__|__|_____|__|  |__|__|

#######################################
`;

program
  .name("skalfa")
  .description("Start building with skalfa ecosystem.")
  .version(version)
  .addHelpText("before", banner);

program
  .command("init")
  .description("Initialize a new Skalfa monorepo project containing both API and App.")
  .argument("[name]", "project folder name")
  .action(async (name?: string) => {
    await runCommand(() => initProject(name));
  });

program
  .command("create:api")
  .description("Create a new Skalfa API project.")
  .argument("<name>", "project folder and package name")
  .action(async (name: string) => {
    await runCommand(() => createApi(name));
  });

program
  .command("create:app")
  .description("Create a new Skalfa App Next.js project.")
  .argument("<name>", "project folder and package name")
  .action(async (name: string) => {
    await runCommand(() => createApp(name));
  });

program
  .command("add")
  .description("Install an optional Skalfa extension into the current project.")
  .argument("<extension>", `extension name: ${extensionNames.join(", ")}`)
  .action(async (extension: string) => {
    await runCommand(() => addExtension(extension));
  });

program
  .command("pick")
  .description("Eject/copy a core utility from @skalfa/skalfa-api-core into your local utils folder for customization.")
  .argument("<utility>", `utility name: ${UTILITIES.join(", ")}`)
  .action(async (utility: string) => {
    await runCommand(() => pickUtility(utility));
  });

program
  .command("update")
  .description("Update skalfa-cli to the latest version.")
  .action(async () => {
    await runCommand(() => updateCli());
  });

program
  .command("agent:install")
  .description("Install the corresponding AI coding agent (agent-api or agent-app) into the current project.")
  .option("-t, --type <type>", "Override project type detection: api or app")
  .action(async (options: { type?: string }) => {
    await runCommand(() => installAgent(options.type));
  });

program
  .command("agent:update")
  .description("Update the installed AI coding agent to the latest version.")
  .action(async () => {
    await runCommand(() => updateAgent());
  });

program.parse(process.argv);

async function runCommand(command: () => Promise<void> | void): Promise<void> {
  try {
    await command();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}