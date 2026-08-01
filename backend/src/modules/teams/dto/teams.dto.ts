import { IsString, IsOptional, MinLength, IsArray, IsBoolean } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddTeamMemberDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsBoolean()
  isLead?: boolean;
}

export class BulkAddMembersDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
