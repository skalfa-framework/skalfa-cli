import fs from "node:fs";
import path from "node:path";
import { ensureDirectoryExists } from "./fs";

export const ignoredNames = new Set(["node_modules", ".git"]);

export function copyTemplate(source: string, target: string): void {
  copyRecursive(source, target);
}

function copyRecursive(source: string, target: string): void {
  const stat = fs.lstatSync(source);

  if (stat.isDirectory()) {
    copyDirectory(source, target);
    return;
  }

  if (stat.isSymbolicLink()) {
    copySymbolicLink(source, target);
    return;
  }

  fs.copyFileSync(source, target);
}

function copyDirectory(source: string, target: string): void {
  ensureDirectoryExists(target);

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    copyRecursive(sourcePath, targetPath);
  }
}

function copySymbolicLink(source: string, target: string): void {
  const linkTarget = fs.readlinkSync(source);
  fs.symlinkSync(linkTarget, target);
}