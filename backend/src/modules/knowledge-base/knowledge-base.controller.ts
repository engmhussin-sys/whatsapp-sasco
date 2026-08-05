import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeArticleDto, UpdateKnowledgeArticleDto } from './dto/knowledge-base.dto';

@Controller()
export class KnowledgeBaseController {
  constructor(private kbService: KnowledgeBaseService) {}

  // ---- Platform-wide (Super Admin) ----
  @Roles(SystemRole.SUPER_ADMIN)
  @Get('knowledge-base/platform')
  listAllPlatform() {
    return this.kbService.listAllPlatform();
  }

  @Roles(SystemRole.SUPER_ADMIN)
  @Post('knowledge-base/platform')
  createPlatformArticle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateKnowledgeArticleDto) {
    return this.kbService.createPlatformArticle(user.sub, dto);
  }

  // ---- Company-scoped ----
  @Get('companies/:companyId/knowledge-base')
  listForCompany(@TenantId() companyId: string, @Query('includeDrafts') includeDrafts?: string) {
    return this.kbService.listForCompany(companyId, includeDrafts === 'true');
  }

  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  @Post('companies/:companyId/knowledge-base')
  createCompanyArticle(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateKnowledgeArticleDto) {
    return this.kbService.createCompanyArticle(companyId, user.sub, dto);
  }

  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  @Patch('knowledge-base/:articleId')
  update(@Param('articleId') articleId: string, @Body() dto: UpdateKnowledgeArticleDto) {
    return this.kbService.update(articleId, dto);
  }

  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  @Delete('knowledge-base/:articleId')
  remove(@Param('articleId') articleId: string) {
    return this.kbService.remove(articleId);
  }
}
