import { dependency, SessionAlreadyExists, SessionState, SessionStore } from '@foal/core';
import { Prisma } from '@prisma/client';
import { DB } from './db.service';

export class PrismaSessionStore extends SessionStore {
  @dependency
  db: DB;

  async save(state: SessionState, maxInactivity: number): Promise<void> {
    if (typeof state.userId !== 'string') {
      throw new Error('Session user ID malformed - got string');
    }

    // In the auth controller when we call setUser (and in PrismaSessionStore#read), we set the ID as <tenantId>|<userId>
    const [tenantId, userIdStr] = state.userId.split('|');
    if (!tenantId || !userIdStr) {
      throw new Error('Session user ID malformed - invalid format');
    }
    const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      throw new Error('Session user ID malformed - user ID is not a number');
    }

    try {
      await this.db.getClient(tenantId).session.create({
        data: {
          content: JSON.stringify(state.content),
          createdAt: state.createdAt,
          flash: JSON.stringify(state.flash),
          id: state.id,
          updatedAt: state.updatedAt,
          userID: userId,
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint failed (we only have one unique field, so this is fine)
        if (e.code === 'P2002') {
          throw new SessionAlreadyExists();
        }
      }
      throw e;
    }
  }

  async read(id: string): Promise<SessionState | null> {
    // This method gets called when a token is passed from the requester, and the requester will pass
    // a token that looks like <tenantId>|<sessionToken>
    const [tenantId, sessionToken] = id.split('|');
    if (!tenantId || !sessionToken) return null;

    const session = await this.db.getClient(tenantId).session.findUnique({ where: { id: sessionToken } });
    if (!session) {
      return null;
    }

    return {
      content: JSON.parse(session.content) as { [key: string]: any; },
      createdAt: session.createdAt,
      flash: JSON.parse(session.flash) as { [key: string]: any; },
      id: session.id,
      updatedAt: session.updatedAt,
      userId: `${tenantId}|${session.userID ?? ''}`,
    };
  }

  async update(state: SessionState, maxInactivity: number): Promise<void> {
    if (typeof state.userId !== 'string') {
      throw new Error('Session user ID malformed - got string');
    }

    // In the auth controller when we call setUser (and in PrismaSessionStore#read), we set the ID as <tenantId>|<userId>
    const [tenantId, userIdStr] = state.userId.split('|');
    if (!tenantId || !userIdStr) {
      throw new Error('Session user ID malformed - invalid format');
    }
    const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      throw new Error('Session user ID malformed - user ID is not a number');
    }

    const data = {
      content: JSON.stringify(state.content),
      createdAt: state.createdAt,
      flash: JSON.stringify(state.flash),
      id: state.id,
      updatedAt: state.updatedAt,
      userID: userId,
    };

    await this.db.getClient(tenantId).session.upsert({
      create: data,
      update: data,
      where: { id: state.id }
    });
  }
  
  async destroy(id: string): Promise<void> {
    // We don't know which tenant this belongs to, so try them all
    for (const tenantId of Object.keys(DB.getTenantsConfig())) {
      try {
        await this.db.getClient(tenantId).session.delete({ where: { id } });
      } catch(e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          // Record to delete not found - this is fine, the session may be for a different tenant
          // or wasn't yet saved
          if (e.code === 'P2025') continue;
        }
        throw e;
      }
    }
  }

  async clear(): Promise<void> {
    // The intent is to clear sessions from the entire app, so we'll remove from all tenants
    for (const tenantId of Object.keys(DB.getTenantsConfig())) {
      await this.db.getClient(tenantId).session.deleteMany();
    }
  }

  async cleanUpExpiredSessions(maxInactivity: number, maxLifeTime: number): Promise<void> {
    // The intent is to clear expired sessions from the entire app, so we'll remove from all tenants
    for (const tenantId of Object.keys(DB.getTenantsConfig())) {
      await this.db.getClient(tenantId).session.deleteMany({
        where: {
          createdAt: { lt: Math.trunc(Date.now() / 1000) - maxLifeTime },
          updatedAt: { lt: Math.trunc(Date.now() / 1000) - maxInactivity },
        }
      });
    }
  }
}
