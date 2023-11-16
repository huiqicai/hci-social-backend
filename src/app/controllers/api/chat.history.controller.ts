import {ApiDefineTag, ApiUseTag, Get,ValidatePathParam, Context, dependency} from '@foal/core';
import { DB } from '../../services'; 
import { Message } from '@prisma/client'; 


@ApiDefineTag({
    name: 'Chat-History',
    description: 'This dataset will hold all of the chat messages between users. Aka the chat history.'
})


@ApiUseTag('Chat-History')
export class ChatHistoryController {
   
    @dependency
    private db: DB;

    // Define a GET route to fetch chat history for a given room
    @Get('/history/:roomId')
    @ValidatePathParam('roomId to display the chat history for the specified room :D ', { type: 'number' }) // Validate that roomId is a number
    async getChatHistory(ctx: Context): Promise<Message[]> {
        // Extract the roomId from the request parameters
        const roomId = ctx.request.params.roomId;

        // Call the DB service to fetch chat history for the room
        return await this.db.getChatHistory(roomId);
    }
}
