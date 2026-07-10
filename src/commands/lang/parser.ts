import fs from "node:fs";
import { ScannedFile } from "./scanner";

export interface ParsedAsset extends ScannedFile {
  content: Record<string, string>;
}

export function parseAssets(files: ScannedFile[]): ParsedAsset[] {
  return files.map(file => {
    try {
      const raw = fs.readFileSync(file.filePath, "utf8");
      const content = JSON.parse(raw);
      
      const sanitizedContent: Record<string, string> = {};
      for (const [key, value] of Object.entries(content)) {
        sanitizedContent[key] = String(value);
      }

      return {
        ...file,
        content: sanitizedContent
      };
    } catch (err: any) {
      console.error(`[skalfa-lang] Error parsing ${file.filePath}: ${err.message}`);
      return {
        ...file,
        content: {}
      };
    }
  });
}
