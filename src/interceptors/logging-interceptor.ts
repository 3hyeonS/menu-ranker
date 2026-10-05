import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

type RequestLogEvent =
  | 'request.started'
  | 'request.completed'
  | 'request.aborted';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstIsoString(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS)
    .toISOString()
    .replace('Z', '+09:00');
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    if (!req || !res) {
      return next.handle();
    }

    // 쿼리 문자열에는 인증 코드 등 민감한 값이 포함될 수 있어 경로만 남긴다.
    const path =
      req.path || String(req.originalUrl || req.url || '').split('?')[0];
    const method = req.method;
    const userAgent = String(req.headers?.['user-agent'] || '');
    const startedAt = Date.now();
    const requestId = randomUUID();

    const isHealthCheck =
      path === '/health' ||
      path === '/api/health' ||
      userAgent.includes('ELB-HealthChecker');

    if (isHealthCheck) {
      return next.handle();
    }

    // 이후의 서비스/에러 로그에서도 같은 ID를 사용할 수 있도록 요청에 보관하고,
    // 클라이언트도 문의 시 ID를 전달할 수 있도록 응답 헤더에 포함한다.
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    let finished = false;
    let abortLogged = false;

    const getUserId = (): number | string | null => {
      const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
      return typeof userId === 'number' || typeof userId === 'string'
        ? userId
        : null;
    };

    const logRequest = (
      event: RequestLogEvent,
      extra: Record<string, unknown> = {},
    ): void => {
      const loggedAt = new Date();
      console.log('[REQUEST]', {
        event,
        timestamp: loggedAt.toISOString(),
        timestampKst: toKstIsoString(loggedAt),
        requestId,
        userId: getUserId(),
        method,
        path,
        ...extra,
      });
    };

    const cleanupListeners = (): void => {
      req.removeListener('aborted', onRequestAborted);
      res.removeListener('finish', onResponseFinished);
      res.removeListener('close', onResponseClosed);
    };

    const logAborted = (source: 'request.aborted' | 'response.close'): void => {
      if (finished || abortLogged) {
        return;
      }

      abortLogged = true;
      logRequest('request.aborted', {
        durationMs: Date.now() - startedAt,
        source,
        statusCode: res.statusCode,
        headersSent: res.headersSent,
      });
      cleanupListeners();
    };

    function onRequestAborted(): void {
      logAborted('request.aborted');
    }

    function onResponseClosed(): void {
      // 정상 응답 뒤에도 close가 발생하므로 finish 전 close만 중단으로 본다.
      logAborted('response.close');
    }

    function onResponseFinished(): void {
      if (abortLogged) {
        return;
      }

      finished = true;
      logRequest('request.completed', {
        durationMs: Date.now() - startedAt,
        statusCode: res.statusCode,
      });
      cleanupListeners();
    }

    req.once('aborted', onRequestAborted);
    res.once('finish', onResponseFinished);
    res.once('close', onResponseClosed);

    logRequest('request.started');

    return next.handle();
  }
}
