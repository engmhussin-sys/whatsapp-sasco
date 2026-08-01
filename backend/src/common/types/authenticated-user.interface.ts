import { SystemRole } from '@prisma/client';

/** Shape of the JWT payload / req.user attached after authentication. */
export interface AuthenticatedUser {
  sub: string; // user id
  companyId: string | null; // null only for SUPER_ADMIN
  systemRole: SystemRole;
  email: string;
}
