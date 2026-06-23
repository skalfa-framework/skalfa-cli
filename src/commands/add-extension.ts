import { findProjectRoot } from "../utils/fs";
import { installPackage } from "../utils/installer";

export const extensions = {
  mail: "@kava/mail",
  redis: "@kava/redis",
  notification: "@kava/notification"
} as const;

export const extensionNames = Object.keys(extensions);

export function addExtension(extensionName: string): void {
  const packageName = extensions[extensionName as keyof typeof extensions];

  if (!packageName) {
    throw new Error(
      `Unknown extension "${extensionName}". Available extensions: ${extensionNames.join(", ")}`
    );
  }

  const projectRoot = findProjectRoot(process.cwd());

  if (!projectRoot) {
    throw new Error("No package.json found. Run this command inside a Kava API project.");
  }

  console.log(`Installing Kava extension: ${extensionName}`);
  installPackage(projectRoot, packageName);
  console.log(`Installed ${packageName}`);
}