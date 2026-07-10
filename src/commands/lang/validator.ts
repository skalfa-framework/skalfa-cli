import { ParsedAsset } from "./parser";
import { extractPlaceholders } from "./placeholder";

export interface ValidationError {
  type: "missing_key" | "placeholder_mismatch";
  filePath: string;
  locale: string;
  namespace: string;
  moduleName?: string;
  key: string;
  message: string;
}

export function validateAssets(assets: ParsedAsset[], defaultLocale: string = "id"): ValidationError[] {
  const errors: ValidationError[] = [];

  const groups: Record<string, Record<string, ParsedAsset>> = {};

  for (const asset of assets) {
    const groupKey = `${asset.type}:${asset.moduleName || ""}:${asset.namespace}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {};
    }
    groups[groupKey][asset.locale] = asset;
  }

  for (const [_, localeMap] of Object.entries(groups)) {
    const locales = Object.keys(localeMap);
    if (locales.length <= 1) continue;

    const refLocale = localeMap[defaultLocale] ? defaultLocale : locales[0];
    const refAsset = localeMap[refLocale];
    const refKeys = Object.keys(refAsset.content);

    for (const locale of locales) {
      if (locale === refLocale) continue;
      const asset = localeMap[locale];
      const keys = Object.keys(asset.content);

      for (const refKey of refKeys) {
        if (!keys.includes(refKey)) {
          errors.push({
            type: "missing_key",
            filePath: asset.filePath,
            locale,
            namespace: asset.namespace,
            moduleName: asset.moduleName,
            key: refKey,
            message: `Key "${refKey}" is missing in locale "${locale}" (present in reference "${refLocale}")`
          });
        }
      }

      for (const key of keys) {
        if (!refKeys.includes(key)) {
          errors.push({
            type: "missing_key",
            filePath: refAsset.filePath,
            locale: refLocale,
            namespace: refAsset.namespace,
            moduleName: refAsset.moduleName,
            key,
            message: `Key "${key}" is present in "${locale}" but missing in reference locale "${refLocale}"`
          });
        }
      }

      for (const refKey of refKeys) {
        if (keys.includes(refKey)) {
          const refText = refAsset.content[refKey];
          const localeText = asset.content[refKey];

          const refPlaceholders = extractPlaceholders(refText).sort();
          const localePlaceholders = extractPlaceholders(localeText).sort();

          if (JSON.stringify(refPlaceholders) !== JSON.stringify(localePlaceholders)) {
            errors.push({
              type: "placeholder_mismatch",
              filePath: asset.filePath,
              locale,
              namespace: asset.namespace,
              moduleName: asset.moduleName,
              key: refKey,
              message: `Placeholder mismatch for key "${refKey}" in "${locale}". Reference "${refLocale}" has {${refPlaceholders.join(", ")}} but "${locale}" has {${localePlaceholders.join(", ")}}`
            });
          }
        }
      }
    }
  }

  return errors;
}
