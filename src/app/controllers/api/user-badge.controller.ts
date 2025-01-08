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
import { apiAttributesToPrisma, attributeSchema, userSelectFields } from '../../utils';

const baseUserBadgeSchema = {
  additionalProperties: false,
  properties: {
    userID: { type: 'number' },
    badgeID: { type: 'number' }
  },
  required: [],
  type: 'object',
} as const;

const findUserBadgesSchema = {
  ...baseUserBadgeSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseUserBadgeSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' }
   
  }
} as const;

type FindUserBadgesSchema = JTDDataType<typeof findUserBadgesSchema>;

const createUserBadgeSchema = {
  ...baseUserBadgeSchema,
  required: ['userID', 'badgeID']
} as const;

type CreateUserBadgeSchema = JTDDataType<typeof createUserBadgeSchema>;

const modifyUserBadgeSchema = baseUserBadgeSchema;

type ModifyUserBadgeSchema = JTDDataType<typeof modifyUserBadgeSchema>;

@ApiDefineTag({
  name: 'User Badge',
  description: 'This will allow you to add or remove badges from users'
})
@ApiUseTag('User Badge')
export class UserBadgeController {
  @dependency
  db: DB;

  @Get()
  @ApiOperationId('findUserBadges')
  @ApiOperationSummary('Find User Badges.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of User Badges.' })
  @ParseAttributes()
  @ValidateQuery(findUserBadgesSchema)
  async findUserBadges(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const query = ctx.request.query as FindUserBadgesSchema;

    const where: Prisma.UserBadgeWhereInput = {
      userID: query.userID,
      badgeID: query.badgeID
    };

    const res = await this.db.getClient(params.tenantId).$transaction([
      this.db.getClient(params.tenantId).userBadge.findMany({
        include: {
          user: {
            select: userSelectFields
          },
          badge: true
        },
        skip: query.skip,
        take: query.take,
        where
      }),
      this.db.getClient(params.tenantId).userBadge.count({where})
    ])
    
    return new HttpResponseOK(res);
  }

  @Get('/:UserBadgeId')
  @ApiOperationId('findUserBadgeById')
  @ApiOperationSummary('Find a User Badge by ID.')
  @ApiResponse(404, { description: 'User Badge not found.' })
  @ApiResponse(200, { description: 'Returns the User Badge.' })
  @ValidatePathParam('UserBadgeId', { type: 'number' })
  async findUserBadgeById(ctx: Context) {
    const params = ctx.request.params as {UserBadgeId: number, tenantId: string};
    const UserBadge = await this.db.getClient(params.tenantId).userBadge.findUnique({
      include: {
        user: {
          select: userSelectFields
        },
        badge: true
      },
      where: { id: params.UserBadgeId }
    });

    if (!UserBadge) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(UserBadge);
  }

  @Post()
  @ApiOperationId('createUserBadge')
  @ApiOperationSummary('Create a new User Badge.')
  @ApiResponse(400, { description: 'Invalid User Badge.' })
  @ApiResponse(201, { description: 'User Badge successfully created. Returns the User Badge.' })
  @UserRequired()
  @ValidateBody(createUserBadgeSchema)
  async createUserBadge(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const body = ctx.request.body as CreateUserBadgeSchema;
   

    const UserBadge = await this.db.getClient(params.tenantId).userBadge.create({
      include: {
        user: {
          select: userSelectFields
        },
        badge: true
      },
      data: {
        userID: body.userID,
        badgeID: body.badgeID
      }
    });
    return new HttpResponseCreated(UserBadge);
  }

  @Patch('/:UserBadgeId')
  @ApiOperationId('modifyUserBadge')
  @ApiOperationSummary('Update/modify an existing User Badge.')
  @ApiResponse(400, { description: 'Invalid User Badge.' })
  @ApiResponse(404, { description: 'User Badge not found.' })
  @ApiResponse(200, { description: 'User Badge successfully updated. Returns the User Badge.' })
  @UserRequired()
  @ValidatePathParam('UserBadgeId', { type: 'number' })
  @ValidateBody(modifyUserBadgeSchema)
  async modifyUserBadge(ctx: Context) {
    const params = ctx.request.params as { UserBadgeId: number, tenantId: string };
    const body = ctx.request.body as ModifyUserBadgeSchema;
   
    try {
      const UserBadge = await this.db.getClient(params.tenantId).userBadge.update({
        include: {
          user: {
            select: userSelectFields
          },
          badge: true
        },
        where: { id: params.UserBadgeId },
        data: {
          userID: body.userID,
          badgeID: body.badgeID
        }
      });
  
      return new HttpResponseOK(UserBadge);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:UserBadgeId')
  @ApiOperationId('deleteUserBadge')
  @ApiOperationSummary('Delete a User Badge.')
  @ApiResponse(404, { description: 'User Badge not found.' })
  @ApiResponse(204, { description: 'User Badge successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('UserBadgeId', { type: 'number' })
  async deleteUserBadge(ctx: Context) {
    const params = ctx.request.params as { UserBadgeId: number, tenantId: string };

    try {
      await this.db.getClient(params.tenantId).userBadge.delete({
        where: { id: params.UserBadgeId }
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
