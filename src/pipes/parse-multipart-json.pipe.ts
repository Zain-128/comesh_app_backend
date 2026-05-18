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

/** niche[0], questionAndAnswers[0][question] → nested object for class-validator. */
function unflattenBracketBody(flat: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(flat)) {
    const value = tryParseJson(rawValue);

    if (!key.includes('[')) {
      result[key] = value;
      continue;
    }

    const segments = key.replace(/\]/g, '').split('[').filter(Boolean);
    let cursor: Record<string, unknown> | unknown[] = result;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      const nextSeg = segments[i + 1];
      const nextIsIndex = nextSeg !== undefined && /^\d+$/.test(nextSeg);

      if (isLast) {
        if (Array.isArray(cursor)) {
          cursor[Number(seg)] = value;
        } else {
          (cursor as Record<string, unknown>)[seg] = value;
        }
        continue;
      }

      if (Array.isArray(cursor)) {
        const idx = Number(seg);
        if (cursor[idx] === undefined) {
          cursor[idx] = nextIsIndex ? [] : {};
        }
        cursor = cursor[idx] as Record<string, unknown> | unknown[];
      } else {
        const obj = cursor as Record<string, unknown>;
        if (obj[seg] === undefined) {
          obj[seg] = nextIsIndex ? [] : {};
        }
        cursor = obj[seg] as Record<string, unknown> | unknown[];
      }
    }
  }

  return result;
}

/**
 * Multipart: JSON strings and/or bracket fields → arrays/objects before ValidationPipe.
 */
@Injectable()
export class ParseMultipartJsonPipe implements PipeTransform {
  transform(value: Record<string, unknown>, _metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    const flat = { ...value };
    const nested = unflattenBracketBody(flat);

    for (const key of Object.keys(nested)) {
      if (JSON_FIELD_NAMES.has(key)) {
        nested[key] = tryParseJson(nested[key]);
      }
    }

    return nested;
  }
}
