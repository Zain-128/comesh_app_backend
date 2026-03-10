// log-request.pipe.ts

import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { plainToClass } from 'class-transformer';

@Injectable()
export class LogRequestPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    console.log('Incoming Request Body:', value);

    // Optionally, you can transform the incoming data to a class instance using class-transformer
    const transformedValue = plainToClass(metadata.metatype, value);

    return transformedValue;
  }
}
