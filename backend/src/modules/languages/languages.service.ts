import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LanguagesService {
  constructor(private prisma: PrismaService) {}

  /** Global catalog — not tenant-scoped (languages are a platform-level reference table). */
  findAll() {
    return this.prisma.language.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async enableForCompany(companyId: string, langCode: string) {
    const language = await this.prisma.language.findUnique({ where: { code: langCode } });
    if (!language) throw new NotFoundException('Unknown language code');

    const existing = await this.prisma.companyLanguage.findUnique({
      where: { companyId_langCode: { companyId, langCode } },
    });
    if (existing) throw new ConflictException('Language already enabled for this company');

    return this.prisma.companyLanguage.create({ data: { companyId, langCode } });
  }

  async disableForCompany(companyId: string, langCode: string) {
    await this.prisma.companyLanguage.delete({
      where: { companyId_langCode: { companyId, langCode } },
    });
  }

  findForCompany(companyId: string) {
    return this.prisma.companyLanguage.findMany({
      where: { companyId },
      include: { language: true },
    });
  }
}
