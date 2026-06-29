import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../config/prisma.service';
import { AuditAction } from '@prisma/client';

/**
 * Belge: KVKK & Loglama
 * "Kim, neyi, ne zaman görüntüledi/değiştirdi (audit log)"
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const userId = req.user?.userId;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    // Audit'e ihtiyaç olmayan endpointler
    if (url.includes('/health') || url.includes('/api/docs')) {
      return next.handle();
    }

    const action = this.mapMethodToAction(method);
    const entity = this.extractEntity(url);

    return next.handle().pipe(
      tap(async () => {
        if (!userId || !entity) return;
        try {
          await this.prisma.auditLog.create({
            data: {
              userId,
              action,
              entity,
              ipAddress,
              userAgent,
              newValue: method !== 'GET' ? req.body : undefined,
            },
          });
        } catch (err) {
          this.logger.error('Audit log yazılamadı', err);
        }
      }),
    );
  }

  private mapMethodToAction(method: string): AuditAction {
    switch (method) {
      case 'POST': return AuditAction.CREATE;
      case 'GET': return AuditAction.READ;
      case 'PUT':
      case 'PATCH': return AuditAction.UPDATE;
      case 'DELETE': return AuditAction.DELETE;
      default: return AuditAction.READ;
    }
  }

  private extractEntity(url: string): string | null {
    const match = url.match(/\/api\/v1\/([a-z-]+)/i);
    return match ? match[1] : null;
  }
}
