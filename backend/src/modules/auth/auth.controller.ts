import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshDto, Verify2FADto, ChangePasswordDto } from './auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Yeni kullanıcı kaydı (sadece admin tarafından kullanılabilir prod\'da)' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Giriş yap - e-posta + şifre + (opsiyonel) 2FA token' })
  login(@Body() dto: LoginDto, @Req() req) {
    return this.auth.login(dto, req.ip);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Token yenileme' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser('userId') userId: string) {
    return this.auth.logout(userId);
  }

  @ApiBearerAuth()
  @Post('2fa/setup')
  @ApiOperation({ summary: '2FA QR kodu oluştur (Belge: tercihen 2FA)' })
  setup2FA(@CurrentUser('userId') userId: string) {
    return this.auth.setup2FA(userId);
  }

  @ApiBearerAuth()
  @Post('2fa/verify')
  verify2FA(@CurrentUser('userId') userId: string, @Body() dto: Verify2FADto) {
    return this.auth.verify2FA(userId, dto);
  }

  @ApiBearerAuth()
  @Post('2fa/disable')
  @ApiOperation({ summary: '2FA\'yı kapat' })
  disable2FA(@CurrentUser('userId') userId: string) {
    return this.auth.disable2FA(userId);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Şifre değiştir' })
  changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto.oldPassword, dto.newPassword);
  }
}
