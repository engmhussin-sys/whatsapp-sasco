import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { RolesPermissionsService } from './roles-permissions.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionsDto,
  AssignRoleToUserDto,
} from './dto/roles-permissions.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('roles-permissions')
@ApiBearerAuth()
@Controller('companies/:companyId/roles')
export class RolesPermissionsController {
  constructor(private service: RolesPermissionsService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.service.createRole(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get('permissions/catalog')
  findAllPermissions() {
    return this.service.findAllPermissions();
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Patch(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  remove(@TenantId() companyId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(companyId, id, user.sub);
  }

  @Patch(':id/permissions')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  setPermissions(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setPermissions(companyId, id, dto, user.sub);
  }

  @Post('assign')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  assign(@TenantId() companyId: string, @Body() dto: AssignRoleToUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.assignRoleToUser(companyId, dto.userId, dto.roleId, user.sub);
  }
}
