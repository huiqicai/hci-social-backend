import { PrismaClient } from '@prisma/client';

export class Prisma {
    client: PrismaClient;

    constructor() {
        this.client = new PrismaClient();
    }
}