import { SocketIOController, WebsocketContext, wsController } from '@foal/socket.io';
import { ChatController } from '../controllers/api/chat.controller'


// This will be used to help track of socket IDs the clients are being identified as :D 
const socketSet = new Set<string>();
const roomSet = new Set<string>();
export { socketSet };
export { roomSet };


export class WebsocketService extends SocketIOController {

    constructor() {
        super();
        this.options = {
            cors: {
                origin: '*', 
            },
            path: `/api/hci-socket`
        }
    } 
    subControllers = [
        wsController('/chat', ChatController)
    ];

    async onConnection(ctx: WebsocketContext) {
        const tenantID = ctx.socket.handshake.query.tenantID as string; 
        console.log(`Tenant ID: ${tenantID}`);    
        // This will be different for each tenant
        const tenantRoom = `tenant_${tenantID}-room`;

        ctx.socket.join(tenantRoom);
        roomSet.add(tenantRoom);
        socketSet.add(ctx.socket.id);
        
        // Denugging purposes: To see if the socket is being added to the roomSet/socketSet
        console.log("socketSet", socketSet)
        console.log("roomSet", roomSet)

        ctx.socket.on('disconnect', function() {
            console.log(`${new Date().toISOString()} onDisconnection`)
            socketSet.delete(ctx.socket.id);
        });
    }

}