import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function installDependencies(target: string): void {
  runInstall(target);
}

export function installPackage(target: string, packageName: string): void {
  runInstall(target, [packageName]);
}

export function runInstall(target: string, packages: string[] = []): void {
  const useBun = fs.existsSync(path.join(target, "bun.lock"));
  const pm = useBun ? "bun" : "npm";
  const action = useBun ? "add" : "install";

  const command = packages.length > 0
    ? [pm, action, ...packages].join(" ")
    : [pm, "install"].join(" ");

  console.log(`Running: ${command}`);

  execSync(command, {
    cwd: target,
    stdio: "inherit"
  });
}