import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

type PushPayload = {
  title: string;
  body?: string;
  priority?: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  refType?: string | null;
  refId?: string | null;
};

/**
 * FCM (Firebase Cloud Messaging) ile uygulama kapalıyken bile push gönderir.
 * firebase-admin DİNAMİK yüklenir; paket kurulu değilse veya kimlik dosyası yoksa
 * sessizce pasif kalır (uygulamayı düşürmez).
 *
 * Kimlik: process.env.FIREBASE_CREDENTIALS veya backend/firebase-service-account.json
 * Kurulum: npm i firebase-admin
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('PushService');
  private admin: any = null;
  private tried = false;

  constructor(private prisma: PrismaService) {}

  private getAdmin(): any {
    if (this.tried) return this.admin;
    this.tried = true;
    try {
      const credPath =
        process.env.FIREBASE_CREDENTIALS ||
        path.join(process.cwd(), 'firebase-service-account.json');
      if (!fs.existsSync(credPath)) {
        this.logger.log('Firebase kimlik dosyası yok; push pasif.');
        return null;
      }
      const moduleName = 'firebase-admin';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require(moduleName);
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      this.admin = admin;
      this.logger.log('Firebase push hazır.');
      return admin;
    } catch (e: any) {
      this.logger.warn(
        'firebase-admin yüklenemedi (npm i firebase-admin?): ' +
          (e?.message || e),
      );
      return null;
    }
  }

  private channelFor(priority?: string): string {
    if (priority === 'URGENT') return 'ikys_urgent';
    if (priority === 'IMPORTANT') return 'ikys_important';
    return 'ikys_default';
  }

  /** Fire-and-forget; hata yutulur. */
  async sendToPersonnel(personnelIds: string[], payload: PushPayload) {
    const admin = this.getAdmin();
    if (!admin || personnelIds.length === 0) return;
    try {
      const rows = await this.prisma.deviceToken.findMany({
        where: { personnelId: { in: personnelIds } },
        select: { token: true },
      });
      const tokens = [...new Set(rows.map((r) => r.token))];
      if (tokens.length === 0) return;

      const priority = payload.priority || 'NORMAL';
      const channelId = this.channelFor(priority);
      const urgent = priority === 'URGENT';

      const message = {
        tokens,
        notification: { title: payload.title, body: payload.body || '' },
        data: {
          priority,
          refType: payload.refType || '',
          refId: payload.refId || '',
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId,
            sound: urgent ? 'urgent' : 'default',
            ...(urgent ? { color: '#DC2626' } : {}),
          },
        },
        apns: {
          payload: {
            aps: { sound: urgent ? 'urgent.caf' : 'default' },
          },
        },
      };

      const res = await admin.messaging().sendEachForMulticast(message);

      // Geçersiz/expired token temizliği
      const toDelete: string[] = [];
      res.responses.forEach((r: any, i: number) => {
        if (!r.success) {
          const code = r.error?.code || '';
          if (
            code.includes('registration-token-not-registered') ||
            code.includes('invalid-registration-token') ||
            code.includes('invalid-argument')
          ) {
            toDelete.push(tokens[i]);
          }
        }
      });
      if (toDelete.length) {
        await this.prisma.deviceToken.deleteMany({
          where: { token: { in: toDelete } },
        });
      }
    } catch (e: any) {
      this.logger.warn('Push gönderilemedi: ' + (e?.message || e));
    }
  }

  async registerToken(personnelId: string, token: string, platform?: string) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      update: { personnelId, platform: platform || null },
      create: { personnelId, token, platform: platform || null },
    });
  }

  async removeToken(token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
    return { success: true };
  }
}
