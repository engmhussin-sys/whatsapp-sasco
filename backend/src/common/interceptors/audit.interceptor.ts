import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Lightweight request/response logger. Structured business-level audit
 * events (who did what to which entity) are recorded explicitly by
 * services via AuditLogsService.record(...) — this interceptor only
 * provides baseline HTTP traceability (method, path, actor, latency).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const actor = user?.sub ?? 'anonymous';
        this.logger.log(`${method} ${url} actor=${actor} ${Date.now() - started}ms`);
      }),
    );
  }
}
