import { execSync } from "node:child_process";

export function installDependencies(target: string): void {
  runNpmInstall(target);
}

export function installPackage(target: string, packageName: string): void {
  runNpmInstall(target, [packageName]);
}

export function runNpmInstall(target: string, packages: string[] = []): void {
  const command = ["npm", "install", ...packages].join(" ");
  execSync(command, {
    cwd: target,
    stdio: "inherit"
  });
}