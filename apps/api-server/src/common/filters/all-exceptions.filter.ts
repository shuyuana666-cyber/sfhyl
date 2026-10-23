import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { JsonLoggerService } from '../logging/json-logger.service';
import { prismaConstraintTarget } from '../utils/prisma-constraint.util';

interface ValidationMessage {
  field?: string;
  message: string;
}

const fieldLabels: Record<string, string> = {
  altEn: '英文 ALT 文案',
  altRu: '俄文 ALT 文案',
  altZh: '中文 ALT 文案',
  brandId: '品牌',
  categoryId: '分类',
  coverMediaId: '封面素材',
  email: '邮箱',
  media: '素材',
  mediaId: '素材',
  mimeType: '文件类型',
  modelId: '车型',
  password: '密码',
  seriesId: '车系',
  stockNo: '库存编号',
  thumbnailUrl: '缩略图地址',
  url: '预览地址',
  username: '用户名',
  vin: 'VIN',
};

function fieldLabel(field: string): string {
  return fieldLabels[field] ?? field;
}

function matchPart(match: RegExpExecArray, index: number): string {
  return match[index] ?? '';
}

function fieldPathLabel(path: string): string {
  const mediaField = /^media\.(\d+)\.(.+)$/i.exec(path);
  if (mediaField) {
    return `第 ${Number(matchPart(mediaField, 1)) + 1} 个素材的${fieldLabel(matchPart(mediaField, 2))}`;
  }

  const mediaItem = /^media\.(\d+)$/i.exec(path);
  if (mediaItem) return `第 ${Number(matchPart(mediaItem, 1)) + 1} 个素材`;

  return `字段“${fieldLabel(path)}”`;
}

function defaultMessageForStatus(status: number): string {
  if (status === 400) return '请求参数错误';
  if (status === 401) return '登录已失效，请重新登录';
  if (status === 403) return '没有执行此操作的权限';
  if (status === 404) return '请求的资源不存在';
  if (status === 409) return '数据已存在或当前状态不允许该操作';
  if (status === 429) return '操作过于频繁，请稍后再试';
  return '服务器内部错误';
}

function uniqueConstraintError(target: unknown): ValidationMessage {
  const value = prismaConstraintTarget(target);
  if (/stock.?no/i.test(value)) {
    return { field: 'stockNo', message: '库存编号已存在，请使用其他库存编号或编辑现有车辆' };
  }
  if (/\bvin\b/i.test(value)) {
    return { field: 'vin', message: 'VIN 已存在，请核对后重试' };
  }
  return { message: '数据已存在' };
}

function localizeValidationMessage(value: unknown, fallback = '请求参数不符合要求'): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  if (/[\u3400-\u9fff]/.test(text)) return text;

  const forbidden = /^(?:(.+)\.)?property ([A-Za-z0-9_]+) should not exist$/i.exec(text);
  if (forbidden) {
    const path = matchPart(forbidden, 1);
    const target = path ? fieldPathLabel(path) : '请求参数';
    return `${target}不允许提交字段“${fieldLabel(matchPart(forbidden, 2))}”`;
  }

  const required = /^(.+?) should not be empty$/i.exec(text);
  if (required) return `${fieldPathLabel(matchPart(required, 1))}不能为空`;

  const maxLength = /^(.+?) must be shorter than or equal to (\d+) characters$/i.exec(text);
  if (maxLength) {
    return `${fieldPathLabel(matchPart(maxLength, 1))}长度不能超过 ${matchPart(maxLength, 2)} 个字符`;
  }

  const minLength = /^(.+?) must be longer than or equal to (\d+) characters$/i.exec(text);
  if (minLength) {
    return `${fieldPathLabel(matchPart(minLength, 1))}长度不能少于 ${matchPart(minLength, 2)} 个字符`;
  }

  const type = /^(.+?) must be (a string|an array|an integer number|a number|a boolean value)$/i.exec(text);
  if (type) {
    const typeLabels: Record<string, string> = {
      'a string': '文本',
      'an array': '列表',
      'an integer number': '整数',
      'a number': '数字',
      'a boolean value': '开关值',
    };
    const expected = typeLabels[matchPart(type, 2).toLowerCase()] ?? '指定格式';
    return `${fieldPathLabel(matchPart(type, 1))}格式不正确，应为${expected}`;
  }

  if (/^(Unauthorized|Invalid credentials)$/i.test(text)) return '登录信息错误或已失效';
  if (/^Forbidden$/i.test(text)) return '没有执行此操作的权限';
  if (/^Not Found$/i.test(text)) return '请求的资源不存在';
  if (/^(Bad Request|Validation failed)$/i.test(text)) return '请求参数错误';
  return fallback;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const mapped = this.mapException(exception);

    if (mapped.status >= 500) {
      this.logger.error(
        {
          requestId: request.requestId,
          method: request.method,
          path: request.originalUrl.split('?', 1)[0] || request.path,
          error: exception instanceof Error ? exception.message : String(exception),
        },
        exception instanceof Error ? exception.stack : undefined,
        'HttpException',
      );
    }

    response.status(mapped.status).json({
      code: mapped.code,
      message: mapped.message,
      ...(mapped.errors.length ? { errors: mapped.errors } : {}),
      requestId: request.requestId,
    });
  }

  private mapException(exception: unknown): {
    status: number;
    code: number;
    message: string;
    errors: ValidationMessage[];
  } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const error = uniqueConstraintError(exception.meta?.target);
        return { status: 409, code: 40901, message: error.message, errors: [error] };
      }
      if (exception.code === 'P2003') {
        return { status: 409, code: 40902, message: '存在关联数据，无法完成操作', errors: [] };
      }
      if (exception.code === 'P2025') {
        return { status: 404, code: 40401, message: '资源不存在', errors: [] };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const messages = typeof body === 'object' && body && 'message' in body ? body.message : exception.message;
      const fallback = defaultMessageForStatus(status);
      const errors: ValidationMessage[] = Array.isArray(messages)
        ? messages.map((message) => ({ message: localizeValidationMessage(message) }))
        : [];
      const message = typeof messages === 'string' ? localizeValidationMessage(messages, fallback) : fallback;
      return { status, code: status * 100 + 1, message, errors };
    }

    return { status: 500, code: 50001, message: '服务器内部错误', errors: [] };
  }
}
