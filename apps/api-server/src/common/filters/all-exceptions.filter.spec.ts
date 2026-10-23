import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  it('returns Chinese validation details for unknown nested media fields', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-id', method: 'POST', originalUrl: '/api/v1/admin/vehicles' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    const logger = { error: jest.fn() };
    const filter = new AllExceptionsFilter(logger as never);

    filter.catch(new BadRequestException(['media.0.property url should not exist']), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      code: 40001,
      message: '请求参数错误',
      errors: [{ message: '第 1 个素材不允许提交字段“预览地址”' }],
      requestId: 'request-id',
    });
  });

  it('identifies the duplicate vehicle identity field', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request-id', method: 'POST', originalUrl: '/api/v1/admin/vehicles' }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    const filter = new AllExceptionsFilter({ error: jest.fn() } as never);
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.0',
      meta: { target: ['stockNo'] },
    });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      code: 40901,
      message: '库存编号已存在，请使用其他库存编号或编辑现有车辆',
      errors: [{ field: 'stockNo', message: '库存编号已存在，请使用其他库存编号或编辑现有车辆' }],
      requestId: 'request-id',
    });
  });
});
