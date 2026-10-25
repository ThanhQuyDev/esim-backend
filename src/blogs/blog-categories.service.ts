import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type BlogCategoryNode = {
  id: number;
  nameEn: string;
  nameVi: string;
  slugEn: string;
  slugVi: string;
  children: Omit<BlogCategoryNode, 'children'>[];
};

/** The made-in-advance blog categories (vande #076), parent → children. */
@Injectable()
export class BlogCategoriesService {
  constructor(private readonly dataSource: DataSource) {}

  async tree(): Promise<BlogCategoryNode[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, "parentId", "nameEn", "nameVi", "slugEn", "slugVi"
         FROM blog_category
        ORDER BY "sortOrder", id`,
    )) as (Omit<BlogCategoryNode, 'children'> & { parentId: number | null })[];

    const node = (r: (typeof rows)[number]) => ({
      id: Number(r.id),
      nameEn: r.nameEn,
      nameVi: r.nameVi,
      slugEn: r.slugEn,
      slugVi: r.slugVi,
    });
    const parents: BlogCategoryNode[] = rows
      .filter((r) => r.parentId === null)
      .map((r) => ({ ...node(r), children: [] }));
    const byId = new Map(parents.map((p) => [p.id, p]));
    for (const row of rows) {
      if (row.parentId === null) continue;
      byId.get(Number(row.parentId))?.children.push(node(row));
    }
    return parents;
  }
}
