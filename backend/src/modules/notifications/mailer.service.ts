import { Injectable, Logger } from '@nestjs/common';

/**
 * Basit e-posta gönderici. İki sağlayıcıyı destekler, hiçbiri tanımlı değilse
 * sessizce pasif kalır (uygulamayı düşürmez):
 *
 * 1) Resend (önerilen — ekstra paket gerekmez, Node'un yerleşik fetch'i kullanılır):
 *      RESEND_API_KEY=re_xxx
 *      RESEND_FROM=IKYS <onboarding@resend.dev>   (kendi domainini doğrulamadıysan
 *                                                   bu adres ve sadece Resend hesap
 *                                                   sahibinin e-postası çalışır)
 *    RESEND_API_KEY tanımlıysa SMTP'ye hiç bakılmaz, Resend önceliklidir.
 *
 * 2) SMTP / Gmail (nodemailer DİNAMİK yüklenir; paket kurulu değilse pasif kalır):
 *      SMTP_HOST=smtp.gmail.com
 *      SMTP_PORT=587
 *      SMTP_SECURE=false
 *      SMTP_USER=kullanici@gmail.com
 *      SMTP_PASS=uygulama_sifresi
 *      SMTP_FROM=IKYS <no-reply@sirket.com>
 *    ve:  npm i nodemailer
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger('MailerService');
  private transporter: any = null;
  private tried = false;

  private async sendViaResend(to: string, subject: string, text: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'IKYS <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${body}`);
    }
  }

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
    } catch {
      this.logger.warn('nodemailer yüklü değil (npm i nodemailer); e-posta atlanıyor.');
      this.transporter = null;
    }
    return this.transporter;
  }

  /** Fire-and-forget. Hata yutulur, hiçbir koşulda akışı bozmaz. */
  send(to: string | null | undefined, subject: string, text?: string): void {
    if (!to) return;

    if (process.env.RESEND_API_KEY) {
      this.sendViaResend(to, subject, text || subject).catch((e: any) =>
        this.logger.warn(`E-posta gönderilemedi (Resend, ${to}): ${e?.message || e}`),
      );
      return;
    }

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
        this.logger.warn(`E-posta gönderilemedi (SMTP, ${to}): ${e?.message || e}`),
      );
  }
}
