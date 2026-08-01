import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/teams.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('teams')
@ApiBearerAuth()
@Controller('companies/:companyId/teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string) {
    return this.teamsService.findAll(companyId);
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.teamsService.findOne(companyId, id);
  }

  @Patch(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  remove(@TenantId() companyId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.remove(companyId, id, user.sub);
  }

  @Post(':id/members')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  addMember(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.addMember(companyId, id, dto.userId, !!dto.isLead, user.sub);
  }

  @Delete(':id/members/:userId')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  removeMember(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.removeMember(companyId, id, userId, user.sub);
  }
}
