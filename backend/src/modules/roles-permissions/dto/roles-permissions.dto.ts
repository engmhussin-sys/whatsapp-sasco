import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[]; // e.g. ["tasks.approve", "users.create"]
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}

export class AssignRoleToUserDto {
  @IsString()
  userId: string;

  @IsString()
  roleId: string;
}
