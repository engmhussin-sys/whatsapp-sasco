import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

/**
 * NOTE: the `:companyId` path segment exists for readable/RESTful URLs
 * and is validated by TenantGuard, but it is NEVER passed to the
 * service layer directly. `@TenantId()` re-derives the authoritative
 * tenant id from the JWT (via request.tenantId), so even if a client
 * tampers with the URL, TenantGuard rejects the mismatch before this
 * controller runs, and the service only ever sees the JWT-derived id.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('companies/:companyId/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(companyId, dto);
  }

  @Get()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  findAll(
    @TenantId() companyId: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Query('search') search: string,
  ) {
    return this.usersService.findAll(companyId, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      search,
    });
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.usersService.findOne(companyId, id);
  }

  @Patch(':id')
  update(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.update(companyId, id, dto, user);
  }

  @Delete(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  remove(@TenantId() companyId: string, @Param('id') id: string) {
    return this.usersService.remove(companyId, id);
  }
}
