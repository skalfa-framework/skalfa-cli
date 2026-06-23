"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exists = exists;
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.readJsonFile = readJsonFile;
exports.writeJsonFile = writeJsonFile;
exports.removeDirectory = removeDirectory;
exports.assertInsideDirectory = assertInsideDirectory;
exports.findProjectRoot = findProjectRoot;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
function exists(targetPath) {
    return node_fs_1.default.existsSync(targetPath);
}
function ensureDirectoryExists(targetPath) {
    node_fs_1.default.mkdirSync(targetPath, { recursive: true });
}
function readJsonFile(targetPath) {
    return JSON.parse(node_fs_1.default.readFileSync(targetPath, "utf8"));
}
function writeJsonFile(targetPath, value) {
    node_fs_1.default.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function removeDirectory(targetPath) {
    if (!exists(targetPath)) {
        return;
    }
    node_fs_1.default.rmSync(targetPath, { recursive: true, force: true });
}
function assertInsideDirectory(parent, child) {
    const resolvedParent = node_path_1.default.resolve(parent);
    const resolvedChild = node_path_1.default.resolve(child);
    const relativePath = node_path_1.default.relative(resolvedParent, resolvedChild);
    if (relativePath.startsWith("..") || node_path_1.default.isAbsolute(relativePath)) {
        throw new Error(`Path is outside expected directory: ${child}`);
    }
}
function findProjectRoot(startPath) {
    let currentPath = node_path_1.default.resolve(startPath);
    while (true) {
        if (exists(node_path_1.default.join(currentPath, "package.json"))) {
            return currentPath;
        }
        const parentPath = node_path_1.default.dirname(currentPath);
        if (parentPath === currentPath) {
            return null;
        }
        currentPath = parentPath;
    }
}
