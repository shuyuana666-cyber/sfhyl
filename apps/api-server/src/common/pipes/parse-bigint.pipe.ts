import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^\d+$/.test(value)) throw new BadRequestException('ID 格式不正确');
    return BigInt(value);
  }
}
