import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../config/prisma.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { v4 as uuid } from 'uuid';
import { LoginDto, RegisterDto, Verify2FADto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Bu e-posta zaten kayıtlı');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
      },
    });
    return { id: user.id, email: user.email, role: user.role };
  }

  async login(dto: LoginDto, _ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { personnel: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Geçersiz kimlik bilgileri');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Geçersiz kimlik bilgileri');

    // 2FA kontrolü
    if (user.twoFactorEnabled) {
      if (!dto.token2FA) {
        return { requires2FA: true, userId: user.id };
      }
      const valid = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: dto.token2FA,
        window: 1,
      });
      if (!valid) throw new UnauthorizedException('2FA kodu geçersiz');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user.id, user.email, user.role, dto.rememberMe);
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token geçersiz veya süresi dolmuş');
    }

    // Eskisini sil (rotation) - rememberMe durumu yeni token'a taşınır.
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    return this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.rememberMe,
    );
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { success: true };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mevcut şifre hatalı');

    if (newPassword.length < 8) {
      throw new BadRequestException('Yeni şifre en az 8 karakter olmalı');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Tüm oturumları kapat (refresh tokenları sil)
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { success: true, message: 'Şifre değiştirildi. Tekrar giriş yapın.' };
  }

  async disable2FA(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { success: true };
  }

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    const secret = speakeasy.generateSecret({
      name: `${process.env.TWO_FA_APP_NAME || 'IKYS'} (${user.email})`,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCode: qrDataUrl };
  }

  async verify2FA(userId: string, dto: Verify2FADto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA kurulmamış');

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: dto.token,
      window: 1,
    });
    if (!valid) throw new UnauthorizedException('Kod hatalı');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { success: true };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    rememberMe = false,
  ) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuid();
    const expiresAt = new Date();
    // Beni Hatırla: oturum ~1 yıl açık kalır (fiilen çıkış yapmadan düşmez).
    // Aksi halde 7 gün — ama her refresh'te tekrar 7 güne uzadığı için, en az
    // haftada bir kullanan biri zaten hiç düşmez.
    expiresAt.setDate(expiresAt.getDate() + (rememberMe ? 365 : 7));

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt, rememberMe },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role },
    };
  }
}
