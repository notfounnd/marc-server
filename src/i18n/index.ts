import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const activeLocale = "en_US";
export const supportedLocales = ["en_US"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export type TranslationCatalog = Record<string, string>;
export type TranslationVariables = Record<string, string | number>;
type CatalogPathStrategy = {
  name: string;
  resolve: (moduleDir: string, locale: SupportedLocale) => string;
};

const catalogPathStrategies: CatalogPathStrategy[] = [
  {
    name: "dist-public",
    resolve: (moduleDir, locale) => path.resolve(moduleDir, "..", "public", "locales", locale, "translation.json"),
  },
  {
    name: "source-public",
    resolve: (moduleDir, locale) => path.resolve(moduleDir, "..", "..", "public", "locales", locale, "translation.json"),
  },
  {
    name: "workspace-public",
    resolve: (_moduleDir, locale) => path.resolve(process.cwd(), "public", "locales", locale, "translation.json"),
  },
];

function localePath(locale: SupportedLocale = activeLocale): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const found = catalogPathStrategies
    .map((strategy) => strategy.resolve(moduleDir, locale))
    .find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Translation catalog not found for locale: ${locale}`);
  }
  return found;
}

let cachedCatalog: TranslationCatalog | undefined;

export function loadTranslations(locale: SupportedLocale = activeLocale): TranslationCatalog {
  if (locale === activeLocale && cachedCatalog) return cachedCatalog;

  const raw = fs.readFileSync(localePath(locale), "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const catalog: TranslationCatalog = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`Invalid i18n value for key: ${key}`);
    }
    catalog[key] = value;
  }

  if (locale === activeLocale) cachedCatalog = catalog;
  return catalog;
}

export function t(key: string, variables: TranslationVariables = {}): string {
  const template = loadTranslations()[key] ?? key;
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match,
  );
}
