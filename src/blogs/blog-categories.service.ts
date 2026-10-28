import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { blogCategorySlug } from './blog-categories';

export type BlogCategoryNode = {
  id: number;
  nameEn: string;
  nameVi: string;
  slugEn: string;
  slugVi: string;
  /** Posts filed under it (for a parent: under it or any of its children). */
  postCount: number;
  children: Omit<BlogCategoryNode, 'children'>[];
};

type Row = {
  id: number;
  parentId: number | null;
  nameEn: string;
  nameVi: string;
  slugEn: string;
  slugVi: string;
};

/** A post's category pair as stored: `category` = parent, `parent` = child. */
type PostCategories = {
  language: string;
  category: string | null;
  parent: string | null;
  n: number;
};

const MAX_NAME = 120;

/**
 * The blog categories authors pick from (vande #076), parent → children, and
 * their upkeep from the CMS.
 *
 * A post keeps the category's NAME in its own language (`blog.category` the
 * parent, `blog.parent` the child) and the storefront builds the address from
 * it, so renaming a category renames it on its posts too — otherwise they
 * would fall out of it.
 */
@Injectable()
export class BlogCategoriesService {
  constructor(private readonly dataSource: DataSource) {}

  async tree(): Promise<BlogCategoryNode[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, "parentId", "nameEn", "nameVi", "slugEn", "slugVi"
         FROM blog_category
        ORDER BY "sortOrder", id`,
    )) as Row[];
    const posts = await this.postCategories();

    const matches = (r: Row, name: string | null) => {
      if (!name) return false;
      const slug = blogCategorySlug(name);
      return slug === r.slugEn || slug === r.slugVi;
    };
    const node = (r: Row, postCount: number) => ({
      id: Number(r.id),
      nameEn: r.nameEn,
      nameVi: r.nameVi,
      slugEn: r.slugEn,
      slugVi: r.slugVi,
      postCount,
    });
    const count = (pred: (p: PostCategories) => boolean) =>
      posts.filter(pred).reduce((n, p) => n + Number(p.n), 0);

    const parents: BlogCategoryNode[] = rows
      .filter((r) => r.parentId === null)
      .map((r) => ({
        ...node(
          r,
          count((p) => matches(r, p.category)),
        ),
        children: [],
      }));
    const byId = new Map(parents.map((p) => [p.id, p]));
    const parentRow = new Map(
      rows.filter((r) => r.parentId === null).map((r) => [Number(r.id), r]),
    );
    for (const row of rows) {
      if (row.parentId === null) continue;
      const parent = parentRow.get(Number(row.parentId));
      if (!parent) continue;
      byId.get(Number(row.parentId))?.children.push(
        node(
          row,
          count((p) => matches(parent, p.category) && matches(row, p.parent)),
        ),
      );
    }
    return parents;
  }

  /** Add a category, or a child of `parentId`, at the end of its list. */
  async create(input: {
    parentId?: number | null;
    nameVi: string;
    nameEn: string;
  }): Promise<{ id: number }> {
    const { nameVi, nameEn } = this.names(input);
    const parentId = input.parentId ? Number(input.parentId) : null;
    if (parentId) {
      const parent = await this.find(parentId);
      if (parent.parentId !== null) {
        throw new BadRequestException(
          'Chỉ có 2 cấp: danh mục con không thể có danh mục con.',
        );
      }
    }
    await this.assertFree(parentId, nameVi, nameEn, null);
    const [row] = (await this.dataSource.query(
      `INSERT INTO blog_category ("parentId", "nameEn", "nameVi", "slugEn", "slugVi", "sortOrder")
       VALUES ($1::int, $2::varchar, $3::varchar, $4::varchar, $5::varchar,
               COALESCE((SELECT MAX("sortOrder") + 1 FROM blog_category
                          WHERE "parentId" IS NOT DISTINCT FROM $1::int), 0))
       RETURNING id`,
      [
        parentId,
        nameEn,
        nameVi,
        blogCategorySlug(nameEn),
        blogCategorySlug(nameVi),
      ],
    )) as { id: number }[];
    return { id: Number(row.id) };
  }

  /**
   * Rename a category in both languages, and its posts with it: each post
   * takes the new name in its own language, so it stays in the category.
   *
   * @returns how many posts were moved to the new name.
   */
  async rename(
    id: number,
    input: { nameVi: string; nameEn: string },
  ): Promise<{ postsUpdated: number }> {
    const { nameVi, nameEn } = this.names(input);
    const row = await this.find(id);
    await this.assertFree(row.parentId, nameVi, nameEn, row.id);

    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE blog_category
            SET "nameEn" = $2, "nameVi" = $3, "slugEn" = $4, "slugVi" = $5
          WHERE id = $1`,
        [
          row.id,
          nameEn,
          nameVi,
          blogCategorySlug(nameEn),
          blogCategorySlug(nameVi),
        ],
      );

      const parent =
        row.parentId === null ? null : await this.find(row.parentId);
      const posts = (await manager.query(
        `SELECT id, language, category, parent FROM blog`,
      )) as {
        id: number;
        language: string;
        category: string | null;
        parent: string | null;
      }[];
      const is = (r: Row, name: string | null) =>
        !!name && [r.slugEn, r.slugVi].includes(blogCategorySlug(name));

      let postsUpdated = 0;
      for (const post of posts) {
        const newName = post.language === 'vi' ? nameVi : nameEn;
        if (!parent && is(row, post.category)) {
          if (post.category === newName) continue;
          await manager.query(`UPDATE blog SET category = $2 WHERE id = $1`, [
            post.id,
            newName,
          ]);
          postsUpdated += 1;
        } else if (
          parent &&
          is(parent, post.category) &&
          is(row, post.parent)
        ) {
          if (post.parent === newName) continue;
          await manager.query(`UPDATE blog SET parent = $2 WHERE id = $1`, [
            post.id,
            newName,
          ]);
          postsUpdated += 1;
        }
      }
      return { postsUpdated };
    });
  }

  /**
   * Delete a category (a parent with its children). Refused while posts are
   * filed under it: they would lose their category without anyone noticing.
   */
  async remove(id: number): Promise<void> {
    const row = await this.find(id);
    const node = (await this.tree())
      .flatMap((p) => [p, ...p.children])
      .find((n) => n.id === Number(row.id));
    const inUse = node?.postCount ?? 0;
    if (inUse > 0) {
      throw new ConflictException(
        `Còn ${inUse} bài viết thuộc danh mục này — chuyển các bài đó sang danh mục khác trước khi xoá.`,
      );
    }
    await this.dataSource.query(`DELETE FROM blog_category WHERE id = $1`, [
      row.id,
    ]);
  }

  private async postCategories(): Promise<PostCategories[]> {
    return (await this.dataSource.query(
      `SELECT language, category, parent, COUNT(*)::int AS n
         FROM blog
        WHERE category IS NOT NULL AND category <> ''
        GROUP BY language, category, parent`,
    )) as PostCategories[];
  }

  private async find(id: number): Promise<Row> {
    const [row] = (await this.dataSource.query(
      `SELECT id, "parentId", "nameEn", "nameVi", "slugEn", "slugVi"
         FROM blog_category WHERE id = $1`,
      [Number(id)],
    )) as Row[];
    if (!row) throw new NotFoundException('Không tìm thấy danh mục.');
    return {
      ...row,
      id: Number(row.id),
      parentId: row.parentId === null ? null : Number(row.parentId),
    };
  }

  private names(input: { nameVi?: string; nameEn?: string }) {
    const nameVi = String(input.nameVi ?? '').trim();
    const nameEn = String(input.nameEn ?? '').trim();
    if (!nameVi || !nameEn) {
      throw new BadRequestException(
        'Nhập tên danh mục cả tiếng Việt và tiếng Anh.',
      );
    }
    if (nameVi.length > MAX_NAME || nameEn.length > MAX_NAME) {
      throw new BadRequestException(`Tên danh mục tối đa ${MAX_NAME} ký tự.`);
    }
    if (!blogCategorySlug(nameVi) || !blogCategorySlug(nameEn)) {
      throw new BadRequestException('Tên danh mục phải có chữ hoặc số.');
    }
    return { nameVi, nameEn };
  }

  /** No two categories at one level may share an address, in either language. */
  private async assertFree(
    parentId: number | null,
    nameVi: string,
    nameEn: string,
    exceptId: number | null,
  ): Promise<void> {
    const slugs = [blogCategorySlug(nameVi), blogCategorySlug(nameEn)];
    const [clash] = (await this.dataSource.query(
      `SELECT "nameVi" FROM blog_category
        WHERE "parentId" IS NOT DISTINCT FROM $1::int
          AND id <> COALESCE($2::int, 0)
          AND ("slugEn" = ANY($3::varchar[]) OR "slugVi" = ANY($3::varchar[]))
        LIMIT 1`,
      [parentId, exceptId, slugs],
    )) as { nameVi: string }[];
    if (clash) {
      throw new ConflictException(
        `Đã có danh mục "${clash.nameVi}" cùng tên ở cấp này.`,
      );
    }
  }
}
