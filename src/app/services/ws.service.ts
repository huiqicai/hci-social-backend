import { SocketIOController, WebsocketContext, wsController } from '@foal/socket.io';
import { ChatController } from '../controllers/api/chat.controller'
import { Config } from '@foal/core';

const socketSet = new Set<string>();
const roomSet = new Set<string>();
export { socketSet };
export { roomSet };

const prefix = Config.get('api_prefix', 'string', '');

export class WebsocketService extends SocketIOController {
    constructor() {
        super();
        this.options = {
            cors: {
                origin: '*', 
            },
            // This is the path that the client will use to connect to the websocket
            path: `${prefix}/api/hci-socket`
        }

    } 
    subControllers = [
        wsController('/chat', ChatController)
    ];

    async onConnection(ctx: WebsocketContext) {
        const tenantID = ctx.socket.handshake.query.tenantID as string; 
        const tenantRoom = `tenant_${tenantID}Room`;
        console.log("-------THis is the tenant -------->" ,tenantID)

        ctx.socket['tenantID'] = tenantID;
        ctx.socket.join(tenantRoom);
        roomSet.add(tenantRoom);
        socketSet.add(ctx.socket.id);


        ctx.socket.on('disconnect', function() {
            console.log(`${new Date().toISOString()} onDisconnection`)
            socketSet.delete(ctx.socket.id);
        });
    }
}

