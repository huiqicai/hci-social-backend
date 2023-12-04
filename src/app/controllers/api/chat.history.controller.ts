import { ApiDefineTag, ApiUseTag, Get, ValidatePathParam, Context, dependency, HttpResponse,  HttpResponseOK } from '@foal/core';
import { DB } from '../../services'; 
import { Message } from '@prisma/client'; 

@ApiDefineTag({
    name: 'Chat-History',
    description: 'This dataset will hold all of the chat messages between users.'
})
@ApiUseTag('Chat-History')
export class ChatHistoryController {
    @dependency
    private db: DB;
    
    @Get('/history/:roomId')
    @ValidatePathParam('roomId', { type: 'number' })
    async getChatHistory(ctx: Context): Promise<HttpResponseOK> {
        const tenantID = "default";
        const roomId = ctx.request.params.roomId as number;
        const messages = await this.db.getChatHistory(tenantID, roomId);
        return new HttpResponseOK(messages);
    }
}
