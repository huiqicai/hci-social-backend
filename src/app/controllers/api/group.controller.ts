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
import { Prisma as PrismaService } from '../../services';
import { apiAttributesToPrisma, attributeSchema } from '../../utils';

const baseGroupSchema = {
  additionalProperties: false,
  properties: {
    name: {
      description: 'Implementation specific field to store the name of this particular group',
      type: 'string'
    },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: [],
  type: 'object',
} as const;

const findGroupsSchema = {
  ...baseGroupSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseGroupSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindGroupsSchema = JTDDataType<typeof findGroupsSchema>;

const createGroupSchema = {
  ...baseGroupSchema,
  required: ['name']
} as const;

type CreateGroupSchema = JTDDataType<typeof createGroupSchema>;

const modifyGroupSchema = baseGroupSchema;

type ModifyGroupSchema = JTDDataType<typeof modifyGroupSchema>;

@ApiDefineTag({
  name: 'Group',
  description: 'If your platform supports groups, they can be created and managed through the groups API. ' +
    'This might be creating special interest groups among friends, or invite lists to events, or ' +
    ' security groups for post visibility, or all of the above!'
})
@ApiUseTag('Group')
export class GroupController {
  @dependency
  prisma: PrismaService;

  @Get()
  @ApiOperationId('findGroups')
  @ApiOperationSummary('Find groups.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of groups.' })
  @ValidateQuery(findGroupsSchema)
  async findGroups(ctx: Context) {
    const query = ctx.request.query as FindGroupsSchema;

    const where: Prisma.GroupWhereInput = {
      name: query.name,
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.prisma.client.$transaction([
      this.prisma.client.group.findMany({
        skip: query.skip,
        take: query.take,
        where
      }),
      this.prisma.client.group.count({where})
    ]);
    
    return new HttpResponseOK(res);
  }

  @Get('/:groupId')
  @ApiOperationId('findGroupById')
  @ApiOperationSummary('Find a group by ID.')
  @ApiResponse(404, { description: 'Group not found.' })
  @ApiResponse(200, { description: 'Returns the group.' })
  @ValidatePathParam('groupId', { type: 'number' })
  async findGroupById(ctx: Context) {
    const params = ctx.request.params as {groupId: number};
    const group = await this.prisma.client.group.findUnique({
      where: { id: params.groupId }
    });

    if (!group) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(group);
  }

  @Post()
  @ApiOperationId('createGroup')
  @ApiOperationSummary('Create a new group.')
  @ApiResponse(400, { description: 'Invalid group.' })
  @ApiResponse(201, { description: 'Group successfully created. Returns the group.' })
  @UserRequired()
  @ValidateBody(createGroupSchema)
  async createGroup(ctx: Context) {
    const body = ctx.request.body as CreateGroupSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const group = await this.prisma.client.group.create({
      data: {
        name: body.name,
        attributes
      }
    });

    return new HttpResponseCreated(group);
  }

  @Patch('/:groupId')
  @ApiOperationId('modifyGroup')
  @ApiOperationSummary('Update/modify an existing group.')
  @ApiResponse(400, { description: 'Invalid group.' })
  @ApiResponse(404, { description: 'Group not found.' })
  @ApiResponse(200, { description: 'Group successfully updated. Returns the group.' })
  @UserRequired()
  @ValidatePathParam('groupId', { type: 'number' })
  @ValidateBody(modifyGroupSchema)
  async modifyGroup(ctx: Context) {
    const params = ctx.request.params as { groupId: number };
    const body = ctx.request.body as ModifyGroupSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const group = await this.prisma.client.group.update({
        where: { id: params.groupId },
        data: { name: body.name, attributes }
      });
  
      return new HttpResponseOK(group);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:groupId')
  @ApiOperationId('deleteGroup')
  @ApiOperationSummary('Delete a group.')
  @ApiResponse(404, { description: 'Group not found.' })
  @ApiResponse(204, { description: 'Group successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('groupId', { type: 'number' })
  async deleteGroup(ctx: Context) {
    const params = ctx.request.params as { groupId: number };

    try {
      await this.prisma.client.group.delete({
        where: { id: params.groupId }
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
