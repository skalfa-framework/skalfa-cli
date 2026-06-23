import fs from "node:fs";
import path from "node:path";
import { findProjectRoot, exists } from "../utils/fs";

export const UTILITY_EXPORTS: Record<string, string[]> = {
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

export const UTILITIES = Object.keys(UTILITY_EXPORTS);

export function pickUtility(utilityName: string): void {
  const utilitySymbols = UTILITY_EXPORTS[utilityName];
  if (!utilitySymbols) {
    throw new Error(
      `Unknown utility "${utilityName}". Available utilities: ${UTILITIES.join(", ")}`
    );
  }

  const projectRoot = findProjectRoot(process.cwd());

  if (!projectRoot) {
    throw new Error("No package.json found. Run this command inside a Kava API project.");
  }

  const utilsDir = path.join(projectRoot, "utils");
  const indexPath = path.join(utilsDir, "index.ts");

  if (!exists(utilsDir) || !exists(indexPath)) {
    throw new Error("Folder utils or utils/index.ts not found. Make sure you are at the project root.");
  }

  // 1. Tentukan path source dari node_modules dan target di lokal proyek
  const corePackagePath = path.join(projectRoot, "node_modules", "@kava", "kava-api-core");
  const sourceFile = path.join(corePackagePath, "src", `${utilityName}.util.ts`);
  const targetFile = path.join(utilsDir, `${utilityName}.util.ts`);

  if (!exists(sourceFile)) {
    throw new Error(`Source file for "${utilityName}" not found at ${sourceFile}. Make sure @kava/kava-api-core is installed.`);
  }

  if (exists(targetFile)) {
    throw new Error(`Utility "${utilityName}.util.ts" is already present in your local utils folder.`);
  }

  // 2. Salin file dari node_modules ke lokal proyek
  console.log(`Copying ${utilityName}.util.ts from @kava/kava-api-core to utils/ ...`);
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`✓ Copied ${utilityName}.util.ts`);

  // 3. Perbarui utils/index.ts untuk mereferensikan file lokal
  console.log("Updating utils/index.ts with explicit local export override ...");
  let indexContent = fs.readFileSync(indexPath, "utf8").trim();

  const localExportLine = `export { ${utilitySymbols.join(", ")} } from "./${utilityName}.util";`;

  if (!indexContent.includes(`./${utilityName}.util`)) {
    indexContent += `\n${localExportLine}\n`;
    fs.writeFileSync(indexPath, indexContent, "utf8");
    console.log("✓ Updated utils/index.ts with override.");
  } else {
    console.log("⚠️ Info: Local export for this utility already exists in utils/index.ts");
  }

  console.log(`\nSuccess! You can now customize: utils/${utilityName}.util.ts`);
}
