import { Request, Response, NextFunction } from 'express';

const JSON_KEYS = new Set([
  'niche',
  'questionAndAnswers',
  'socialMediaProfiles',
  'location',
  'previousVideos',
  'videos',
]);

function tryParseJson(value: unknown): unknown {
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

/** Run before ValidationPipe so multipart JSON strings become arrays/objects. */
export function parseMultipartFieldsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const body = req.body as Record<string, unknown>;
  if (!body || typeof body !== 'object') {
    return next();
  }
  for (const key of Object.keys(body)) {
    if (JSON_KEYS.has(key) || key.includes('[')) {
      body[key] = tryParseJson(body[key]);
    }
  }
  next();
}
