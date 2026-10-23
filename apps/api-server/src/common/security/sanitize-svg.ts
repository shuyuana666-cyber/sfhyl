import { BadRequestException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

export function sanitizeSvg(source: string): string {
  const sanitized = sanitizeHtml(source, {
    allowedTags: ['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc'],
    allowedAttributes: {
      svg: ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'role', 'aria-label'],
      '*': ['d', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity', 'offset', 'stop-color', 'stop-opacity'],
    },
    allowedSchemes: [],
    parser: { lowerCaseAttributeNames: false },
  });
  if (!/<svg[\s>]/i.test(sanitized)) throw new BadRequestException('SVG 内容无效');
  return sanitized;
}
