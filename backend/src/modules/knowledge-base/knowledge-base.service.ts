import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateKnowledgeArticleDto, UpdateKnowledgeArticleDto } from './dto/knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  /** Articles visible to a given company: platform-wide (companyId
   * null) PLUS this company's own, published-only unless the caller is
   * an admin browsing their own drafts too. */
  async listForCompany(companyId: string, includeDrafts = false) {
    return this.prisma.knowledgeArticle.findMany({
      where: {
        OR: [{ companyId: null }, { companyId }],
        ...(includeDrafts ? {} : { isPublished: true }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Super Admin: every article across the platform, drafts included. */
  listAllPlatform() {
    return this.prisma.knowledgeArticle.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  createPlatformArticle(authorId: string, dto: CreateKnowledgeArticleDto) {
    return this.prisma.knowledgeArticle.create({
      data: { ...dto, companyId: null, authorId },
    });
  }

  createCompanyArticle(companyId: string, authorId: string, dto: CreateKnowledgeArticleDto) {
    return this.prisma.knowledgeArticle.create({
      data: { ...dto, companyId, authorId },
    });
  }

  async update(articleId: string, dto: UpdateKnowledgeArticleDto) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    return this.prisma.knowledgeArticle.update({ where: { id: articleId }, data: dto });
  }

  async remove(articleId: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');
    return this.prisma.knowledgeArticle.delete({ where: { id: articleId } });
  }
}
