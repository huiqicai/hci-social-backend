import { ChatRoom, ChatRoomMembership, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { WsServer } from '@foal/socket.io';

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
    async findOrCreateChatRoom(fromUserID: number, toUserID: number, socketConnectionId: string): Promise<number> {
        const client: PrismaClient = this.getClient('default'); 
        // The room can be null or a ChatRoom with members.
        let room: (ChatRoom & { members: ChatRoomMembership[] }) | null;
            room = await client.chatRoom.findFirst({
            where: {
                members: {
                    every: { 
                        userId: { in: [fromUserID, toUserID] } 
                    },
                },
            },
            include: {
                members: true, 
            },
        });
    
        if (!room) {
            // If the room doesn't exist, create it with the members.
            room = await client.chatRoom.create({
                data: {
                    // If connectedSocket should be part of the creation, add it here,
                    // otherwise, remove the connectedSocket field.
                    members: {
                        createMany: {
                            data: [
                                { userId: fromUserID, connectedToSocket: socketConnectionId },
                                { userId: toUserID, connectedToSocket: socketConnectionId },
                            ],
                            skipDuplicates: true,
                        },
                    },
                },
                include: {
                    members: true,
                },
            });
        } else {
            // If the room exists but needs to be updated with the new socket connection IDs for members.
            await client.chatRoomMembership.updateMany({
                where: {
                    chatRoomId: room.id,
                    userId: { in: [fromUserID, toUserID] },
                },
                data: { connectedToSocket: socketConnectionId },
            });
                room = await client.chatRoom.findUnique({
                where: { id: room.id },
                include: {
                    members: true,
                },
            });
        }
            if (!room) {
            throw new Error('Chat room could not be found or created.');
        }
        return room.id; // Return the room ID.
    }
    
    

    async updateSocketIdForUserRooms(userId: number, socketId: string): Promise<void> {
        const client: PrismaClient = this.getClient('default');
        // Update the connectedToSocket for all ChatRoomMemberships for the user
        await client.chatRoomMembership.updateMany({
            where: { userId: userId },
            data: { connectedToSocket: socketId },
        });
    }

    async clearSocketIdForUserRooms(userId: number): Promise<void> {
        const client: PrismaClient = this.getClient('default');
        // Clear the connectedToSocket for all ChatRoomMemberships for the user
        await client.chatRoomMembership.updateMany({
            where: { userId: userId },
            data: { connectedToSocket: { set: "" } }, // Use `set` to explicitly set the value to null
        });
    }
    
    // async sendMessageToRoom(io: WsServer,roomId: number, message: string): Promise<void> {
    //     const client: PrismaClient = this.getClient('default');
    //     const memberships = await client.chatRoomMembership.findMany({
    //         where: { chatRoomId: roomId },
    //         select: { connectedToSocket: { set: null } },
    //     });
    
    //     memberships.forEach(membership => {
    //         if (membership.connectedToSocket) {
    //             io.to(membership.connectedToSocket).emit('message', message);
    //         }
    //     });
    // }
    
}