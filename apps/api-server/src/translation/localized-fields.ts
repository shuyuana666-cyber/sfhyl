import type { TranslationService } from "./translation.service";

export interface LocalizedFieldMapping {
  sourceField: string;
  translationKey: string;
  englishField: string;
  russianField: string;
  fallback?: "source" | "existing";
}

type TranslationProvider = Pick<TranslationService, "translateChineseFields">;

export async function applyLocalizedFields<T extends object>(
  dto: T,
  translation: TranslationProvider | undefined,
  mappings: readonly LocalizedFieldMapping[],
): Promise<T> {
  const sourceValues = dto as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const activeMappings = mappings.filter((mapping) => {
    const value = sourceValues[mapping.sourceField];
    if (typeof value !== "string" || !value.trim()) return false;
    fields[mapping.translationKey] = value;
    return true;
  });
  if (!activeMappings.length) return dto;

  const translated = translation
    ? await translation.translateChineseFields(fields)
    : undefined;
  const localizedValues = { ...sourceValues };
  for (const mapping of activeMappings) {
    const pair = translated?.[mapping.translationKey];
    if (pair) {
      localizedValues[mapping.englishField] = pair.en;
      localizedValues[mapping.russianField] = pair.ru;
      continue;
    }
    if (translation) continue;

    const sourceValue = sourceValues[mapping.sourceField] as string;
    const fallback = mapping.fallback ?? "existing";
    localizedValues[mapping.englishField] =
      fallback === "existing"
        ? (sourceValues[mapping.englishField] ?? sourceValue)
        : sourceValue;
    localizedValues[mapping.russianField] =
      fallback === "existing"
        ? (sourceValues[mapping.russianField] ?? sourceValue)
        : sourceValue;
  }
  return localizedValues as T;
}
