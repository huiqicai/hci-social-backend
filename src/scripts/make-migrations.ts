import { exec } from 'shelljs';
import { DB } from '../app/services';

export async function main() {
    const [tenantId, connectionString] = Object.entries(DB.getTenantsConfig())[0];
    console.log();
    console.log('-------------------------------')
    console.log(`Generating migrations via tenant ${tenantId}...`)
    console.log('-------------------------------')
    console.log();
    if (!connectionString) throw new Error('Empty connection string');
    exec('npx prisma migrate dev', {
        env: { ...process.env, DATABASE_URL: connectionString }
    });
}
