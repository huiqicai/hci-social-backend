import { ApiDefineTag, ApiUseTag, Get, ValidatePathParam, Context, dependency, HttpResponse,  HttpResponseOK, ApiResponse } from '@foal/core';
import { DB } from '../../services'; 
import { Message } from '@prisma/client'; 

@ApiDefineTag({
    name: 'Chat-History',
    description: "This endpoint is for fetching chat history for a given room"
})

@ApiUseTag('Chat-History')
export class ChatHistoryController {
    @dependency
    private db: DB;
    
    @Get('/history/:roomId')
    @ValidatePathParam('roomId', { type: 'number' })
    @ApiResponse(200, {description: "Returns the chat-history"})
    async getChatHistory(ctx: Context): Promise<HttpResponseOK> {
        const params = ctx.request.params as { tenantId: string}
        const roomId = ctx.request.params.roomId as number;
        const messages = await this.db.getChatHistory(params.tenantId, roomId);
        return new HttpResponseOK(messages);
    }
}
