//Şube Departman Pozisyon yönetimi için listeleme herkese açık bu bilgileri güncelleme Admin ve İnsan Kaynakları yapabilir.


import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('company')
@ApiBearerAuth()
@Controller('company')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  //ŞUBELER
  @Post('branches') @Roles(Role.ADMIN, Role.HR)
  createBranch(@Body() body: any) { return this.service.createBranch(body); }

  @Get('branches')
  listBranches() { return this.service.listBranches(); }

  @Patch('branches/:id') @Roles(Role.ADMIN, Role.HR)
  updateBranch(@Param('id') id: string, @Body() body: any) {
    return this.service.updateBranch(id, body);
  }

  @Delete('branches/:id') @Roles(Role.ADMIN, Role.HR)
  deleteBranch(@Param('id') id: string) {
    return this.service.deleteBranch(id);
  }

  //DEPARTMANLAR
  @Post('departments') @Roles(Role.ADMIN, Role.HR)
  createDepartment(@Body() body: any) { return this.service.createDepartment(body); }

  @Get('departments')
  listDepartments(@Query('branchId') branchId?: string) {
    return this.service.listDepartments(branchId);
  }

  @Patch('departments/:id') @Roles(Role.ADMIN, Role.HR)
  updateDepartment(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDepartment(id, body);
  }

  @Delete('departments/:id') @Roles(Role.ADMIN, Role.HR)
  deleteDepartment(@Param('id') id: string) {
    return this.service.deleteDepartment(id);
  }

  //POZİSYONLAR
  @Post('positions') @Roles(Role.ADMIN, Role.HR)
  createPosition(@Body() body: any) { return this.service.createPosition(body); }

  @Get('positions')
  listPositions(@Query('departmentId') departmentId?: string) {
    return this.service.listPositions(departmentId);
  }

  @Patch('positions/:id') @Roles(Role.ADMIN, Role.HR)
  updatePosition(@Param('id') id: string, @Body() body: any) {
    return this.service.updatePosition(id, body);
  }

  @Delete('positions/:id') @Roles(Role.ADMIN, Role.HR)
  deletePosition(@Param('id') id: string) {
    return this.service.deletePosition(id);
  }
}
