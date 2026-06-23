"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ignoredNames = void 0;
exports.copyTemplate = copyTemplate;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
exports.ignoredNames = new Set(["node_modules", ".git"]);
function copyTemplate(source, target) {
    copyRecursive(source, target);
}
function copyRecursive(source, target) {
    const stat = node_fs_1.default.lstatSync(source);
    if (stat.isDirectory()) {
        copyDirectory(source, target);
        return;
    }
    if (stat.isSymbolicLink()) {
        copySymbolicLink(source, target);
        return;
    }
    node_fs_1.default.copyFileSync(source, target);
}
function copyDirectory(source, target) {
    (0, fs_1.ensureDirectoryExists)(target);
    for (const entry of node_fs_1.default.readdirSync(source, { withFileTypes: true })) {
        if (exports.ignoredNames.has(entry.name)) {
            continue;
        }
        const sourcePath = node_path_1.default.join(source, entry.name);
        const targetPath = node_path_1.default.join(target, entry.name);
        copyRecursive(sourcePath, targetPath);
    }
}
function copySymbolicLink(source, target) {
    const linkTarget = node_fs_1.default.readlinkSync(source);
    node_fs_1.default.symlinkSync(linkTarget, target);
}
