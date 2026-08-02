import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole, TranslationProviderType } from '@prisma/client';
import { TranslationEngineService } from './translation-engine.service';
import { TranslationProviderConfigService } from './translation-provider-config.service';
import { TranslateRequestDto, UpsertProviderConfigDto } from './dto/translation-engine.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('translation-engine')
@ApiBearerAuth()
@Controller('companies/:companyId/translation')
export class TranslationEngineController {
  constructor(
    private engine: TranslationEngineService,
    private providerConfig: TranslationProviderConfigService,
  ) {}

  @Post('translate')
  translate(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: TranslateRequestDto) {
    return this.engine.translate(companyId, dto.text, dto.sourceLanguage, dto.targetLanguage, user.sub);
  }

  @Post('retranslate')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  retranslate(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: TranslateRequestDto) {
    return this.engine.retranslate(companyId, dto.text, dto.sourceLanguage, dto.targetLanguage, user.sub);
  }

  @Get('providers')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  listProviders(@TenantId() companyId: string) {
    return this.providerConfig.listForCompany(companyId);
  }

  @Post('providers')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  upsertProvider(@TenantId() companyId: string, @Body() dto: UpsertProviderConfigDto) {
    return this.providerConfig.upsert(companyId, dto.providerType, {
      apiKeyEnvVar: dto.apiKeyEnvVar,
      region: dto.region,
      model: dto.model,
      isActive: dto.isActive,
      priority: dto.priority,
    });
  }

  @Delete('providers/:providerType')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  removeProvider(@TenantId() companyId: string, @Param('providerType') providerType: TranslationProviderType) {
    return this.providerConfig.remove(companyId, providerType);
  }
}
