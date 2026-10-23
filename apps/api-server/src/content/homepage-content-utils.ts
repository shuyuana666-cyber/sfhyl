import { BadRequestException } from "@nestjs/common";

export function* homepageMediaIds(value: unknown): Generator<bigint> {
  if (Array.isArray(value)) {
    for (const item of value) yield* homepageMediaIds(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key.endsWith("MediaId") && item !== null && item !== "") {
      if (typeof item !== "string" && typeof item !== "number") {
        throw new BadRequestException("Invalid media identifier.");
      }
      const id = `${item}`;
      if (!/^\d+$/.test(id)) {
        throw new BadRequestException("Invalid media identifier.");
      }
      yield BigInt(id);
      continue;
    }
    yield* homepageMediaIds(item);
  }
}

export function homepageReferencesMedia(value: unknown, mediaId: bigint): boolean {
  for (const id of homepageMediaIds(value)) {
    if (id === mediaId) return true;
  }
  return false;
}
