import { SocketIOController, WebsocketContext, wsController } from '@foal/socket.io';
import { ChatController } from '../controllers/api/chat.controller'
import { Config } from '@foal/core';

const prefix = Config.get('api_prefix', 'string', '');

export class WebsocketService extends SocketIOController {
    constructor() {
        super();
        this.options = {
            cors: {
                origin: '*', 
            },
            path: `${prefix}/api/hci-socket`
        }

    } 
    subControllers = [
        wsController('/chat', ChatController)
    ];

    async onConnection(ctx: WebsocketContext) {
        const tenantID = ctx.socket.handshake.query.tenantID as string; 
        const tenantRoom = `tenant_${tenantID}Room`;
        ctx.socket['tenantID'] = tenantID;
        ctx.socket.join(tenantRoom);

        ctx.socket.on('disconnect', function() {
            console.log(`${new Date().toISOString()} onDisconnection`)
        });
    }
}

