import sanitizeHtml from 'sanitize-html';

export function sanitizePlainText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}
