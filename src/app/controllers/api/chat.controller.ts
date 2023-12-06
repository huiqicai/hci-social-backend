import { EventName, WebsocketContext, WebsocketResponse, WebsocketErrorResponse, ValidatePayload } from "@foal/socket.io";
import { dependency } from "@foal/core";
import { DB } from "../../services";

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

    @EventName('/create-room')
    @ValidatePayload(ChatController => ChatController.createRoomSchema)
    async createRoom(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        const tenantID = ctx.socket['tenantID'] as string;
        const { fromUserID, toUserID } = ctx.payload;
        try {
            const roomID = await this.db.findOrCreateChatRoom(tenantID, fromUserID, toUserID);
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
        const { fromUserID, toUserID, message } = ctx.payload;
        try {
            
            const roomID = await this.db.findOrCreateChatRoom(tenantID, fromUserID, toUserID);
            await this.db.saveMessage(tenantID, roomID, fromUserID, toUserID, message);

            ctx.socket.broadcast.to(`room_${roomID}`).emit('/send-message', { 
                fromUserID, 
                toUserID, 
                message 
            });


            return new WebsocketResponse("Message sent successfully!");
        } catch (error) {
            console.error("Error in sendMessage:", error);
            return new WebsocketErrorResponse("Internal server error.");
        }
    }
}