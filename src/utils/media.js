const OPTIMIZED_IMAGE_PATTERN = /^\/(cars|about)\/.+\.(?:jpe?g|png)$/i;

export function optimizedImageUrl(value) {
  if (typeof value !== 'string' || !OPTIMIZED_IMAGE_PATTERN.test(value)) return value;
  return value.replace(/\.(?:jpe?g|png)$/i, '.webp');
}
