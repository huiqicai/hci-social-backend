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
import { apiAttributesToPrisma, attributeSchema, userSelectFields } from '../../utils';

const baseGroupMemberSchema = {
  additionalProperties: false,
  properties: {
    userID: { type: 'number' },
    groupID: { type: 'number' },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: [],
  type: 'object',
} as const;

const findGroupMembersSchema = {
  ...baseGroupMemberSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseGroupMemberSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindGroupMembersSchema = JTDDataType<typeof findGroupMembersSchema>;

const createGroupMemberSchema = {
  ...baseGroupMemberSchema,
  required: ['userID', 'groupID']
} as const;

type CreateGroupMemberSchema = JTDDataType<typeof createGroupMemberSchema>;

const modifyGroupMemberSchema = baseGroupMemberSchema;

type ModifyGroupMemberSchema = JTDDataType<typeof modifyGroupMemberSchema>;

@ApiDefineTag({
  name: 'Group Member',
  description: 'This will allow you to add or remove members from groups'
})
@ApiUseTag('Group Member')
export class GroupMemberController {
  @dependency
  prisma: PrismaService;

  @Get()
  @ApiOperationId('findGroupMembers')
  @ApiOperationSummary('Find group members.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of group members.' })
  @ValidateQuery(findGroupMembersSchema)
  async findGroupMembers(ctx: Context) {
    const query = ctx.request.query as FindGroupMembersSchema;

    const where: Prisma.GroupMemberWhereInput = {
      userID: query.userID,
      groupID: query.groupID,
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.prisma.client.$transaction([
      this.prisma.client.groupMember.findMany({
        include: {
          user: {
            select: userSelectFields
          },
          group: true
        },
        skip: query.skip,
        take: query.take,
        where
      }),
      this.prisma.client.groupMember.count({where})
    ])
    
    return new HttpResponseOK(res);
  }

  @Get('/:groupMemberId')
  @ApiOperationId('findGroupMemberById')
  @ApiOperationSummary('Find a group member by ID.')
  @ApiResponse(404, { description: 'Group member not found.' })
  @ApiResponse(200, { description: 'Returns the group member.' })
  @ValidatePathParam('groupMemberId', { type: 'number' })
  async findGroupMemberById(ctx: Context) {
    const params = ctx.request.params as {groupMemberId: number};
    const groupMember = await this.prisma.client.groupMember.findUnique({
      include: {
        user: {
          select: userSelectFields
        },
        group: true
      },
      where: { id: params.groupMemberId }
    });

    if (!groupMember) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(groupMember);
  }

  @Post()
  @ApiOperationId('createGroupMember')
  @ApiOperationSummary('Create a new group member.')
  @ApiResponse(400, { description: 'Invalid group member.' })
  @ApiResponse(201, { description: 'Group member successfully created. Returns the group member.' })
  @UserRequired()
  @ValidateBody(createGroupMemberSchema)
  async createGroupMember(ctx: Context) {
    const body = ctx.request.body as CreateGroupMemberSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const groupMember = await this.prisma.client.groupMember.create({
      include: {
        user: {
          select: userSelectFields
        },
        group: true
      },
      data: {
        userID: body.userID,
        groupID: body.groupID,
        attributes
      }
    });
    return new HttpResponseCreated(groupMember);
  }

  @Patch('/:groupMemberId')
  @ApiOperationId('modifyGroupMember')
  @ApiOperationSummary('Update/modify an existing group member.')
  @ApiResponse(400, { description: 'Invalid group member.' })
  @ApiResponse(404, { description: 'Group member not found.' })
  @ApiResponse(200, { description: 'Group member successfully updated. Returns the group member.' })
  @UserRequired()
  @ValidatePathParam('groupMemberId', { type: 'number' })
  @ValidateBody(modifyGroupMemberSchema)
  async modifyGroupMember(ctx: Context) {
    const params = ctx.request.params as { groupMemberId: number };
    const body = ctx.request.body as ModifyGroupMemberSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const groupMember = await this.prisma.client.groupMember.update({
        include: {
          user: {
            select: userSelectFields
          },
          group: true
        },
        where: { id: params.groupMemberId },
        data: {
          userID: body.userID,
          groupID: body.groupID,
          attributes
        }
      });
  
      return new HttpResponseOK(groupMember);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:groupMemberId')
  @ApiOperationId('deleteGroupMember')
  @ApiOperationSummary('Delete a group member.')
  @ApiResponse(404, { description: 'Group member not found.' })
  @ApiResponse(204, { description: 'Group member successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('groupMemberId', { type: 'number' })
  async deleteGroupMember(ctx: Context) {
    const params = ctx.request.params as { groupMemberId: number };

    try {
      await this.prisma.client.groupMember.delete({
        where: { id: params.groupMemberId }
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
