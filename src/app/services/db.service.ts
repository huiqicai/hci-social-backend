import { ChatRoom, ChatRoomMembership, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';

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
                members: true,
            },
        });
        if (!room) {
            room = await client.chatRoom.create({
                data: {
                    members: {
                        createMany: {
                            data: [
                                { userId: fromUserID },
                                { userId: toUserID },
                               /// {connectedToSocket: ctx.socket.id}
                            ],
                            skipDuplicates: true,
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
}