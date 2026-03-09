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

    const { method, originalUrl, url, headers, ip } = req;
    const userAgent = headers?.['user-agent'] ?? 'unknown';
    const path = originalUrl || url;

    console.log(`[Before] ${method} ${path} | ip=${ip} | ua=${userAgent}`);

    const now = Date.now();

    return next
      .handle()
      .pipe(
        tap(() =>
          console.log(
            `[After] ${method} ${path} | ${Date.now() - now}ms | ip=${ip}`,
          ),
        ),
      );
  }
}
