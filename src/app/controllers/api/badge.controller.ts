import {
  ApiDefineTag,
  ApiOperationDescription, ApiOperationId, ApiOperationSummary, ApiResponse,
  ApiUseTag, Context, Delete, dependency, Get, HttpResponseCreated,
  HttpResponseNoContent, HttpResponseNotFound, HttpResponseOK, Patch, Post,
  UserRequired, ValidateBody, ValidatePathParam
} from '@foal/core';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { ParseAttributes, ValidateQuery } from '../../hooks';
import { JTDDataType } from '../../jtd';
import { DB } from '../../services';
import { apiAttributesToPrisma, attributeSchema } from '../../utils';

const baseBadgeSchema = {
  additionalProperties: false,
  properties: {
    name: {
      description: 'Implementation specific field to store the name of this particular badge',
      type: 'string'
    },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: [],
  type: 'object',
} as const;

const findBadgesSchema = {
  ...baseBadgeSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseBadgeSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindBadgesSchema = JTDDataType<typeof findBadgesSchema>;

const createBadgeSchema = {
  ...baseBadgeSchema,
  required: ['name']
} as const;

type CreateBadgeSchema = JTDDataType<typeof createBadgeSchema>;

const modifyBadgeSchema = baseBadgeSchema;

type ModifyBadgeSchema = JTDDataType<typeof modifyBadgeSchema>;

@ApiDefineTag({
  name: 'Badge',
  description: 'If your platform supports badges, they can be created and managed through the badges API. ' +
    'This might be creating achievements, or awards'
})
@ApiUseTag('Badge')
export class BadgeController {
  @dependency
  db: DB;

  @Get()
  @ApiOperationId('findBadges')
  @ApiOperationSummary('Find badges.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of badges.' })
  @ParseAttributes()
  @ValidateQuery(findBadgesSchema)
  async findBadges(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const query = ctx.request.query as FindBadgesSchema;

    const where: Prisma.BadgeWhereInput = {
      name: query.name,
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.db.getClient(params.tenantId).$transaction([
      this.db.getClient(params.tenantId).badge.findMany({
        skip: query.skip,
        take: query.take,
        where
      }),
      this.db.getClient(params.tenantId).badge.count({where})
    ]);
    
    return new HttpResponseOK(res);
  }

  @Get('/:badgeId')
  @ApiOperationId('findBadgeById')
  @ApiOperationSummary('Find a badge by ID.')
  @ApiResponse(404, { description: 'Badge not found.' })
  @ApiResponse(200, { description: 'Returns the badge.' })
  @ValidatePathParam('badgeId', { type: 'number' })
  async findBadgeById(ctx: Context) {
    const params = ctx.request.params as {badgeId: number, tenantId: string};
    const badge = await this.db.getClient(params.tenantId).badge.findUnique({
      where: { id: params.badgeId }
    });

    if (!badge) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(badge);
  }

  @Post()
  @ApiOperationId('createBadge')
  @ApiOperationSummary('Create a new badge.')
  @ApiResponse(400, { description: 'Invalid badge.' })
  @ApiResponse(201, { description: 'Badge successfully created. Returns the badge.' })
  @UserRequired()
  @ValidateBody(createBadgeSchema)
  async createBadge(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const body = ctx.request.body as CreateBadgeSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const badge = await this.db.getClient(params.tenantId).badge.create({
      data: {
        name: body.name,
        attributes
      }
    });

    return new HttpResponseCreated(badge);
  }

  @Patch('/:badgeId')
  @ApiOperationId('modifyBadge')
  @ApiOperationSummary('Update/modify an existing badge.')
  @ApiResponse(400, { description: 'Invalid badge.' })
  @ApiResponse(404, { description: 'Badge not found.' })
  @ApiResponse(200, { description: 'Badge successfully updated. Returns the badge.' })
  @UserRequired()
  @ValidatePathParam('badgeId', { type: 'number' })
  @ValidateBody(modifyBadgeSchema)
  async modifyBadge(ctx: Context) {
    const params = ctx.request.params as { badgeId: number, tenantId: string };
    const body = ctx.request.body as ModifyBadgeSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const badge = await this.db.getClient(params.tenantId).badge.update({
        where: { id: params.badgeId },
        data: { name: body.name, attributes }
      });
  
      return new HttpResponseOK(badge);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:badgeId')
  @ApiOperationId('deleteBadge')
  @ApiOperationSummary('Delete a badge.')
  @ApiResponse(404, { description: 'Badge not found.' })
  @ApiResponse(204, { description: 'Badge successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('badgeId', { type: 'number' })
  async deleteBadge(ctx: Context) {
    const params = ctx.request.params as { badgeId: number, tenantId: string };

    try {
      await this.db.getClient(params.tenantId).badge.delete({
        where: { id: params.badgeId }
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
