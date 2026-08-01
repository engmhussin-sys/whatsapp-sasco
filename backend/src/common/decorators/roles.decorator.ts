import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restricts a route to one or more SystemRole values. */
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
