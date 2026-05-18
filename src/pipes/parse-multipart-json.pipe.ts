import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

const JSON_FIELD_NAMES = new Set([
  'niche',
  'questionAndAnswers',
  'socialMediaProfiles',
  'location',
  'previousVideos',
  'videos',
]);

function tryParseJson(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const t = value.trim();
  if (!t.startsWith('[') && !t.startsWith('{')) {
    return value;
  }
  try {
    return JSON.parse(t);
  } catch {
    return value;
  }
}

/**
 * Multipart bodies send arrays/objects as JSON strings; parse before ValidationPipe.
 */
@Injectable()
export class ParseMultipartJsonPipe implements PipeTransform {
  transform(value: Record<string, unknown>, _metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    const out = { ...value };
    for (const key of Object.keys(out)) {
      if (JSON_FIELD_NAMES.has(key)) {
        out[key] = tryParseJson(out[key]);
      }
    }
    return out;
  }
}
