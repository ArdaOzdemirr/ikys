import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { NotificationType, NotificationPriority, Prisma } from '@prisma/client';
import { MailerService } from './mailer.service';
import { PushService } from './push.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
    private push: PushService,
  ) {}

  /** İlgili personellerin e-postasına da bildirim gönderir (fire-and-forget). */
  private async emailPersonnel(ids: string[], subject: string, text?: string) {
    try {
      const people = await this.prisma.personnel.findMany({
        where: { id: { in: ids } },
        select: { user: { select: { email: true } } },
      });
      for (const p of people) this.mailer.send(p.user?.email, subject, text);
    } catch {
      // sessiz geç
    }
  }

  /**
   * Tek bir bildirim oluşturur. Diğer modüller (örn. izin onay zinciri) buradan çağırır.
   * tx verilirse aynı transaction içinde yazar.
   */
  async create(
    data: {
      recipientId: string;
      type: NotificationType;
      title: string;
      body?: string;
      priority?: NotificationPriority;
      senderId?: string | null;
      refType?: string | null;
      refId?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const created = await client.notification.create({
      data: {
        recipientId: data.recipientId,
        senderId: data.senderId ?? null,
        type: data.type,
        priority: data.priority ?? NotificationPriority.NORMAL,
        title: data.title,
        body: data.body ?? null,
        refType: data.refType ?? null,
        refId: data.refId ?? null,
      },
    });
    // E-posta kopyası (bildirimi görmezse diye) — beklenmez, hata yutulur
    void this.emailPersonnel([data.recipientId], data.title, data.body);
    // FCM push (uygulama kapalıyken bile) — fire-and-forget
    void this.push.sendToPersonnel([data.recipientId], {
      title: data.title,
      body: data.body,
      priority: data.priority ?? NotificationPriority.NORMAL,
      type: data.type,
      refType: data.refType,
      refId: data.refId,
    });
    return created;
  }

  /** Çalışanın gelen kutusu (en yeni önce). */
  list(personnelId: string, onlyUnread = false, limit = 50) {
    return this.prisma.notification.findMany({
      where: {
        recipientId: personnelId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async unreadCount(personnelId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: personnelId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, personnelId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Bildirim bulunamadı');
    if (notif.recipientId !== personnelId) {
      throw new ForbiddenException('Bu bildirim size ait değil');
    }
    if (notif.isRead) return notif;
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(personnelId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { recipientId: personnelId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: res.count };
  }

  /** Bildirimi siler (yalnızca sahibi silebilir). */
  async remove(id: string, personnelId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Bildirim bulunamadı');
    if (notif.recipientId !== personnelId) {
      throw new ForbiddenException('Bu bildirim size ait değil');
    }
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Alınan bir mesaja yanıt: hiyerarşi kısıtı uygulanmaz. Aldığın mesajın
   * göndericisine, o kişi üst hiyerarşinizde olsa bile cevap verebilirsiniz.
   */
  async replyToMessage(
    personnelId: string,
    notificationId: string,
    title: string,
    body?: string,
    priority: NotificationPriority = NotificationPriority.NORMAL,
  ) {
    const original = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!original) throw new NotFoundException('Bildirim bulunamadı');
    if (original.recipientId !== personnelId) {
      throw new ForbiddenException('Bu bildirim size ait değil');
    }
    if (!original.senderId) {
      throw new ForbiddenException('Bu bildirimin bir göndericisi yok, yanıtlanamaz');
    }

    const sender = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { firstName: true, lastName: true },
    });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Bir çalışan';

    const created = await this.prisma.notification.create({
      data: {
        recipientId: original.senderId,
        senderId: personnelId,
        type: NotificationType.MESSAGE,
        priority,
        title,
        body: body ?? null,
      },
    });

    void this.emailPersonnel([original.senderId], title, body);
    void this.push.sendToPersonnel([original.senderId], {
      title,
      body,
      priority,
      type: NotificationType.MESSAGE,
    });

    return { sent: 1, from: senderName, notification: created };
  }

  /** managerId zincirini yukarı doğru gezip bu personelin tüm üst amirlerinin id'lerini döner. */
  private async getSuperiorIds(personnelId: string): Promise<Set<string>> {
    const superiors = new Set<string>();
    let currentId: string | null = personnelId;
    while (currentId) {
      const current: { managerId: string | null } | null =
        await this.prisma.personnel.findUnique({
          where: { id: currentId },
          select: { managerId: true },
        });
      if (!current?.managerId || superiors.has(current.managerId)) break;
      superiors.add(current.managerId);
      currentId = current.managerId;
    }
    return superiors;
  }

  /**
   * Bu personelin mesaj gönderebileceği kişiler: kendisi ve üst hiyerarşisindeki
   * (yöneticisi, yöneticisinin yöneticisi, ...) kişiler hariç, tüm aktif personel.
   */
  async messageableRecipients(personnelId: string) {
    const me = await this.prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true },
    });
    if (!me) throw new NotFoundException('Personel kaydı bulunamadı');

    const superiorIds = await this.getSuperiorIds(personnelId);

    const people = await this.prisma.personnel.findMany({
      where: {
        status: 'ACTIVE',
        id: { notIn: [me.id, ...superiorIds] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    return people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position?.title ?? null,
      department: p.department?.name ?? null,
    }));
  }

  /**
   * Mesaj gönderir. Kısıtlama: kendi üst hiyerarşisindeki (yöneticisi ve
   * üzeri) kimseye mesaj gönderemez; akranlarına ve altındakilere serbest.
   */
  async sendMessage(
    senderId: string,
    recipientIds: string[],
    title: string,
    body?: string,
    priority: NotificationPriority = NotificationPriority.NORMAL,
  ) {
    const targets = [...new Set(recipientIds)].filter((id) => id !== senderId);
    if (targets.length === 0) {
      throw new ForbiddenException('Geçerli alıcı yok');
    }
    const validCount = await this.prisma.personnel.count({
      where: { id: { in: targets }, status: 'ACTIVE' },
    });
    if (validCount !== targets.length) {
      throw new ForbiddenException('Geçersiz alıcı listesi');
    }

    const superiorIds = await this.getSuperiorIds(senderId);
    if (targets.some((id) => superiorIds.has(id))) {
      throw new ForbiddenException('Üst hiyerarşinizdeki birine mesaj gönderemezsiniz');
    }

    const sender = await this.prisma.personnel.findUnique({
      where: { id: senderId },
      select: { firstName: true, lastName: true },
    });
    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`
      : 'Bir çalışan';

    await this.prisma.notification.createMany({
      data: targets.map((recipientId) => ({
        recipientId,
        senderId,
        type: NotificationType.MESSAGE,
        priority,
        title,
        body: body ?? null,
      })),
    });

    void this.emailPersonnel(targets, title, body);
    void this.push.sendToPersonnel(targets, {
      title,
      body,
      priority,
      type: NotificationType.MESSAGE,
    });

    return { sent: targets.length, from: senderName };
  }

  /**
   * ADMIN duyurusu: tüm aktif personele bildirim (ve e-posta) gönderir.
   * Yetki kontrolü controller'da @Roles(ADMIN) ile yapılır.
   */
  async broadcast(
    senderId: string,
    title: string,
    body?: string,
    priority: NotificationPriority = NotificationPriority.NORMAL,
  ) {
    const people = await this.prisma.personnel.findMany({
      where: { status: 'ACTIVE', id: { not: senderId } },
      select: { id: true },
    });
    const ids = people.map((p) => p.id);
    if (ids.length === 0) return { sent: 0 };

    await this.prisma.notification.createMany({
      data: ids.map((recipientId) => ({
        recipientId,
        senderId,
        type: NotificationType.MESSAGE,
        priority,
        title,
        body: body ?? null,
      })),
    });

    void this.emailPersonnel(ids, title, body);
    void this.push.sendToPersonnel(ids, {
      title,
      body,
      priority,
      type: NotificationType.MESSAGE,
    });

    return { sent: ids.length };
  }

  // === FCM cihaz token yönetimi ===
  registerDeviceToken(personnelId: string, token: string, platform?: string) {
    return this.push.registerToken(personnelId, token, platform);
  }

  removeDeviceToken(token: string) {
    return this.push.removeToken(token);
  }
}
