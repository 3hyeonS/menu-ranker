import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (!req) {
      return next.handle();
    }

    const path = req.originalUrl || req.url;
    const method = req.method;
    const userAgent = String(req.headers?.['user-agent'] || '');
    const now = Date.now();

    const isHealthCheck =
      path === '/health' ||
      path === '/api/health' ||
      userAgent.includes('ELB-HealthChecker');

    if (isHealthCheck) {
      return next.handle();
    }

    console.log(`[Before] ${method} ${path}`);

    return next.handle().pipe(
      tap(() => {
        console.log(`[After] ${method} ${path} ${Date.now() - now}ms`);
      }),
    );
  }
}
