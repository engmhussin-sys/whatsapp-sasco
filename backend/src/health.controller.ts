import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/**
 * Minimal liveness endpoint for the deployment platform (Railway) to poll.
 * Deliberately NOT a "module" — registered directly on AppModule, since
 * it's infrastructure plumbing rather than a product feature, per this
 * Sprint's "no new modules beyond what the MVP screens need" directive.
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
