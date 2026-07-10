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

  const corePackagePath = path.join(projectRoot, "node_modules", "@skalfa", "skalfa-api-core");
  const sourceDir = path.join(corePackagePath, "src", utilityName);
  const targetDir = path.join(utilsDir, utilityName);

  if (!exists(sourceDir)) {
    throw new Error(`Source folder for "${utilityName}" not found at ${sourceDir}. Make sure @skalfa/skalfa-api-core is installed.`);
  }

  if (exists(targetDir)) {
    throw new Error(`Utility folder "${utilityName}" is already present in your local utils folder.`);
  }

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

function findComponentFolder(srcDir: string, componentName: string): { folderName: string, fileName: string } | null {
  if (!fs.existsSync(srcDir)) return null;
  const folders = fs.readdirSync(srcDir);
  for (const folder of folders) {
    const folderPath = path.join(srcDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
      const filePath = path.join(folderPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      
      // Match the component name or the component name with "Component" suffix (e.g. Button or ButtonComponent)
      const regex = new RegExp(`export\\s+(async\\s+)?(function|const|class|type|interface)\\s+\\b(${componentName}|${componentName}Component)\\b`);
      if (regex.test(content)) {
        return { folderName: folder, fileName: file };
      }
    }
  }
  return null;
}

export function pickComponent(componentName: string, newName?: string): void {
  const projectRoot = findProjectRoot(process.cwd());
  if (!projectRoot) {
    throw new Error("No package.json found. Run this command inside a Skalfa project.");
  }

  // 1. Locate the component source in @skalfa/skalfa-component
  let componentSrcDir = path.join(projectRoot, "node_modules", "@skalfa", "skalfa-component", "src");
  if (!fs.existsSync(componentSrcDir)) {
    componentSrcDir = path.resolve(projectRoot, "..", "skalfa-component", "src");
  }

  // Clean the componentName if it has "Component" suffix for searching
  const cleanComponentName = componentName.endsWith("Component") ? componentName.replace(/Component$/, "") : componentName;

  const match = findComponentFolder(componentSrcDir, cleanComponentName);
  if (!match) {
    throw new Error(`Component "${componentName}" not found in @skalfa/skalfa-component.`);
  }

  const { folderName, fileName } = match;
  const sourceFolder = path.join(componentSrcDir, folderName);
  const sourceFilePath = path.join(sourceFolder, fileName);

  // Extract base name of the component file (e.g. "Button" from "Button.component.tsx")
  const fileBaseName = fileName.replace(/\.(component)?\.(tsx|ts)$/, "");

  // Find all exported symbols in the file that start with or match the file base name
  const sourceContent = fs.readFileSync(sourceFilePath, "utf8");
  const exportRegex = new RegExp(`export\\s+(async\\s+)?(function|const|class|type|interface)\\s+\\b(${fileBaseName}\\w*)\\b`, "g");
  const exportedTypes: string[] = [];
  const exportedValues: string[] = [];
  let exportMatch;
  while ((exportMatch = exportRegex.exec(sourceContent)) !== null) {
    const keyword = exportMatch[2];
    const symbol = exportMatch[3];
    if (keyword === "type" || keyword === "interface") {
      exportedTypes.push(symbol);
    } else {
      exportedValues.push(symbol);
    }
  }

  const componentsDir = path.join(projectRoot, "components");
  const indexPath = path.join(componentsDir, "index.ts");

  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  // Ensure index.ts exists
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `export * from "@skalfa/skalfa-component";\n`, "utf8");
  }

  // Determine target names
  const targetFolderName = newName ? newName.charAt(0).toLowerCase() + newName.slice(1) : folderName;
  const targetFolder = path.join(componentsDir, targetFolderName);

  const targetFileName = newName ? fileName.replace(fileBaseName, newName.endsWith("Component") ? newName.replace(/Component$/, "") : newName) : fileName;
  const targetFilePath = path.join(targetFolder, targetFileName);

  if (fs.existsSync(targetFilePath)) {
    throw new Error(`Component file "${targetFileName}" already exists in components/${targetFolderName}/.`);
  }

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Copy only files starting with fileBaseName (e.g. Sidebar.component.tsx, Sidebar.css, etc.)
  const filesToCopy = fs.readdirSync(sourceFolder).filter(f => f.startsWith(fileBaseName));

  console.log(`Copying component "${cleanComponentName}" files from ${sourceFolder} to components/${targetFolderName} ...`);
  for (const file of filesToCopy) {
    fs.copyFileSync(path.join(sourceFolder, file), path.join(targetFolder, file));
  }

  let finalFileBaseName = fileBaseName;
  let finalExportedTypes = [...exportedTypes];
  let finalExportedValues = [...exportedValues];

  // If renaming is requested, perform renaming of files and contents
  if (newName) {
    const cleanNewName = newName.endsWith("Component") ? newName.replace(/Component$/, "") : newName;
    finalFileBaseName = cleanNewName;
    finalExportedTypes = exportedTypes.map(sym => sym.replace(new RegExp(fileBaseName, "g"), cleanNewName));
    finalExportedValues = exportedValues.map(sym => sym.replace(new RegExp(fileBaseName, "g"), cleanNewName));

    for (const file of filesToCopy) {
      const filePath = path.join(targetFolder, file);
      if (fs.statSync(filePath).isDirectory()) continue;

      // Read file content and replace component names
      let content = fs.readFileSync(filePath, "utf8");
      
      // Replace fileBaseName (e.g. Button) with cleanNewName (e.g. MyButton)
      const nameRegex = new RegExp(fileBaseName, "g");
      content = content.replace(nameRegex, cleanNewName);

      fs.writeFileSync(filePath, content, "utf8");

      // Rename the file if it contains the original file base name
      if (file.includes(fileBaseName)) {
        const newFile = file.replace(fileBaseName, cleanNewName);
        fs.renameSync(filePath, path.join(targetFolder, newFile));
      }
    }
  }

  // Update components/index.ts to export the local component explicitly
  let indexContent = fs.readFileSync(indexPath, "utf8");
  
  // Find the exact filename of the main component file inside the target folder
  const targetFiles = fs.readdirSync(targetFolder);
  const componentFile = targetFiles.find(f => f.includes(finalFileBaseName) && (f.endsWith(".tsx") || f.endsWith(".ts")));
  
  if (componentFile) {
    const componentBaseFile = componentFile.replace(/\.(tsx|ts)$/, "");
    
    const valueExport = finalExportedValues.length > 0 
      ? `export { ${finalExportedValues.join(", ")} } from "./${targetFolderName}/${componentBaseFile}";`
      : "";
    const typeExport = finalExportedTypes.length > 0 
      ? `export type { ${finalExportedTypes.join(", ")} } from "./${targetFolderName}/${componentBaseFile}";`
      : "";
    
    const localExportLine = [valueExport, typeExport].filter(Boolean).join("\n");
    
    if (!indexContent.includes(`./${targetFolderName}/`)) {
      indexContent = indexContent.trim() + `\n${localExportLine}\n`;
      fs.writeFileSync(indexPath, indexContent, "utf8");
      console.log(`✓ Updated components/index.ts with local export for: ${[...finalExportedValues, ...finalExportedTypes].join(", ")}`);
    } else {
      console.log(`⚠️ Info: Local export for "${targetFolderName}" already exists in components/index.ts`);
    }
  }

  const finalSymbols = [...finalExportedValues, ...finalExportedTypes];
  console.log(`\nSuccess! Component "${finalSymbols.find((s: string) => !s.endsWith("Props")) || finalSymbols[0]}" is now available locally at components/${targetFolderName}/`);
}
