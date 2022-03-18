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

const baseConnectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fromUserID: { type: 'number' },
    toUserID: { type: 'number' },
    attributes: { type: 'object', additionalProperties: true }
  },
  required: []
} as const;

const findConnectionsSchema = {
  ...baseConnectionSchema,
  definitions: {
    attribute: attributeSchema
  },
  properties: {
    ...baseConnectionSchema.properties,
    skip: { type: 'number' },
    take: { type: 'number' },
    anyUserID: { type: 'number', description: 'Returns records where either fromUserID or toUserID is the passed value' },
    attributes: { 
      type: 'array',
      items: { '$ref': '#/components/schemas/attribute' }
    }
  }
} as const;

type FindConnectionsSchema = JTDDataType<typeof findConnectionsSchema>;

const createConnectionSchema = {
  ...baseConnectionSchema,
  required: ['fromUserID', 'toUserID']
} as const;

type CreateConnectionSchema = JTDDataType<typeof createConnectionSchema>;

const modifyConnectionSchema = baseConnectionSchema;

type ModifyConnectionSchema = JTDDataType<typeof modifyConnectionSchema>;

@ApiDefineTag({
  name: 'Connection',
  description: 'This dataset will hold all the connections between users (friends, followers, ' +
    'whatever your model calls for).'
})
@ApiUseTag('Connection')
export class ConnectionController {
  @dependency
  db: DB;

  @Get()
  @ApiOperationId('findConnections')
  @ApiOperationSummary('Find connections.')
  @ApiOperationDescription(
    'The query parameters "skip" and "take" can be used for pagination. The first ' +
    'is the offset and the second is the number of elements to be returned.'
  )
  @ApiResponse(400, { description: 'Invalid query parameters.' })
  @ApiResponse(200, { description: 'Returns a list of connections.' })
  @ParseAttributes()
  @ValidateQuery(findConnectionsSchema)
  async findConnections(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const query = ctx.request.query as FindConnectionsSchema;

    const where: Prisma.ConnectionWhereInput = {
      ...(query.toUserID ? {toUserID: query.toUserID} : {}),
      ...(query.fromUserID ? {fromUserId: query.fromUserID} : {}),
      ...(query.anyUserID ? { OR: [{toUserID: query.anyUserID}, {fromUserID: query.anyUserID}]} : {}),
      AND: apiAttributesToPrisma(query.attributes)
    };

    const res = await this.db.getClient(params.tenantId).$transaction([
      this.db.getClient(params.tenantId).connection.findMany({
        include: {
          fromUser: {
            select: userSelectFields
          },
          toUser: {
            select: userSelectFields
          }
        },
        skip: query.skip,
        take: query.take,
        where
      }),
      this.db.getClient(params.tenantId).connection.count({where})
    ]);

    return new HttpResponseOK(res);
  }

  @Get('/:connectionId')
  @ApiOperationId('findConnectionById')
  @ApiOperationSummary('Find a connection by ID.')
  @ApiResponse(404, { description: 'Connection not found.' })
  @ApiResponse(200, { description: 'Returns the connection.' })
  @ValidatePathParam('connectionId', { type: 'number' })
  async findConnectionById(ctx: Context) {
    const params = ctx.request.params as {connectionId: number, tenantId: string};
    const connection = await this.db.getClient(params.tenantId).connection.findUnique({
      include: {
        fromUser: {
          select: userSelectFields
        },
        toUser: {
          select: userSelectFields
        }
      },
      where: { id: params.connectionId }
    });

    if (!connection) {
      return new HttpResponseNotFound();
    }

    return new HttpResponseOK(connection);
  }

  @Post()
  @ApiOperationId('createConnection')
  @ApiOperationSummary('Create a new connection.')
  @ApiResponse(400, { description: 'Invalid connection.' })
  @ApiResponse(201, { description: 'Connection successfully created. Returns the connection.' })
  @UserRequired()
  @ValidateBody(createConnectionSchema)
  async createConnection(ctx: Context) {
    const params = ctx.request.params as {tenantId: string};
    const body = ctx.request.body as CreateConnectionSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    const connection = await this.db.getClient(params.tenantId).connection.create({
      include: {
        fromUser: {
          select: userSelectFields
        },
        toUser: {
          select: userSelectFields
        }
      },
      data: {
        fromUserID: body.fromUserID,
        toUserID: body.toUserID,
        attributes
      }
    });

    return new HttpResponseCreated(connection);
  }

  @Patch('/:connectionId')
  @ApiOperationId('modifyConnection')
  @ApiOperationSummary('Update/modify an existing connection.')
  @ApiResponse(400, { description: 'Invalid connection.' })
  @ApiResponse(404, { description: 'Connection not found.' })
  @ApiResponse(200, { description: 'Connection successfully updated. Returns the connection.' })
  @UserRequired()
  @ValidatePathParam('connectionId', { type: 'number' })
  @ValidateBody(modifyConnectionSchema)
  async modifyConnection(ctx: Context) {
    const params = ctx.request.params as { connectionId: number, tenantId: string };
    const body = ctx.request.body as ModifyConnectionSchema;
    // Due to limitations with our frankensteined AJV JSD/JTD types, we can't type this properly
    const attributes = body.attributes as Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;

    try {
      const connection = await this.db.getClient(params.tenantId).connection.update({
        include: {
          fromUser: {
            select: userSelectFields
          },
          toUser: {
            select: userSelectFields
          }
        },
        where: { id: params.connectionId },
        data: { fromUserID: body.fromUserID, toUserID: body.toUserID, attributes }
      });
  
      return new HttpResponseOK(connection);
    } catch(e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Record to update not found
        if (e.code === 'P2025') return new HttpResponseNotFound();
      }
      throw e;
    }
  }

  @Delete('/:connectionId')
  @ApiOperationId('deleteConnection')
  @ApiOperationSummary('Delete a connection.')
  @ApiResponse(404, { description: 'Connection not found.' })
  @ApiResponse(204, { description: 'Connection successfully deleted.' })
  @UserRequired()
  @ValidatePathParam('connectionId', { type: 'number' })
  async deleteConnection(ctx: Context) {
    const params = ctx.request.params as { connectionId: number, tenantId: string };

    try {
      await this.db.getClient(params.tenantId).connection.delete({
        where: { id: params.connectionId }
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
