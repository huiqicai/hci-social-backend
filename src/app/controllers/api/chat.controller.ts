import { EventName, WebsocketContext, WebsocketResponse, WebsocketErrorResponse, ValidatePayload } from "@foal/socket.io";
import { dependency } from "@foal/core";
import { DB } from "../../services";
import { WebsocketService } from "../../services/ws.service";

    export class ChatController {
    
    @dependency
    db: DB;

    @dependency
    websocketService: WebsocketService;

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

    // async getRoomId(fromUserID: number, toUserID: number): Promise<number> {
    //    return await this.db.findOrCreateChatRoom(fromUserID, toUserID);
    // }

    @EventName('/create-room')
    @ValidatePayload(ChatController => ChatController.createRoomSchema)
    async createRoom(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        const { fromUserID, toUserID } = ctx.payload;
        try {
            const roomID = await this.db.findOrCreateChatRoom(fromUserID, toUserID, ctx.socket.id);
            const roomIDString = `${roomID}`;
            // Join the initiating user's socket to the room
            ctx.socket.join(roomIDString);
            
            // Retrieve the recipient's socket ID
            const recipientSocketId = this.websocketService.getSocketIdByUserId(toUserID);
            
            // If the recipient is connected, get their socket and join the room
            if (recipientSocketId) {
            ctx.socket.to(recipientSocketId).emit('join-room', { roomID: roomIDString });
            }

            // Notify the initiating user that the room has been created
            ctx.socket.emit('/room-created', { roomID: roomID });
            return new WebsocketResponse(`Room ${roomID} created and joined successfully.`);
        } catch (error) { 
            console.error(`Error creating room: ${error}`);
            return new WebsocketErrorResponse(`Error creating room: ${error}`);
        }
    }
    

    @EventName('/send')
    @ValidatePayload(ChatController => ChatController.sendMessageSchema)
    async sendMessage(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        console.log("------------------------", ctx.payload);
        const { fromUserID, toUserID, message } = ctx.payload;    
        try {
            // Get the room ID from the database where both users should be present
            const roomID = await this.db.findOrCreateChatRoom(fromUserID, toUserID, ctx.socket.id);
            console.log("room id is", roomID);
            // Convert room ID to string to use as room name
            const roomIDString = `${roomID}`;
            // Emit the message to the room so that all members of the room receive it
            ctx.socket.to(roomIDString).emit('/received-messages', {
                fromUserID,
                toUserID,
                message,
            });
            // Confirm message sending to the sender
            return new WebsocketResponse("Message sent successfully!");
        } catch (error) {
            console.error("Error in sendMessage:", error);
            return new WebsocketErrorResponse("Internal server error.");
        }
    }
    

}