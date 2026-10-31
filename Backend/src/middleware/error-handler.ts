import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';
import multer from 'multer';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  void next;
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    response
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the submitted fields.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({
      error: {
        code: error.code,
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'Files must be 25 MB or smaller.'
            : 'The uploaded file could not be accepted.',
      },
    });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  response
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
};
