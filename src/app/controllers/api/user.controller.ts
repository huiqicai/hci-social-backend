import {
  ApiDefineTag,
  ApiOperationDescription, ApiOperationId, ApiOperationSummary, ApiResponse,
  ApiUseTag, Context, Delete, dependency, Get, hashPassword, HttpResponseCreated,
  HttpResponseNoContent, HttpResponseNotFound, HttpResponseOK, Patch, Post,
  UserRequired, ValidateBody, ValidatePathParam
} from '@foal/core';
import { Prisma } from '@prisma/client';
import { ParseAttributes, ValidateQuery } from '../../hooks';
import { ValidateQueryParamWithDoc } from '../../hooks/validate-query-param-with-doc';
import { JTDDataType } from '../../jtd';
import { DB } from '../../services';
import { apiAttributesToPrisma, attributeSchema, userSelectFields, SessionUser } from '../../utils';

enum RelatedObjectsAction {
  DELETE = 'delete',
  ANONYMIZE = 'anonymize'
}

const baseUserSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: { type: 'string' },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: []
} as const;

const findUsersSchema = {
  ...baseUserSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseUserSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    attributes: {
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindUsersSchema = JTDDataType<typeof findUsersSchema>;

const createUserSchema = {
  ...baseUserSchema,
  properties: {
    ...baseUserSchema.properties,
    password: { type: 'string' }
  },
  required: ['email', 'password']
} as const;

type CreateUserSchema = JTDDataType<typeof createUserSchema>;

const modifyUserSchema = {
  ...baseUserSchema,
  properties: {
    ...baseUserSchema.properties,
    password: { type: 'string' }
  }
} as const;

type ModifyUserSchema = JTDDataType<typeof modifyUserSchema>;

@ApiDefineTag({
  name: 'User',
  description: 'These are the registered users of the social media platform. This API endpoint will manage ' +
    'account creation and management by admins (self registration is done through the ' +
    '[Authentication](#/Authentication) api), profile updates, fetching user lists to add friends, etc.'
})
@ApiUseTag('User')
export class UserController {
  @dependency
  db: DB

  @Get()
  @ApiOperationId('findUsers')
  @ApiOperationSummary('Find users.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of users.' })
  @ParseAttributes()
  @ValidateQuery(findUsersSchema)
  async findUsers(ctx: Context) {
    const params = ctx.request.params as { tenantId: string };
    const query = ctx.request.query as FindUsersSchema;

    const where: Prisma.UserWhereInput = {
      email: query.email,
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.db.getClient(params.tenantId).$transaction([
      this.db.getClient(params.tenantId).user.findMany({
        select: userSelectFields,
        skip: query.skip,
        take: query.take,
        where
      }),
      this.db.getClient(params.tenantId).user.count({ where })
    ])

    return new HttpResponseOK(res);
  }

  @Get('/:userId')
  @ApiOperationId('findUserById')
  @ApiOperationSummary('Find a user by ID.')
  @ApiResponse(404, { description: 'User not found.' })
  @ApiResponse(200, { description: 'Returns the user.' })
  @ValidatePathParam('userId', { type: 'number' })
  async findUserById(ctx: Context) {
    const params = ctx.request.params as { userId: number, tenantId: string };
    const user = await this.db.getClient(params.tenantId).user.findUnique({
      select: userSelectFields,
      where: { id: params.userId }
    });

    if (!user) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(user);
  }

  @Post()
  @ApiOperationId('createUser')
  @ApiOperationSummary('Create a new user.')
  @ApiResponse(400, { description: 'Invalid user.' })
  @ApiResponse(201, { description: 'User successfully created. Returns the user.' })
  @UserRequired()
  @ValidateBody(createUserSchema)
  async createUser(ctx: Context) {
    const params = ctx.request.params as { tenantId: string };
    const body = ctx.request.body as CreateUserSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const user = await this.db.getClient(params.tenantId).user.create({
      select: userSelectFields,
      data: {
        email: body.email,
        password: body.password,
        attributes
      }
    });

    return new HttpResponseCreated(user);
  }

  @Patch('/:userId')
  @ApiOperationId('modifyUser')
  @ApiOperationSummary('Update/modify an existing user.')
  @ApiResponse(400, { description: 'Invalid user.' })
  @ApiResponse(404, { description: 'User not found.' })
  @ApiResponse(200, { description: 'User successfully updated. Returns the user.' })
  @UserRequired()
  @ValidatePathParam('userId', { type: 'number' })
  @ValidateBody(modifyUserSchema)
  async modifyUser(ctx: Context) {
    const params = ctx.request.params as { userId: number, tenantId: string };
    const body = ctx.request.body as ModifyUserSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const user = await this.db.getClient(params.tenantId).user.update({
        select: userSelectFields,
        where: { id: params.userId },
        data: {
          email: body.email,
          attributes,
          password: body.password ? await hashPassword(body.password) : undefined
        }
      });

      return new HttpResponseOK(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:userId')
  @ApiOperationId('deleteUser')
  @ApiOperationSummary('Delete a user.')
  @ApiResponse(404, { description: 'User not found.' })
  @ApiResponse(400, { description: 'Unable to delete (eg, user artifacts needing deletion).' })
  @ApiResponse(204, { description: 'User successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('userId', { type: 'number' })
  @ValidateQueryParamWithDoc(
    'relatedObjectsAction', { enum: Object.values(RelatedObjectsAction) }, {
    required: true,
    description: 'If set to delete, the following will be deleted (or if anonymize, the user ID will be set to null): '
      + 'posts where the user is the author, post reactions where the author is the reactor, amd files where the user is the uploader'
  }
  )
  async deleteUser(ctx: Context<SessionUser>) {
    const params = ctx.request.params as { userId: number, tenantId: string };
    const query = ctx.request.query as { relatedObjectsAction: RelatedObjectsAction };

    // If the user being deleted is the one making this request, we need to ensure the session tied with
    // the current request is destroyed, otherwise when the session is committed at the end of this request,
    // it would try to commit with the ID of a user which no longer exists, resulting in a foreign key error/violation
    // when saving to the database (as, again, that ID is invalid and would not point to a valid row)
    if (ctx.user?.id === params.userId) {
      await ctx.session?.destroy();
    }

    try {
      if (query.relatedObjectsAction === RelatedObjectsAction.DELETE) {
        await this.db.getClient(params.tenantId).post.deleteMany({
          where: { authorID: params.userId }
        });
        await this.db.getClient(params.tenantId).postReaction.deleteMany({
          where: { reactorID: params.userId }
        });
        await this.db.getClient(params.tenantId).file.deleteMany({
          where: { uploaderID: params.userId }
        });

        // This deletes the chat room memberships 
        await this.db.getClient(params.tenantId).chatRoomMembership.deleteMany({
          where: { userId: params.userId } // Passing in the user ID 
        });

        // This delete s the messages sent by the user 
        await this.db.getClient(params.tenantId).message.deleteMany({
          where: { fromUserId: params.userId }
        });
      }
      await this.db.getClient(params.tenantId).user.delete({
        where: { id: params.userId }
      });
      return new HttpResponseNoContent();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Record to delete not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }
}
