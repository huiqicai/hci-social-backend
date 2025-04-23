import {
  ApiDefineTag,
  ApiOperationDescription, ApiOperationId, ApiOperationSummary, ApiResponse,
  ApiUseTag, Context, Delete, dependency, Get, HttpResponseCreated,
  HttpResponseNoContent, HttpResponseNotFound, HttpResponseOK, Patch, Post as HTTPPost,
  UserRequired, ValidateBody, ValidatePathParam
} from '@foal/core';
import { Prisma } from '@prisma/client';
import { ParseAttributes, ValidateQuery } from '../../hooks';
import { JTDDataType } from '../../jtd';
import { DB } from '../../services';
import { apiAttributesToPrisma, attributeSchema, userSelectFields } from '../../utils';

enum Sort {
  OLDEST = 'oldest',
  NEWEST = 'newest'
}

const basePostSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    authorID: { type: 'number' },
    parentID: {
      description: 'If this post is a comment, the id of the parent post that you are commenting on.',
      oneOf: [{ type: 'number' }, { type: 'null' }]
    },
    content: { type: 'string' },
    recipientUserID: {
      description: 'If this post is intended to go to a specific user (eg, as a direct message), the id of the user it is directed to.',
      oneOf: [{ type: 'number' }, { type: 'null' }]
    },
    recipientGroupID: {
      description: 'If this post is intended to go to a specific group (eg, as a group message), the id of the group it is directed to.',
      oneOf: [{ type: 'number' }, { type: 'null' }]
    },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: []
} as const;

const findPostsSchema = {
  ...basePostSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...basePostSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    sort: { enum: Object.values(Sort), default: Sort.NEWEST },
    contentContains: { type: 'string' },
    contentStartsWith: { type: 'string' },
    contentEndsWith: { type: 'string' },
    authorIDIn: {
      type: 'array',
      items: { type: 'number' },
      description: 'Return will include posts from all of the authors with the passed IDs'
    },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindPostsSchema = JTDDataType<typeof findPostsSchema>;

const createPostSchema = {
  ...basePostSchema,
  required: ['authorID']
} as const;

type CreatePostSchema = JTDDataType<typeof createPostSchema>;

const modifyPostSchema = basePostSchema;

type ModifyPostSchema = JTDDataType<typeof modifyPostSchema>;

@ApiDefineTag({
  name: 'Post',
  description: 'The heart of any social media site is the posts that the users create. This dataset will contain ' +
    'the post data, and also any comments for those posts. This is handled in the DB via the Materialized Path ' +
    'pattern (aka Path Enumeration) where a path is stored on each post noting its chain of ancestors. ' +
    'For more information, see https://www.slideshare.net/billkarwin/models-for-hierarchical-data. ' +
    'Tags (like, +1, etc) will be handled separately (Post Tags).'
})
@ApiUseTag('Post')
export class PostController {
  @dependency
  db: DB;

  @Get()
  @ApiOperationId('findPosts')
  @ApiOperationSummary('Find posts.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of posts.' })
  @ParseAttributes()
  @ValidateQuery(findPostsSchema)
  async findPosts(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const query = ctx.request.query as FindPostsSchema;
    
    const where: Prisma.PostWhereInput = {
      authorID: {
        equals: query.authorID,
        in: query.authorIDIn
      },
      content: {
        equals: query.content,
        contains: query.contentContains,
        startsWith: query.contentStartsWith,
        endsWith: query.contentEndsWith,
      },
      // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
      parentID: query.parentID as number | undefined | null,
      recipientUserID: query.recipientUserID as number | undefined | null,
      recipientGroupID: query.recipientGroupID as number | undefined | null,
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.db.getClient(params.tenantId).$transaction([
      this.db.getClient(params.tenantId).post.findMany({
        include: {
          author: {
            select: userSelectFields
          },
          recipientUser: {
            select: userSelectFields
          },
          recipientGroup: true,
          reactions: true,
          _count: {
            select: { children: true }
          }
        },
        skip: query.skip,
        take: query.take,
        orderBy: {
          created: query.sort === Sort.OLDEST ? Prisma.SortOrder.asc : Prisma.SortOrder.desc
        },
        where
      }),
      this.db.getClient(params.tenantId).post.count({where})
    ])

    return new HttpResponseOK(res);
  }

  @Get('/:postId')
  @ApiOperationId('findPostById')
  @ApiOperationSummary('Find a post by ID.')
  @ApiResponse(404, { description: 'Post not found.' })
  @ApiResponse(200, { description: 'Returns the post.' })
  @ValidatePathParam('postId', { type: 'number' })
  async findPostById(ctx: Context) {
    const params = ctx.request.params as {postId: number, tenantId: string};
    const post = await this.db.getClient(params.tenantId).post.findUnique({
      include: {
        author: {
          select: userSelectFields
        },
        recipientUser: {
          select: userSelectFields
        },
        recipientGroup: true,
        reactions: true,
        _count: {
          select: { children: true }
        }
      },
      where: { id: params.postId }
    });

    if (!post) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(post);
  }

  @HTTPPost()
  @ApiOperationId('createPost')
  @ApiOperationSummary('Create a new post.')
  @ApiResponse(400, { description: 'Invalid post.' })
  @ApiResponse(201, { description: 'Post successfully created. Returns the post.' })
  @UserRequired()
  @ValidateBody(createPostSchema)
  async createPost(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const body = ctx.request.body as CreatePostSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const post = await this.db.getClient(params.tenantId).post.create({
      include: {
        author: {
          select: userSelectFields
        },
        recipientUser: {
          select: userSelectFields
        },
        recipientGroup: true,
        reactions: true,
        _count: {
          select: { children: true }
        }
      },
      data: {
        authorID: body.authorID,
        content: body.content,
        // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
        parentID: body.parentID as number | undefined | null,
        recipientUserID: body.recipientUserID as number | undefined | null,
        recipientGroupID: body.recipientGroupID as number | undefined | null,
        attributes
      }
    });

    return new HttpResponseCreated(post);
  }

  @Patch('/:postId')
  @ApiOperationId('modifyPost')
  @ApiOperationSummary('Update/modify an existing post.')
  @ApiResponse(400, { description: 'Invalid post.' })
  @ApiResponse(404, { description: 'Post not found.' })
  @UserRequired()
  @ApiResponse(200, { description: 'Post successfully updated. Returns the post.' })
  @ValidatePathParam('postId', { type: 'number' })
  @ValidateBody(modifyPostSchema)
  async modifyPost(ctx: Context) {
    const params = ctx.request.params as { postId: number, tenantId: string };
    const body = ctx.request.body as ModifyPostSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const post = await this.db.getClient(params.tenantId).post.update({
        include: {
          author: {
            select: userSelectFields
          },
          recipientUser: {
            select: userSelectFields
          },
          recipientGroup: true,
          reactions: true,
          _count: {
            select: { children: true }
          }
        },
        where: { id: params.postId },
        data: {
          authorID: body.authorID,
          content: body.content,
          // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
          parentID: body.parentID as number | undefined | null,
          recipientUserID: body.recipientUserID as number | undefined | null,
          recipientGroupID: body.recipientGroupID as number | undefined | null,
          attributes
        }
      });
  
      return new HttpResponseOK(post);
    } catch(e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:postId')
  @ApiOperationId('deletePost')
  @ApiOperationSummary('Delete a post.')
  @ApiResponse(404, { description: 'Post not found.' })
  @ApiResponse(204, { description: 'Post successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('postId', { type: 'number' })
  async deletePost(ctx: Context) {
    const params = ctx.request.params as { postId: number, tenantId: string };

    try {
      await this.db.getClient(params.tenantId).post.delete({
        where: { id: params.postId }
      });

      return new HttpResponseNoContent();
    } catch(e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Record to delete not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

}
