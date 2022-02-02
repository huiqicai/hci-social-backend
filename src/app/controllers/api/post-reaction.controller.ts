import {
  ApiDefineTag,
  ApiOperationDescription, ApiOperationId, ApiOperationSummary, ApiResponse,
  ApiUseTag, Context, Delete, dependency, Get, HttpResponseCreated,
  HttpResponseNoContent, HttpResponseNotFound, HttpResponseOK, Patch, Post,
  UserRequired, ValidateBody, ValidatePathParam
} from '@foal/core';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { ValidateQuery } from '../../hooks';
import { JTDDataType } from '../../jtd';
import { DB } from '../../services';
import { apiAttributesToPrisma, attributeSchema, userSelectFields } from '../../utils';

const basePostReactionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    postID: { type: 'number' },
    reactorID: {
      type: 'number',
      description: 'The user that added the reaction/that the reaction is applicable for.'
    },
    name: {
      type: 'string',
      description: 'Implementation specific field for the reaction itself; this might be "like" or "sad" or "rating"'
    },
    value: {
      type: 'number',
      description: 'Numeric value to attach to this reaction, if applicable. This allows for filtering posts by aggregated metrics, like average rating or total likes'
    },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: []
} as const;

const findPostReactionsSchema = {
  ...basePostReactionSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...basePostReactionSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    valueLessThan: { type: 'number' },
    valueLessThanOrEqual: { type: 'number' },
    valueGreaterThan: { type: 'number' },
    valueGreaterThanOrEqual: { type: 'number' },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindPostReactionsSchema = JTDDataType<typeof findPostReactionsSchema>;

const createPostReactionSchema = {
  ...basePostReactionSchema,
  required: ['postID', 'reactorID', 'name']
} as const;

type CreatePostReactionSchema = JTDDataType<typeof createPostReactionSchema>;

const modifyPostReactionSchema = basePostReactionSchema;

type ModifyPostReactionSchema = JTDDataType<typeof modifyPostReactionSchema>;

@ApiDefineTag({
  name: 'Post Reaction',
  description: 'This is an implementation specific dataset that will handle any data which involves both a post and a specific user. ' +
    'This could be like/dislike, rating, or so forth'
})
@ApiUseTag('Post Reaction')
export class PostReactionController {
  @dependency
  db: DB;

  @Get()
  @ApiOperationId('findPostReactions')
  @ApiOperationSummary('Find post reactions.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of post reactions.' })
  @ValidateQuery(findPostReactionsSchema)
  async findPostReactions(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const query = ctx.request.query as FindPostReactionsSchema;

    const where: Prisma.PostReactionWhereInput = {
      postID: query.postID,
      reactorID: query.reactorID,
      name: query.name,
      value: {
        equals: query.value,
        lt: query.valueLessThan,
        lte: query.valueLessThanOrEqual,
        gt: query.valueGreaterThan,
        gte: query.valueGreaterThanOrEqual
      },
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.db.getClient(params.tenantId).$transaction([
      this.db.getClient(params.tenantId).postReaction.findMany({
        include: {
          post: true,
          reactor: {
            select: userSelectFields
          }
        },
        skip: query.skip,
        take: query.take,
        where
      }),
      this.db.getClient(params.tenantId).postReaction.count({where})
    ]);

    return new HttpResponseOK(res);
  }

  @Get('/:postReactionId')
  @ApiOperationId('findPostReactionById')
  @ApiOperationSummary('Find a post reaction by ID.')
  @ApiResponse(404, { description: 'Post reaction not found.' })
  @ApiResponse(200, { description: 'Returns the post reaction.' })
  @ValidatePathParam('postReactionId', { type: 'number' })
  async findPostReactionById(ctx: Context) {
    const params = ctx.request.params as {postReactionId: number, tenantId: string};
    const postReaction = await this.db.getClient(params.tenantId).postReaction.findUnique({
      include: {
        post: true,
        reactor: {
          select: userSelectFields
        }
      },
      where: { id: params.postReactionId }
    });

    if (!postReaction) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(postReaction);
  }

  @Post()
  @ApiOperationId('createPostReaction')
  @ApiOperationSummary('Create a new post reaction.')
  @ApiResponse(400, { description: 'Invalid post reaction.' })
  @ApiResponse(201, { description: 'Post reaction successfully created. Returns the post reaction.' })
  @UserRequired()
  @ValidateBody(createPostReactionSchema)
  async createPostReaction(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const body = ctx.request.body as CreatePostReactionSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const postReaction = await this.db.getClient(params.tenantId).postReaction.create({
      include: {
        post: true,
        reactor: {
          select: userSelectFields
        }
      },
      data: {
        postID: body.postID,
        reactorID: body.reactorID,
        name: body.name,
        value: body.value,
        attributes
      }
    });

    return new HttpResponseCreated(postReaction);
  }

  @Patch('/:postReactionId')
  @ApiOperationId('modifyPostReaction')
  @ApiOperationSummary('Update/modify an existing post reaction.')
  @ApiResponse(400, { description: 'Invalid post reaction.' })
  @ApiResponse(404, { description: 'Post reaction not found.' })
  @ApiResponse(200, { description: 'Post reaction successfully updated. Returns the post reaction.' })
  @UserRequired()
  @ValidatePathParam('postReactionId', { type: 'number' })
  @ValidateBody(modifyPostReactionSchema)
  async modifyPostReaction(ctx: Context) {
    const params = ctx.request.params as { postReactionId: number, tenantId: string };
    const body = ctx.request.body as ModifyPostReactionSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const postReaction = await this.db.getClient(params.tenantId).postReaction.update({
        include: {
          post: true,
          reactor: {
            select: userSelectFields
          }
        },
        where: { id: params.postReactionId },
        data: {
          postID: body.postID,
          reactorID: body.reactorID,
          name: body.name,
          value: body.value,
          attributes
        }
      });
  
      return new HttpResponseOK(postReaction);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:postReactionId')
  @ApiOperationId('deletePostReaction')
  @ApiOperationSummary('Delete a post reaction.')
  @ApiResponse(404, { description: 'Post reaction not found.' })
  @ApiResponse(204, { description: 'Post reaction successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('postReactionId', { type: 'number' })
  async deletePostReaction(ctx: Context) {
    const params = ctx.request.params as { postReactionId: number, tenantId: string };

    try {
      await this.db.getClient(params.tenantId).postReaction.delete({
        where: { id: params.postReactionId }
      });

      return new HttpResponseNoContent();
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to delete not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }
}
