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
            // If the roomID will exist becasue due to the db checking if the room is created or not
            const roomID = await this.getRoomId(fromUserID, toUserID);
            const roomIDString = `${roomID}`;
            // If the room exist already, we don't need to create it again
            // just join the roomID 
            ctx.socket.emit('/room-created', { roomID: roomID });
            ctx.socket.join(roomIDString);

            return new WebsocketResponse(`Socket has not joined: ${roomID}`);
        } catch (error) { 
            // This catch error would never happened because of the findOrCrearteChatRoom function
            // being able to create a room if it doesn't exist 
            console.error(`Error creating room: ${error}`);
            return new WebsocketErrorResponse(`Error creating room: ${error}`);
        }
    }

    @EventName('/send')
    @ValidatePayload(ChatController => ChatController.sendMessageSchema)
    async sendMessage(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
        console.log("------------------------", ctx.payload)
        const { fromUserID, toUserID, message } = ctx.payload
        try {
        const roomID = await this.getRoomId(fromUserID, toUserID);
        console.log("room id is", roomID)
        const roomIDString  = `${roomID}`;

        ctx.socket.to(roomIDString).emit('/recieved-messages', {
            message,
        });

        return new WebsocketResponse("Message sent successfully!");
        } catch (error) {
        console.error("Error in sendMessage:", error);
        return new WebsocketErrorResponse("Internal server error.");
        }
    }

    
}



// import { EventName, WebsocketContext, WebsocketResponse, WebsocketErrorResponse, ValidatePayload} from "@foal/socket.io";
// import {  dependency} from "@foal/core";
// import { DB } from "../../services";
// import { WsServer } from '@foal/socket.io';

// export class ChatController { 

//     @dependency
//     db: DB; 
//     @dependency
//     wsServer: WsServer;
    
//     createRoomSchema = {
//         additionalProperties: false,
//         properties: {
//             fromUserID: { type: 'integer', minimum: 1 },
//             toUserID: { type: 'integer', minimum: 1 },
//         },
//         required: ['fromUserID', 'toUserID'],
//         type: 'object'
//     };
//     sendMessageSchema = {
//         additionalProperties: false,
//         properties: {
//         fromUserID: { type: 'integer', minimum: 1 }, // Sender's User ID
//         toUserID: { type: 'integer', minimum: 1 },   // Recipient's User ID
//         message: { type: 'string', minLength: 1 },
//         },
//         required: ['fromUserID', 'toUserID','message'],
//         type: 'object'
//     };

//     // Helper function to verify if a room exists 
//     async verifyRoom(roomID: number) {
//         // Logic to check if the room exists and is valid
//         // Return true if valid, false otherwise
//         return 1; // Placeholder, implement your own logic here
//     }

//     // socket.emit('/chat/create-room')
//     @EventName('/create-room')
//     @ValidatePayload(ChatController => ChatController.createRoomSchema)
//     async createRoom(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
//         const { fromUserID, toUserID } = ctx.payload;
//         console.log("These the first user is trying to create a room wih the second user:",fromUserID, toUserID)
//         // Check if the room already exists
//         try {
//             const roomID = await this.db.findOrCreateChatRoom(fromUserID, toUserID);
//             ctx.socket.emit('/room-created', { roomID: roomID });
//             console.log("room id is", roomID)
//             ctx.socket.join(`room_${roomID}`);
//             return new WebsocketResponse(`Room Created with ID: ${roomID}`);
//         } catch (error) {
//             // Handle any errors that occur during the room creation process
//             console.error(`Error creating room: ${error}`);
//             return new WebsocketErrorResponse(`Error creating room: ${error}`);
//         }
//     }

//     @EventName('/send-message')
//     @ValidatePayload(ChatController => ChatController.sendMessageSchema)
//     async sendMessage(ctx: WebsocketContext): Promise<WebsocketResponse | WebsocketErrorResponse> {
//         console.log("------------------------", ctx.payload)
//         // console.log("it gets into the code scope");
//         try {
            
//             const { fromUserID, toUserID, message } = ctx.payload;
//             const roomID = await this.db.findOrCreateChatRoom(fromUserID, toUserID);


//             return new WebsocketResponse("Message Sent!!!");

//         } catch (error) {
//             console.error("Error in sendMessage:", error);
//             return new WebsocketErrorResponse("Internal server error.");
//         }
//     }

// }   