"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensionNames = exports.extensions = void 0;
exports.addExtension = addExtension;
const fs_1 = require("../utils/fs");
const installer_1 = require("../utils/installer");
exports.extensions = {
    mail: "@kava/mail",
    redis: "@kava/redis",
    notification: "@kava/notification"
};
exports.extensionNames = Object.keys(exports.extensions);
function addExtension(extensionName) {
    const packageName = exports.extensions[extensionName];
    if (!packageName) {
        throw new Error(`Unknown extension "${extensionName}". Available extensions: ${exports.extensionNames.join(", ")}`);
    }
    const projectRoot = (0, fs_1.findProjectRoot)(process.cwd());
    if (!projectRoot) {
        throw new Error("No package.json found. Run this command inside a Kava API project.");
    }
    console.log(`Installing Kava extension: ${extensionName}`);
    (0, installer_1.installPackage)(projectRoot, packageName);
    console.log(`Installed ${packageName}`);
}
