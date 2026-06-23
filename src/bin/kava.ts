#!/usr/bin/env node

import { Command } from "commander";
import { addExtension, extensionNames } from "../commands/add-extension";
import { createApi } from "../commands/create-api";
import { pickUtility, UTILITIES } from "../commands/pick";

const program = new Command();

program
  .name("kava")
  .description("Create Kava API projects and install optional extensions.")
  .version("0.1.0");

program
  .command("create-api")
  .description("Create a new Kava API project.")
  .argument("<name>", "project folder and package name")
  .action(async (name: string) => {
    await runCommand(() => createApi(name));
  });

program
  .command("add")
  .description("Install an optional Kava extension into the current project.")
  .argument("<extension>", `extension name: ${extensionNames.join(", ")}`)
  .action(async (extension: string) => {
    await runCommand(() => addExtension(extension));
  });

program
  .command("pick")
  .description("Eject/copy a core utility from @kava/kava-api-core into your local utils folder for customization.")
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