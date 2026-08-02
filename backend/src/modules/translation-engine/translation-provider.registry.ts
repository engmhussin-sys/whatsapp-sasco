import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TranslationProvider } from './interfaces/translation-provider.interface';
import { OpenAiTranslationProvider } from './providers/openai-translation.provider';
import { GoogleTranslationProvider } from './providers/google-translation.provider';
import { AzureTranslationProvider } from './providers/azure-translation.provider';
import { DeepLTranslationProvider } from './providers/deepl-translation.provider';
import { OfflineStubTranslationProvider } from './providers/offline-stub-translation.provider';

/**
 * The ONLY place in the system that knows about concrete provider
 * classes — TranslationEngineService only ever talks to this registry
 * and the TranslationProvider interface. Adding a 6th provider means:
 * (1) write a class implementing TranslationProvider, (2) add one line
 * to the map in the constructor. No other file changes.
 *
 * Provider SELECTION per company is entirely data-driven (the
 * TranslationProviderConfig table, managed via
 * TranslationProviderConfigService/Controller) — switching a company
 * from OpenAI to DeepL from the admin panel is a database write, never
 * a deployment.
 */
@Injectable()
export class TranslationProviderRegistry {
  private readonly providers: Map<string, TranslationProvider>;

  constructor(
    private prisma: PrismaService,
    openai: OpenAiTranslationProvider,
    google: GoogleTranslationProvider,
    azure: AzureTranslationProvider,
    deepl: DeepLTranslationProvider,
    offlineStub: OfflineStubTranslationProvider,
  ) {
    this.providers = new Map<string, TranslationProvider>([
      [openai.providerType, openai],
      [google.providerType, google],
      [azure.providerType, azure],
      [deepl.providerType, deepl],
      [offlineStub.providerType, offlineStub],
    ]);
  }

  /**
   * Resolves the highest-priority ACTIVE provider configured for this
   * company (falling back to a platform-default config with
   * companyId=null if the company hasn't configured one of its own),
   * and finally to OFFLINE_STUB if nothing is configured at all — the
   * engine never hard-fails just because no AI provider was set up.
   */
  async resolveForCompany(companyId: string): Promise<{ provider: TranslationProvider; apiKey: string | null; region: string | null; model: string | null }> {
    const config =
      (await this.prisma.translationProviderConfig.findFirst({
        where: { companyId, isActive: true },
        orderBy: { priority: 'asc' },
      })) ??
      (await this.prisma.translationProviderConfig.findFirst({
        where: { companyId: null, isActive: true },
        orderBy: { priority: 'asc' },
      }));

    if (!config) {
      const stub = this.providers.get('OFFLINE_STUB');
      if (!stub) throw new ServiceUnavailableException('No translation provider available');
      return { provider: stub, apiKey: null, region: null, model: null };
    }

    const provider = this.providers.get(config.providerType);
    if (!provider) {
      throw new ServiceUnavailableException(`Unknown translation provider type: ${config.providerType}`);
    }

    const apiKey = config.apiKeyEnvVar ? (process.env[config.apiKeyEnvVar] ?? null) : null;
    return { provider, apiKey, region: config.region, model: config.model };
  }
}
