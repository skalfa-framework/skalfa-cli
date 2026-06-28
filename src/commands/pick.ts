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
    throw new Error("No package.json found. Run this command inside a Skalfa API project.");
  }

  const utilsDir = path.join(projectRoot, "utils");
  const indexPath = path.join(utilsDir, "index.ts");

  if (!exists(utilsDir) || !exists(indexPath)) {
    throw new Error("Folder utils or utils/index.ts not found. Make sure you are at the project root.");
  }

  // 1. Tentukan path source dari node_modules dan target di lokal proyek
  const corePackagePath = path.join(projectRoot, "node_modules", "@skalfa", "skalfa-api-core");
  const sourceDir = path.join(corePackagePath, "src", utilityName);
  const targetDir = path.join(utilsDir, utilityName);

  if (!exists(sourceDir)) {
    throw new Error(`Source folder for "${utilityName}" not found at ${sourceDir}. Make sure @skalfa/skalfa-api-core is installed.`);
  }

  if (exists(targetDir)) {
    throw new Error(`Utility folder "${utilityName}" is already present in your local utils folder.`);
  }

  // 2. Salin folder dari node_modules ke lokal proyek secara rekursif
  console.log(`Copying ${utilityName} folder from @skalfa/skalfa-api-core to utils/ ...`);
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  const filesToDelete = ["CONTRIBUTING.md", "LICENSE"];
  for (const file of filesToDelete) {
    const filePath = path.join(targetDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  console.log(`✓ Copied ${utilityName} folder`);

  // 3. Perbarui utils/index.ts untuk mereferensikan folder lokal
  console.log("Updating utils/index.ts with explicit local export override ...");
  let indexContent = fs.readFileSync(indexPath, "utf8").trim();

  const localExportLine = `export { ${utilitySymbols.join(", ")} } from "./${utilityName}";`;

  if (!indexContent.includes(`./${utilityName}`)) {
    indexContent += `\n${localExportLine}\n`;
    fs.writeFileSync(indexPath, indexContent, "utf8");
    console.log("✓ Updated utils/index.ts with override.");
  } else {
    console.log("⚠️ Info: Local export for this utility already exists in utils/index.ts");
  }

  console.log(`\nSuccess! You can now customize files under: utils/${utilityName}/`);
}
