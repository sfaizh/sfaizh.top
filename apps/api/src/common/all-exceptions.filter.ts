import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@sfaizh/shared';

/**
 * Every failure leaves as `{ statusCode, message, error }` so the terminal can
 * print it the way a shell prints stderr, without guessing at shapes.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);

      response.status(status).json({
        statusCode: status,
        message: Array.isArray(message) ? message.join('; ') : message,
        error: exception.name,
      } satisfies ApiError);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'InternalServerError',
    } satisfies ApiError);
  }
}
