#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const add_extension_1 = require("../commands/add-extension");
const create_api_1 = require("../commands/create-api");
const pick_1 = require("../commands/pick");
const program = new commander_1.Command();
program
    .name("aluna")
    .description("Create Aluna API projects and install optional extensions.")
    .version("0.1.0");
program
    .command("create-api")
    .description("Create a new API project from the local aluna-api template.")
    .argument("<name>", "project folder and package name")
    .action((name) => {
    runCommand(() => (0, create_api_1.createApi)(name));
});
program
    .command("add")
    .description("Install an optional Aluna extension into the current project.")
    .argument("<extension>", `extension name: ${add_extension_1.extensionNames.join(", ")}`)
    .action((extension) => {
    runCommand(() => (0, add_extension_1.addExtension)(extension));
});
program
    .command("pick")
    .description("Eject/copy a core utility from @aluna/aluna-api-core into your local utils folder for customization.")
    .argument("<utility>", `utility name: ${pick_1.UTILITIES.join(", ")}`)
    .action((utility) => {
    runCommand(() => (0, pick_1.pickUtility)(utility));
});
program.parse(process.argv);
function runCommand(command) {
    try {
        command();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
    }
}
