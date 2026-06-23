"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UTILITIES = exports.UTILITY_EXPORTS = void 0;
exports.pickUtility = pickUtility;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("../utils/fs");
exports.UTILITY_EXPORTS = {
    auth: ["auth"],
    context: ["context", "AppContext"],
    controller: ["controller", "ControllerContext", "ControllerSchema", "controllerSchema"],
    conversion: ["conversion"],
    db: ["db", "useDB", "closeAllDB"],
    logger: ["logger"],
    mail: ["sendMail", "renderMailTemplate", "SendMailOptions"],
    middleware: ["middleware"],
    model: ["Model", "softDelete", "foreignIdFor"],
    permission: ["permission", "KeyPermission"],
    route: ["route", "api"],
    storage: ["storage"],
    validation: ["validate", "ValidationRules", "ValidationRule"],
};
exports.UTILITIES = Object.keys(exports.UTILITY_EXPORTS);
function pickUtility(utilityName) {
    const utilitySymbols = exports.UTILITY_EXPORTS[utilityName];
    if (!utilitySymbols) {
        throw new Error(`Unknown utility "${utilityName}". Available utilities: ${exports.UTILITIES.join(", ")}`);
    }
    const projectRoot = (0, fs_1.findProjectRoot)(process.cwd());
    if (!projectRoot) {
        throw new Error("No package.json found. Run this command inside a Kava API project.");
    }
    const utilsDir = node_path_1.default.join(projectRoot, "utils");
    const indexPath = node_path_1.default.join(utilsDir, "index.ts");
    if (!(0, fs_1.exists)(utilsDir) || !(0, fs_1.exists)(indexPath)) {
        throw new Error("Folder utils or utils/index.ts not found. Make sure you are at the project root.");
    }
    // 1. Tentukan path source dari node_modules dan target di lokal proyek
    const corePackagePath = node_path_1.default.join(projectRoot, "node_modules", "@kava", "kava-api-core");
    const sourceFile = node_path_1.default.join(corePackagePath, "src", `${utilityName}.util.ts`);
    const targetFile = node_path_1.default.join(utilsDir, `${utilityName}.util.ts`);
    if (!(0, fs_1.exists)(sourceFile)) {
        throw new Error(`Source file for "${utilityName}" not found at ${sourceFile}. Make sure @kava/kava-api-core is installed.`);
    }
    if ((0, fs_1.exists)(targetFile)) {
        throw new Error(`Utility "${utilityName}.util.ts" is already present in your local utils folder.`);
    }
    // 2. Salin file dari node_modules ke lokal proyek
    console.log(`Copying ${utilityName}.util.ts from @kava/kava-api-core to utils/ ...`);
    node_fs_1.default.copyFileSync(sourceFile, targetFile);
    console.log(`✓ Copied ${utilityName}.util.ts`);
    // 3. Perbarui utils/index.ts untuk mereferensikan file lokal
    console.log("Updating utils/index.ts with explicit local export override ...");
    let indexContent = node_fs_1.default.readFileSync(indexPath, "utf8").trim();
    const localExportLine = `export { ${utilitySymbols.join(", ")} } from "./${utilityName}.util";`;
    if (!indexContent.includes(`./${utilityName}.util`)) {
        indexContent += `\n${localExportLine}\n`;
        node_fs_1.default.writeFileSync(indexPath, indexContent, "utf8");
        console.log("✓ Updated utils/index.ts with override.");
    }
    else {
        console.log("⚠️ Info: Local export for this utility already exists in utils/index.ts");
    }
    console.log(`\nSuccess! You can now customize: utils/${utilityName}.util.ts`);
}
