import { Config } from '@foal/core';
import { PrismaClient } from '@prisma/client';

export class Prisma {
    client: PrismaClient;

    constructor() {
        this.client = new PrismaClient({
            datasources: {
                db: {
                    url: Config.getOrThrow('database_url', 'string')
                }
            }
        });
    }
}