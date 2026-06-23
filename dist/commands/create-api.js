"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApi = createApi;
exports.renamePackage = renamePackage;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_child_process_1 = require("node:child_process");
const npm_1 = require("../utils/npm");
const installer_1 = require("../utils/installer");
const fs_1 = require("../utils/fs");
const copier_1 = require("../utils/copier");
const TEMPLATE_ENV_KEY = "KAVA_API_TEMPLATE";
async function createApi(projectName) {
    const cwd = process.cwd();
    const target = node_path_1.default.resolve(cwd, projectName);
    const packageName = node_path_1.default.basename(target);
    (0, fs_1.assertInsideDirectory)(cwd, target);
    if ((0, fs_1.exists)(target)) {
        throw new Error(`Target directory already exists: ${target}`);
    }
    const envTemplateSource = process.env[TEMPLATE_ENV_KEY];
    if (envTemplateSource) {
        // Local copy mode (e.g. for development / override)
        const templateSource = node_path_1.default.resolve(envTemplateSource);
        console.log(`Creating Kava API project from local template override: ${templateSource}`);
        if (!(0, fs_1.exists)(templateSource)) {
            throw new Error(`Template source override not found: ${templateSource}`);
        }
        (0, copier_1.copyTemplate)(templateSource, target);
    }
    else {
        // Dynamic download from npm registry
        const templatePackageName = "@kava/kava-api";
        console.log(`Fetching latest template info for ${templatePackageName} from npm registry...`);
        const tarballUrl = await (0, npm_1.fetchLatestTarballUrl)(templatePackageName);
        // Create a temporary extraction directory inside parent folder of target
        const parentDir = node_path_1.default.dirname(target);
        const tempExtractDir = node_path_1.default.join(parentDir, `${projectName}-temp-extract`);
        if ((0, fs_1.exists)(tempExtractDir)) {
            node_fs_1.default.rmSync(tempExtractDir, { recursive: true, force: true });
        }
        node_fs_1.default.mkdirSync(tempExtractDir, { recursive: true });
        const tarballPath = node_path_1.default.join(tempExtractDir, "template.tgz");
        console.log("Downloading template tarball...");
        await (0, npm_1.downloadTarball)(tarballUrl, tarballPath);
        console.log("Extracting template...");
        try {
            (0, node_child_process_1.execSync)(`tar -xzf "${tarballPath}" -C "${tempExtractDir}"`, { stdio: "ignore" });
        }
        catch (err) {
            node_fs_1.default.rmSync(tempExtractDir, { recursive: true, force: true });
            throw new Error(`Failed to extract template tarball. Please ensure 'tar' command is available: ${err.message}`);
        }
        const packageDir = node_path_1.default.join(tempExtractDir, "package");
        if (!(0, fs_1.exists)(packageDir)) {
            node_fs_1.default.rmSync(tempExtractDir, { recursive: true, force: true });
            throw new Error("Invalid template structure: 'package' folder not found inside tarball.");
        }
        // Rename/move extracted folder to target path
        node_fs_1.default.renameSync(packageDir, target);
        // Cleanup temp extract folder
        node_fs_1.default.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    // Cleanup git directory if present and rename package
    (0, fs_1.removeDirectory)(node_path_1.default.join(target, ".git"));
    renamePackage(target, packageName);
    console.log("Installing dependencies...");
    (0, installer_1.installDependencies)(target);
    console.log("");
    console.log("✓ Kava API project is ready.");
    console.log(`Next steps:\n  cd ${projectName}\n  bun run dev`);
}
function renamePackage(target, packageName) {
    const packageJsonPath = node_path_1.default.join(target, "package.json");
    if (!(0, fs_1.exists)(packageJsonPath)) {
        console.warn("Skipped package rename: package.json was not found.");
        return;
    }
    const packageJson = (0, fs_1.readJsonFile)(packageJsonPath);
    packageJson.name = packageName;
    (0, fs_1.writeJsonFile)(packageJsonPath, packageJson);
}
