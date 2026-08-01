import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  startTime: string; // "HH:mm"

  @IsString()
  endTime: string; // "HH:mm"

  @IsOptional()
  @IsString()
  teamId?: string;
}

export class OpenShiftLogDto {
  @IsString()
  shiftId: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  // Answers to the company's "Open Shift Checklist" TaskTemplate (meter
  // readings, pump/tank photos, signature, ...). Optional: a company
  // that hasn't configured an open-shift template can skip this.
  @IsOptional()
  openTaskTemplateId?: string;

  @IsOptional()
  openAnswers?: Record<string, unknown>;
}

export class CloseShiftLogDto {
  @IsOptional()
  closeTaskTemplateId?: string;

  @IsOptional()
  closeAnswers?: Record<string, unknown>;
}
