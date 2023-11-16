import { EventName, WebsocketContext, WebsocketResponse, WebsocketErrorResponse, ValidatePayload } from "@foal/socket.io";
import { dependency } from "@foal/core";
import { DB } from "../../services";
import { roomSet } from "../../services/ws.service";


    export class ChatController {
    
    @dependency
    db: DB;


    createRoomSchema = {
        additionalProperties: false,
        properties: {
            fromUserID: { type: 'integer', minimum: 1 },
            toUserID: { type: 'integer', minimum: 1 },
        },
        required: ['fromUserID', 'toUserID'],
        type: 'object'
    };
    sendMessageSchema = {
        additionalProperties: false,
        properties: {
        fromUserID: { type: 'integer', minimum: 1 }, // Sender's User ID
        toUserID: { type: 'integer', minimum: 1 },   // Recipient's User ID
        message: { type: 'string', minLength: 1 },
        },
        required: ['fromUserID', 'toUserID','message'],
        type: 'object'
    };

    async getRoomId(fromUserID: number, toUserID: number): Promise<number> {
        return await this.db.findOrCreateChatRoom(fromUserID, toUserID);
    }

    @EventName('/create-room')
    @ValidatePayload(ChatController => ChatController.createRoomSchema)
    async createRoom(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        const { fromUserID, toUserID } = ctx.payload;
        try {
            const roomID = await this.getRoomId(fromUserID, toUserID);
            roomSet.add(`${roomID}`);
            ctx.socket.emit('/room-created', { roomID });
            ctx.socket.join(`${roomID}`);
            
            return new WebsocketResponse(`Room created with ID: ${roomID}`);
        } catch (error) { 
            console.error(`Error creating room: ${error}`);
            return new WebsocketErrorResponse(`Error creating room: ${error}`);
        }
    }

    @EventName('/send')
    @ValidatePayload(ChatController => ChatController.sendMessageSchema)
    async sendMessage(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        console.log("------------------------", ctx.payload)
        const { fromUserID, toUserID, message } = ctx.payload;
        try {
            const roomID = await this.getRoomId(fromUserID, toUserID);
            await this.db.saveMessage(roomID, fromUserID, message);
   
            ctx.socket.broadcast.to(`${roomID}`).emit('/send-message', {
                fromUserID,
                toUserID,
                message,
            });
            return new WebsocketResponse("Message sent successfully!");
            
    } catch (error) {
        console.error("Error in sendMessage:", error);
        return new WebsocketErrorResponse("Internal server error.");
        }
    }
    
}