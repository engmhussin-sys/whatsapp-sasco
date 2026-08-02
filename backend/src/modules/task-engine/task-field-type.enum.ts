/**
 * NOT a Prisma-schema enum — deliberately. `TaskTemplate.fields` is a
 * `Json` column (dynamic form field definitions), so this type exists
 * purely for application-level validation/type-safety in DTOs, never as
 * an actual database column type.
 *
 * HISTORY: this WAS declared as `enum TaskFieldType { ... }` inside
 * prisma/schema.prisma, which caused a real, confirmed production build
 * failure — Prisma's generator only exports enums that are referenced by
 * at least one model field; an enum declared but never used as a column
 * type is silently DROPPED from the generated client entirely. That made
 * every `import { TaskFieldType } from '@prisma/client'` fail at build
 * time with "has no exported member 'TaskFieldType'", even though
 * `prisma generate` itself reported success. Defining it here instead
 * — decoupled from Prisma — fixes this permanently and is also the
 * architecturally correct choice, since this was never really a
 * database-level concept.
 */
export enum TaskFieldType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  TIME = 'TIME',
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  SIGNATURE = 'SIGNATURE',
  GPS = 'GPS',
  CHECKBOX = 'CHECKBOX',
  DROPDOWN = 'DROPDOWN',
}
