import fs from "node:fs";
import path from "node:path";

export function exists(targetPath: string): boolean {
  return fs.existsSync(targetPath);
}

export function ensureDirectoryExists(targetPath: string): void {
  fs.mkdirSync(targetPath, { recursive: true });
}

export function readJsonFile<T>(targetPath: string): T {
  return JSON.parse(fs.readFileSync(targetPath, "utf8")) as T;
}

export function writeJsonFile(targetPath: string, value: unknown): void {
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function removeDirectory(targetPath: string): void {
  if (!exists(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
}

export function assertInsideDirectory(parent: string, child: string): void {
  const resolvedParent = path.resolve(parent);
  const resolvedChild = path.resolve(child);
  const relativePath = path.relative(resolvedParent, resolvedChild);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Path is outside expected directory: ${child}`);
  }
}

export function findProjectRoot(startPath: string): string | null {
  let currentPath = path.resolve(startPath);

  while (true) {
    if (exists(path.join(currentPath, "package.json"))) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}