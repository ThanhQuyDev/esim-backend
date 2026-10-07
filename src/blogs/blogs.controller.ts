import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Headers,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { BlogEditor, BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Blog } from './domain/blog';
import { BlogListItem } from './domain/blog-list-item';
import { AuthGuard } from '@nestjs/passport';
import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from '../utils/dto/infinity-pagination-response.dto';
import { infinityPagination } from '../utils/infinity-pagination';
import { FilterBlogDto, QueryBlogDto } from './dto/find-all-blogs.dto';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { AuthorsService } from '../authors/authors.service';

@ApiTags('Blogs')
@Controller({
  path: 'blogs',
  version: '1',
})
export class BlogsController {
  constructor(
    private readonly blogsService: BlogsService,
    private readonly authorsService: AuthorsService,
  ) {}

  @ApiBearerAuth()
  @Roles(RoleEnum.admin, RoleEnum.author)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  @ApiCreatedResponse({
    type: Blog,
  })
  create(
    @Body() createBlogDto: CreateBlogDto,
    @Request() request: { user: EditorUser },
  ) {
    return this.blogsService.create(createBlogDto, toEditor(request.user));
  }

  @Get()
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description:
      'Language filter (e.g. "en", "vi"). Returns blogs for that language only.',
  })
  @ApiOkResponse({
    type: InfinityPaginationResponse(BlogListItem),
  })
  async findAll(
    @Query() query: QueryBlogDto,
    @Headers('x-custom-lang') lang?: string,
  ): Promise<InfinityPaginationResponseDto<BlogListItem>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const filterOptions = {
      ...query?.filters,
      search: query?.search || query?.filters?.search,
    };

    const [data, count] = await this.blogsService.findAllWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      lang,
      paginationOptions: {
        page,
        limit,
      },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  /**
   * The CMS blog list (#011). Same as the public list, except an author only
   * ever gets their own posts — the scope is set here, not by the client.
   */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin, RoleEnum.author)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('manage')
  @ApiOkResponse({ type: InfinityPaginationResponse(BlogListItem) })
  async findAllForCms(
    @Query() query: QueryBlogDto,
    @Request() request: { user: EditorUser },
    @Headers('x-custom-lang') lang?: string,
  ): Promise<InfinityPaginationResponseDto<BlogListItem>> {
    const page = query?.page ?? 1;
    const limit = Math.min(query?.limit ?? 10, 50);
    const editor = toEditor(request.user);

    const filterOptions: FilterBlogDto = {
      ...query?.filters,
      search: query?.search || query?.filters?.search,
    };
    if (Number(editor.roleId) !== RoleEnum.admin) {
      const own = await this.blogsService.findOwnAuthorProfile(editor.id);
      // No profile yet means no posts yet — never fall back to everything.
      filterOptions.ownerAuthorProfileId = own?.id ?? -1;
    }

    const [data, count] = await this.blogsService.findAllWithPagination({
      filterOptions,
      sortOptions: query?.sort,
      lang,
      paginationOptions: { page, limit },
    });

    return infinityPagination(data, { page, limit }, count);
  }

  /** Every author profile, for the admin's "Tác giả" select box (#011). */
  @ApiBearerAuth()
  @Roles(RoleEnum.admin)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('author-profiles')
  findAuthorProfiles() {
    return this.blogsService.findAuthorProfiles();
  }

  @Get('categories')
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description:
      'Language filter (e.g. "en", "vi"). Returns categories for that language only.',
  })
  @ApiOkResponse({
    type: [String],
  })
  findCategories(@Headers('x-custom-lang') lang?: string): Promise<string[]> {
    return this.blogsService.findCategories(lang);
  }

  @Get('parents')
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description:
      'Language filter (e.g. "en", "vi"). Returns parents for that language only.',
  })
  @ApiOkResponse({
    description: 'Returns parents grouped by category',
  })
  findParentsByCategory(
    @Headers('x-custom-lang') lang?: string,
  ): Promise<Record<string, string[]>> {
    return this.blogsService.findParentsByCategory(lang);
  }

  /**
   * Authors that have articles, for the CMS filter's select box (#046). Declared
   * before `authors/:slug` for readability; the two paths differ in depth, so
   * neither shadows the other.
   */
  @Get('authors')
  @ApiHeader({
    name: 'x-custom-lang',
    required: false,
    description:
      'Language filter (e.g. "en", "vi"). Returns authors for that language only.',
  })
  @ApiOkResponse({
    description: 'Returns [{ slug, name }] for every author that has articles',
  })
  findAuthorOptions(
    @Headers('x-custom-lang') lang?: string,
  ): Promise<{ slug: string; name: string }[]> {
    return this.blogsService.findAuthorOptions(lang);
  }

  @Get('authors/:slug')
  async findAuthor(@Param('slug') slug: string) {
    // Falls back to a byline for articles that predate author profiles (#030).
    const author = await this.blogsService.findAuthorBySlug(slug);
    if (!author) throw new NotFoundException();
    return author;
  }

  @Get('by-slug/:slug')
  @ApiParam({
    name: 'slug',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Blog,
  })
  async findBySlug(@Param('slug') slug: string) {
    const blog = await this.blogsService.findBySlug(slug);
    if (!blog) throw new NotFoundException();
    return blog;
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Blog,
  })
  findById(@Param('id') id: string) {
    return this.blogsService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin, RoleEnum.author)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  @ApiOkResponse({
    type: Blog,
  })
  update(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @Request() request: { user: EditorUser },
  ) {
    return this.blogsService.update(id, updateBlogDto, toEditor(request.user));
  }

  @ApiBearerAuth()
  @Roles(RoleEnum.admin, RoleEnum.author)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: String,
    required: true,
  })
  remove(@Param('id') id: string, @Request() request: { user: EditorUser }) {
    return this.blogsService.remove(id, toEditor(request.user));
  }
}

type EditorUser = { id: number | string; role?: { id?: number | string } };

function toEditor(user: EditorUser): BlogEditor {
  return { id: Number(user.id), roleId: user.role?.id ?? null };
}
