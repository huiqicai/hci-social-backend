import {  PrismaClient, ChatRoom, ChatRoomMembership, Message } from '@prisma/client';
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

    async findOrCreateChatRoom(tenantID: string, fromUserID: number, toUserID: number): Promise<number> {
        const client: PrismaClient = this.getClient(tenantID); 
        let room = await client.chatRoom.findFirst({
            where: {
                members: {
                    every: { 
                        userId: { in: [fromUserID, toUserID] }
                    }
                }
            },
            include: { members: true }
        });
        if (!room) {
            room = await client.chatRoom.create({
                data: {
                    members: {
                        createMany: {
                            data: [
                                { userId: fromUserID },
                                { userId: toUserID }
                            ],
                            skipDuplicates: true
                        }
                    }
                },
                include: { members: true }
            });
        }
        return room.id;
    }

    async saveMessage(tenantID: string, chatRoomId: number, fromUserId: number, toUserId: number | null, content: string): Promise<Message> {
        const client: PrismaClient = this.getClient(tenantID); 
        return await client.message.create({
            data: {
                chatRoomId,
                fromUserId,
                toUserId, 
                content
            }
        });
    }

    
    async getChatHistory(tenantID: string, roomId: number): Promise<Message[]> {
        // First, get the PrismaClient for the given tenantID
        const client: PrismaClient = this.getClient(tenantID);
        try {
            console.log("----------------------------", tenantID)
            // Then, use that client to query the database
            const messages = await client.message.findMany({
                where: { chatRoomId: roomId },
                orderBy: { createdAt: 'asc' }, // Sort by createdAt in ascending order
            });
            return messages;
        } catch (error) {
            console.error(`Failed to fetch chat history for tenantID ${tenantID}:`, error);
            // Rethrow the error or handle it as needed
            throw error;
        }
    }
}