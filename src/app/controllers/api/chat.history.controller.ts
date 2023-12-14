import { ApiDefineTag, ApiUseTag, Get, ValidatePathParam, Context, dependency, HttpResponseOK, ApiResponse, HttpResponseBadRequest } from '@foal/core';
import { DB } from '../../services';  
import { Message, PrismaClient } from '@prisma/client';

@ApiDefineTag({
    name: 'Chat-History',
    description: 'This endpoint is for fetching chat history for a given room'
})

@ApiUseTag('Chat-History')
export class ChatHistoryController {
    @dependency
    private db: DB;

    private async fetchChatHistory(tenantID: string, roomId: number): Promise<Message[]> {
        const client: PrismaClient = this.db.getClient(tenantID);
        try {
            return await client.message.findMany({
                where: { chatRoomId: roomId },
                orderBy: { createdAt: 'asc' },
            });
        } catch (error) {
            console.error(`Error fetching chat history: ${error}`);
            throw new Error('Failed to fetch chat history.');
        }
    }

    @Get('/history/:roomId')
    @ValidatePathParam('roomId', { type: 'number' })
    @ApiResponse(200, {description: 'Returns the chat-history'})
    async chatHistory(ctx: Context): Promise<HttpResponseOK | HttpResponseBadRequest> {
        const roomId = ctx.request.params.roomId;
        const tenantId = ctx.request.params.tenantId;
        
        try {
            const messages = await this.fetchChatHistory(tenantId, roomId);
            return new HttpResponseOK(messages);
        } catch (error) {
            console.error(`Error in chatHistory: ${error}`);
            return new HttpResponseBadRequest('Unable to fetch chat history.');
        }
    }
}
