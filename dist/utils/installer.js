"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installDependencies = installDependencies;
exports.installPackage = installPackage;
exports.runNpmInstall = runNpmInstall;
const node_child_process_1 = require("node:child_process");
function installDependencies(target) {
    runNpmInstall(target);
}
function installPackage(target, packageName) {
    runNpmInstall(target, [packageName]);
}
function runNpmInstall(target, packages = []) {
    const command = ["npm", "install", ...packages].join(" ");
    (0, node_child_process_1.execSync)(command, {
        cwd: target,
        stdio: "inherit"
    });
}
