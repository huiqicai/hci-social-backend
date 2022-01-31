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
import { Prisma as PrismaService } from '../../services';
import { apiAttributesToPrisma, attributeSchema, userSelectFields } from '../../utils';

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

const modifyUserSchema = baseUserSchema;

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
  prisma: PrismaService

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
    const query = ctx.request.query as FindUsersSchema;

    const where: Prisma.UserWhereInput = {
      email: query.email,
      AND: apiAttributesToPrisma(query.attributes)
    };
    
    const res = await this.prisma.client.$transaction([
      this.prisma.client.user.findMany({
        select: userSelectFields,
        skip: query.skip,
        take: query.take,
        where
      }),
      this.prisma.client.user.count({where})
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
    const params = ctx.request.params as {userId: number};
    const user = await this.prisma.client.user.findUnique({
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
    const body = ctx.request.body as CreateUserSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const user = await this.prisma.client.user.create({
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
    const params = ctx.request.params as { userId: number };
    const body = ctx.request.body as ModifyUserSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const user = await this.prisma.client.user.update({
        select: userSelectFields,
        where: { id: params.userId },
        data: { email: body.email, attributes }
      });
  
      return new HttpResponseOK(user);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
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
  async deleteUser(ctx: Context) {
    const params = ctx.request.params as { userId: number };

    try {
      await this.prisma.client.user.delete({
        where: { id: params.userId }
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
  