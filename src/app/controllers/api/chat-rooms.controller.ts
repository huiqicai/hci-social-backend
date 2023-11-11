import { Context, Get, HttpResponseOK, dependency } from '@foal/core';
import { DB } from '../../services';

export class ChatController {
    
    @dependency
    db: DB;

    // ... [other code]

    // // HTTP GET endpoint to fetch chat rooms for a user
    // @Get('/chatrooms/user/:userId')
    // async fetchUserChatRooms(ctx: Context) {
    //     // Extract the userId from the route parameter
    //     const userId = parseInt(ctx.request.params.userId, 10);
    //     if (isNaN(userId)) {
    //         return new HttpResponseOK('The user ID must be an integer.');
    //     }

    //     try {
    //         // Fetch chat rooms for the user from the database
    //         const chatRooms = await this.db.findUserChatRooms(userId);

    //         // Respond with the fetched chat rooms
    //         return new HttpResponseOK(chatRooms);
    //     } catch (error) {
    //         console.error(`Error fetching chat rooms for user ${userId}: ${error}`);
    //         return new HttpResponseOK('An error occurred while fetching chat rooms.');
    //     }
    // }
}
