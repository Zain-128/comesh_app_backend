// log-request.pipe.ts

import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { plainToClass } from 'class-transformer';

@Injectable()
export class LogRequestPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    const keys = value && typeof value === 'object' ? Object.keys(value) : [];
    console.log('[updateProfile] Incoming body keys:', keys);
    console.log('[updateProfile] Incoming body:', value);

    // Optionally, you can transform the incoming data to a class instance using class-transformer
    const transformedValue = plainToClass(metadata.metatype, value);

    return transformedValue;
  }
}
