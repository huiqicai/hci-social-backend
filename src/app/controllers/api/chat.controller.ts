import { EventName, WebsocketContext, WebsocketResponse, WebsocketErrorResponse, ValidatePayload } from '@foal/socket.io';
import { dependency } from '@foal/core';
import { DB } from '../../services';
import { PrismaClient, ChatRoom, ChatRoomMembership, Message } from '@prisma/client';

export class ChatController {
    @dependency
    db: DB;

    createRoomSchema = {
        additionalProperties: false,
        properties: {
            fromUserID: { type: 'integer', minimum: 1 },
            toUserID: { type: 'integer', minimum: 1 }
        },
        required: ['fromUserID', 'toUserID'],
        type: 'object'
    };
    
    sendMessageSchema = {
        additionalProperties: false,
        properties: {
            fromUserID: { type: 'integer', minimum: 1 },
            toUserID: { type: 'integer', minimum: 1 },
            message: { type: 'string', minLength: 1 }
        },
        required: ['fromUserID', 'toUserID', 'message'],
        type: 'object'
    };

    @EventName('/join-room')
    @ValidatePayload(ChatController => ChatController.createRoomSchema)
    async createRoom(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        const tenantID = ctx.socket['tenantID'] as string;
        const { fromUserID, toUserID } = ctx.payload;
        try {
            console.log(tenantID, fromUserID, toUserID)
            const roomID = await this.findOrCreateChatRoom(tenantID, fromUserID, toUserID);
            ctx.socket.emit('/room-created', { roomID });
            ctx.socket.join(`room_${roomID}`);
            return new WebsocketResponse(`Room created with ID: ${roomID}`);
        } catch (error) { 
            console.error(`Error creating room: ${error}`);
            return new WebsocketErrorResponse(`Error creating room: ${error}`);
        }
    }

    @EventName('/send')
    @ValidatePayload(ChatController => ChatController.sendMessageSchema)
    async sendMessage(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        const tenantID = ctx.socket['tenantID'] as string;
        console.log(tenantID, "--------------")
        const { fromUserID, toUserID, message } = ctx.payload;
        try {
            const roomID = await this.findOrCreateChatRoom(tenantID, fromUserID, toUserID);
            await this.saveMessage(tenantID, roomID, fromUserID, toUserID, message);

            ctx.socket.broadcast.to(`room_${roomID}`).emit('/send-message', { 
                fromUserID, 
                toUserID, 
                message 
            });

            return new WebsocketResponse('Message sent successfully!');
        } catch (error) {
            console.error('Error in sendMessage:', error);
            return new WebsocketErrorResponse('Internal server error.');
        }
    }

    async findOrCreateChatRoom(tenantID: string, fromUserID: number, toUserID: number): Promise<number> {
        const client: PrismaClient = this.db.getClient(tenantID);

        let room = await client.chatRoom.findFirst({
            where: {
                members: {
                    some: { userId: fromUserID },
                },
                AND: [{
                    members: {
                        some: { userId: toUserID },
                    },
                }],
            },
            include: { members: true },
        });

        if (!room) {
            room = await client.chatRoom.create({
                data: {
                    members: {
                        create: [
                            { userId: fromUserID },
                            { userId: toUserID },
                        ],
                    },
                },
                include: { members: true },
            });

            // Race condition check
            const duplicateRooms = await client.chatRoom.findMany({
                where: {
                    members: {
                        some: { userId: fromUserID },
                    },
                    AND: [{
                        members: {
                            some: { userId: toUserID },
                        },
                    }],
                },
                orderBy: { id: 'asc' },
            });

            if (duplicateRooms.length > 1) {
                const correctRoom = duplicateRooms[0];
                if (correctRoom.id !== room.id) {
                    await client.chatRoom.delete({ where: { id: room.id } });
                    room = await client.chatRoom.findUnique({ where: { id: correctRoom.id }, include: { members: true } });
                }
            }
        }

        if (!room) {
            throw new Error("Failed to create or find a chat room.");
        }
        return room.id;
    }
    async saveMessage(tenantID: string, chatRoomId: number, fromUserId: number, toUserId: number | null, content: string): Promise<Message> {
        const client: PrismaClient = this.db.getClient(tenantID);
        return await client.message.create({
            data: {
                chatRoomId,
                fromUserId,
                toUserId, 
                content
            }
        });
    }

    // NOTE for next years backend developer: 
    // Cool feature to add is a group chat functionality: 
    // Might need to add a few more things to the chat room memebership and  chat room prisma tables to allow more users to join a room 
    // GOOD LUCK ;) 
}
