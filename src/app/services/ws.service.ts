import { SocketIOController, WebsocketContext, wsController } from '@foal/socket.io';
import { DB } from '../services';

import { ChatController } from '../controllers/api/chat.controller'
import { set } from 'shelljs';
import { dependency } from '@foal/core';

// This will be used to help track of user ID to socket ID :D 
const socketUserMap = new Map<number, string>();
export class WebsocketService extends SocketIOController {
    subControllers = [
        wsController('/chat', ChatController)
    ];

    constructor() {
        super();
        // ensure that our realtime server can accept websocket connections from any domain.
        this.options = {
            cors: {
                origin: '*',
            }
        }
    }

    @dependency
    db: DB;

    // Tbh i dont think this is needed but will have here untill changes are needed
    createConnectionErrorException( status: number, message: string) {
        const jsonString = JSON.stringify({status: status, message: message});
        console.log(status, message)
        return jsonString;
    }

    async onConnection(ctx: WebsocketContext) {
        // Assuming the user ID is sent as a query parameter when establishing the WebSocket connection
        const userId = parseInt(ctx.socket.handshake.query.userId as string);
        if (!isNaN(userId)) {
            // Map the user ID to the socket ID
            socketUserMap.set(userId, ctx.socket.id);
            await this.db.updateSocketIdForUserRooms(userId, ctx.socket.id);
        }
        // const setSocket: Set<string> = new Set();
        // setSocket.add(ctx.socket.id);
        // console.log("setSocket", setSocket);
        console.log(`${new Date().toISOString()} onConnection`);
        // General room where evey user is connected to the room
        ctx.socket.join('general');

        ctx.socket.on('disconnect', function() {
            console.log(`${new Date().toISOString()} onDisconnection`)
            if (!isNaN(userId)) {
                // Remove the mapping when the socket disconnects
                socketUserMap.delete(userId);

                // Clear the connectedToSocket in the database for the user
              //  await this.db.clearSocketIdForUserRooms(userId);
            }
        });
    }

    // Helper function to get the socket for a specific user
    getSocketByUserId(userId: number): string | undefined {
        return socketUserMap.get(userId);
    }

    // Helper function to get the socket ID by user ID
    getSocketIdByUserId(userId: number) {
        return socketUserMap.get(userId);
    }

}