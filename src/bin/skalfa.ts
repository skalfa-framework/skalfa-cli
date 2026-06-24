#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { addExtension, extensionNames } from "../commands/add-extension";
import { createApi } from "../commands/create-api";
import { pickUtility, UTILITIES } from "../commands/pick";
import { findProjectRoot } from "../utils/fs";

// Dynamic routing / forwarding logic
const args = process.argv.slice(2);
const knownCommands = ["create-api", "add", "pick"];

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

const program = new Command();

program
  .name("skalfa")
  .description("Create Skalfa API projects and install optional extensions.")
  .version("0.1.0");

program
  .command("create-api")
  .description("Create a new Skalfa API project.")
  .argument("<name>", "project folder and package name")
  .action(async (name: string) => {
    await runCommand(() => createApi(name));
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