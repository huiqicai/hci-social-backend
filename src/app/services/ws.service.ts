import { SocketIOController, WebsocketContext, wsController } from '@foal/socket.io';

import { ChatController } from '../controllers/api/chat.controller'
import { set } from 'shelljs';

export class WebsocketService extends SocketIOController {
    subControllers = [
        wsController('/chat', ChatController)
    ];

    constructor() {
        super();
        // ensure that our realtime server can accept websocket connections from any domain.
        this.options = {
            cors: {
              origin: '*'
            }
        }
    }

    createConnectionErrorException( status: number, message: string) {
        const jsonString = JSON.stringify({status: status, message: message});
        console.log(status, message)
        return jsonString;
    }

    async onConnection(ctx: WebsocketContext) {
        // const setSocket: Set<string> = new Set();
        // setSocket.add(ctx.socket.id);
        // console.log("setSocket", setSocket);
        console.log(`${new Date().toISOString()} onConnection`);
        // General room where evey user is connected to the room
        ctx.socket.join('general');

        ctx.socket.on('disconnect', function() {
            console.log(`${new Date().toISOString()} onDisconnection`)
        });
    }

}