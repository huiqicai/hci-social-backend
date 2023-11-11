import { SocketIOController, WebsocketContext, wsController } from '@foal/socket.io';
import { ChatController } from '../controllers/api/chat.controller'


// This will be used to help track of socket IDs the clients are being identified as :D 
const socketSet = new Set<string>();
const roomSet = new Set<string>();
export { socketSet };
export { roomSet };
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

    async onConnection(ctx: WebsocketContext) {
        console.log(`${new Date().toISOString()} onConnection`);
        // General room where evey user is connected to the room
        socketSet.add(ctx.socket.id);
        console.log("socketSet", socketSet)
        
        ctx.socket.on('disconnect', function() {
            console.log(`${new Date().toISOString()} onDisconnection`)
            socketSet.delete(ctx.socket.id);
        });
    }

}