import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DirectoryService } from './directory.service';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('directory')
@ApiBearerAuth()
@Controller('companies/:companyId/directory')
export class DirectoryController {
  constructor(private service: DirectoryService) {}

  @Get()
  getDirectory(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getDirectory(companyId, user.sub);
  }

  @Get('users')
  getUsers(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.service.getDirectoryUsers(companyId, user.sub, search);
  }
}
