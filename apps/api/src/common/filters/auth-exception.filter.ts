import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface AuthErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  path: string;
  timestamp: string;
  retryable: boolean;
}

/**
 * Hardened Auth Exception Filter for MixMatch-Onchain.
 * Intercepts HTTP and uncaught operational exceptions, sanitizes responses,
 * masks internal stack traces, and provides retry guidance for transient failures.
 */
@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorCode = 'AUTH_ERROR';
    let retryable = false;

    // Standardized Error Code & Retryability Mapping
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        errorCode = 'UNAUTHORIZED_ACCESS';
        break;
      case HttpStatus.FORBIDDEN:
        errorCode = 'INSUFFICIENT_PERMISSIONS';
        break;
      case HttpStatus.SERVICE_UNAVAILABLE:
        errorCode = 'AUTH_SERVICE_UNAVAILABLE';
        retryable = true;
        break;
      case HttpStatus.TOO_MANY_REQUESTS:
        errorCode = 'RATE_LIMIT_EXCEEDED';
        retryable = true;
        break;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        errorCode = 'INTERNAL_AUTH_ERROR';
        break;
    }

    // Message Sanitization & Edge Case Parsing
    let rawMessage: unknown = 'An unexpected authentication error occurred';

    if (isHttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        rawMessage = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        rawMessage = (res as any).message;
      }
    }

    let sanitizedMessage: string;
    if (Array.isArray(rawMessage) && rawMessage.length > 0) {
      sanitizedMessage = String(rawMessage[0]);
    } else if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
      sanitizedMessage = rawMessage.trim();
    } else {
      sanitizedMessage = 'An unexpected authentication error occurred';
    }

    // Mask non-HTTP unexpected error details from public response
    if (!isHttpException) {
      const err = exception as Error;
      this.logger.error(
        `Uncaught Auth Exception on ${request.method} ${request.url}: ${err?.message || 'Unknown error'}`,
        err?.stack,
      );
      sanitizedMessage = 'Internal authentication processing error';
    } else {
      this.logger.warn(
        `Auth Exception [${errorCode}] ${request.method} ${request.url} - Status: ${status}`,
      );
    }

    const errorPayload: AuthErrorResponse = {
      statusCode: status,
      errorCode,
      message: sanitizedMessage,
      path: request.url || '/',
      timestamp: new Date().toISOString(),
      retryable,
    };

    response.status(status).json(errorPayload);
  }
}