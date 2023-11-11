import {  PrismaClient, ChatRoom, ChatRoomMembership } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { WsServer } from '@foal/socket.io';
// ChatRoom, ChatRoomMembership,
interface TenantConnectionConfig {
    [tenantID: string]: string | undefined;
}

export class DB {
    private tenantDBConnectionConfig: TenantConnectionConfig;
    private clients = new Map<string, PrismaClient>();

    constructor() {
        this.tenantDBConnectionConfig = DB.getTenantsConfig();
    }

    private static getTenantsFile() {
        if (existsSync('db-tenants.json')) return readFileSync('db-tenants.json', 'utf-8');
        if (existsSync('db-tenants.example.json')) return readFileSync('db-tenants.example.json', 'utf-8');
        throw new Error('Prisma service initialization failed: tenants configuration not found');
    }

    private static validateTenantsConfig(parsedConfig: unknown): parsedConfig is TenantConnectionConfig {
        return parsedConfig !== null
            && typeof parsedConfig === 'object'
            && Object.keys(parsedConfig).every(key => typeof key === 'string')
            && Object.values(parsedConfig).every(key => typeof key === 'string')
    }

    static getTenantsConfig(): TenantConnectionConfig {
        const parsedConfig: unknown = JSON.parse(this.getTenantsFile());
        if (this.validateTenantsConfig(parsedConfig)) {
            return parsedConfig;
        } else {
            throw new Error('Prisma service initialization failed: tenants configuration is invalid');
        }
    }

    getClient(tenantID: string): PrismaClient {
        const existingClient = this.clients.get(tenantID);
        if (existingClient) return existingClient;
        
        const connectionString = this.tenantDBConnectionConfig[tenantID];
        if (connectionString) {
            const client = new PrismaClient({
                datasources: {
                    db: {
                        url: connectionString
                    }
                }
            });
            this.clients.set(tenantID, client);
            return client;
        }
        throw new Error('Invalid tenant ID');
    }


    // Dans modifications: 
    // User prisma to create/find the roomID in the database to check if it exists or not
    async findOrCreateChatRoom(fromUserID: number, toUserID: number): Promise<number> {
        const client: PrismaClient = this.getClient('default'); 
        let room: (ChatRoom & { members: ChatRoomMembership[] }) | null;
    
        // Attempt to find an existing room with both members
        room = await client.chatRoom.findFirst({
            where: {
                members: {
                    every: { 
                        userId: { in: [fromUserID, toUserID] } 
                    }
                }
            },
            include: {
                members: true, // Include members to ensure the room is correctly populated
            },
        });
        // If a room doesn't exist, create a new one
        if (!room) {
            room = await client.chatRoom.create({
                data: {
                    members: {
                        createMany: {
                            data: [
                                { userId: fromUserID },
                                { userId: toUserID },
                            ],
                            skipDuplicates: true, // This will skip over any duplicates if they exist
                        },
                    },
                },
                include: {
                    members: true, // Include members in the response to validate the creation
                },
            });
        }
        // At this point, the room should exist and include both members
        // Return the room's ID
        return room.id;
    }
    
    
    

    // async updateSocketIdForUserRooms(userId: number, socketId: string): Promise<void> {
    //     const client: PrismaClient = this.getClient('default');
    //     // Update the connectedToSocket for all ChatRoomMemberships for the user
    //     await client.chatRoomMembership.updateMany({
    //         where: { userId: userId },
    //         data: { connectedToSocket: socketId },
    //     });
    // }

    // async clearSocketIdForUserRooms(userId: number): Promise<void> {
    //     const client: PrismaClient = this.getClient('default');
    //     // Clear the connectedToSocket for all ChatRoomMemberships for the user
    //     await client.chatRoomMembership.updateMany({
    //         where: { userId: userId },
    //         data: { connectedToSocket: { set: "" } }, // Use `set` to explicitly set the value to null
    //     });
    // }

}