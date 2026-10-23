export function prismaConstraintTarget(target: unknown): string {
  if (typeof target === "string") return target;
  if (!Array.isArray(target)) return "";

  return target
    .filter((value: unknown): value is string => typeof value === "string")
    .join(",");
}
