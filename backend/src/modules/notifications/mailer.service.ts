import { Injectable, Logger } from '@nestjs/common';

/**
 * Basit e-posta gönderici. nodemailer DİNAMİK yüklenir; paket kurulu değilse veya
 * SMTP_* ortam değişkenleri tanımlı değilse sessizce pasif kalır (uygulamayı düşürmez).
 *
 * Aktif etmek için (backend .env):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false
 *   SMTP_USER=kullanici@gmail.com
 *   SMTP_PASS=uygulama_sifresi
 *   SMTP_FROM=IKYS <no-reply@sirket.com>
 * ve:  npm i nodemailer
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger('MailerService');
  private transporter: any = null;
  private tried = false;

  private async getTransporter(): Promise<any> {
    if (this.tried) return this.transporter;
    this.tried = true;
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.log('SMTP yapılandırılmadı; e-posta gönderimi pasif.');
      return null;
    }
    try {
      // Modül adını değişkene alıyoruz: nodemailer kurulu olmasa bile TS derlemede
      // modül çözümlemesi yapmaz; yoksa runtime'da hata fırlatır, yakalanır.
      const moduleName = 'nodemailer';
      const nodemailer: any = await import(moduleName);
      const createTransport =
        nodemailer.createTransport || nodemailer.default?.createTransport;
      this.transporter = createTransport({
        host,
        port: +(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    } catch (e: any) {
      this.logger.warn('nodemailer yüklü değil (npm i nodemailer); e-posta atlanıyor.');
      this.transporter = null;
    }
    return this.transporter;
  }

  /** Fire-and-forget. Hata yutulur, hiçbir koşulda akışı bozmaz. */
  send(to: string | null | undefined, subject: string, text?: string): void {
    if (!to) return;
    this.getTransporter()
      .then((t) => {
        if (!t) return;
        return t.sendMail({
          from: process.env.SMTP_FROM || 'IKYS <no-reply@ikys.local>',
          to,
          subject,
          text: text || subject,
        });
      })
      .catch((e: any) =>
        this.logger.warn(`E-posta gönderilemedi (${to}): ${e?.message || e}`),
      );
  }
}
