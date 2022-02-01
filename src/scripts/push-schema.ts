import { exec } from 'shelljs';
import { DB } from '../app/services';

export async function main() {
    for (const [tenantId, connectionString] of Object.entries(DB.getTenantsConfig())) {
        console.log();
        console.log('---------------------------------------')
        console.log(`Pushing schema to tenant ${tenantId}...`)
        console.log('---------------------------------------')
        console.log();
        if (!connectionString) throw new Error('Empty connection string');
        exec('npx prisma db push', {
            env: { ...process.env, DATABASE_URL: connectionString }
        });
    }
}
