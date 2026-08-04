import { SetMetadata } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';

export const REQUIRE_MODULE_KEY = 'requireModule';

/**
 * Gates a route behind a company having the given module active — the
 * core enforcement mechanism of the Module Marketplace (see
 * PROJECT_VISION.md / schema.prisma's CompanyModule model). Mirrors the
 * exact pattern of @Roles(...) + RolesGuard, just checking module
 * activation instead of SystemRole.
 *
 * Usage: @RequireModule(ModuleCode.SAFETY) on a controller or route.
 * Routes with no @RequireModule() are unaffected (ModuleGuard treats
 * "no metadata" as "not gated", same convention as RolesGuard).
 */
export const RequireModule = (module: ModuleCode) => SetMetadata(REQUIRE_MODULE_KEY, module);
