import { dependency, SessionAlreadyExists, SessionState, SessionStore } from '@foal/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { Prisma } from './prisma.service';

export class ConcreteSessionStore extends SessionStore {
  @dependency
  prisma: Prisma;
  
  async save(state: SessionState, maxInactivity: number): Promise<void> {
    if (typeof state.userId === 'string') {
      throw new Error('[Prisma Session Store] Impossible to save the session. The user ID must be a number.');
    }

    try {
      await this.prisma.client.session.create({
        data: {
          content: JSON.stringify(state.content),
          createdAt: state.createdAt,
          flash: JSON.stringify(state.flash),
          id: state.id,
          updatedAt: state.updatedAt,
          userID: state.userId,
        }
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        // Unique constraint failed (we only have one unique field, so this is fine)
        if (e.code === 'P2002') {
          throw new SessionAlreadyExists();
        }
      }
      throw e;
    }
  }

  async read(id: string): Promise<SessionState | null> {
    const session = await this.prisma.client.session.findUnique({ where: { id } });
    if (!session) {
      return null;
    }

    return {
      content: JSON.parse(session.content) as { [key: string]: any; },
      createdAt: session.createdAt,
      flash: JSON.parse(session.flash) as { [key: string]: any; },
      id: session.id,
      updatedAt: session.updatedAt,
      // Note: session.user_id is actually a number or null (not undefined).
      userId: session.userID,
    };
  }

  async update(state: SessionState, maxInactivity: number): Promise<void> {
    if (typeof state.userId === 'string') {
      throw new Error('[Prisma Session Store] Impossible to save the session. The user ID must be a number.');
    }

    const data = {
      content: JSON.stringify(state.content),
      createdAt: state.createdAt,
      flash: JSON.stringify(state.flash),
      id: state.id,
      updatedAt: state.updatedAt,
      userID: state.userId,
    };

    await this.prisma.client.session.upsert({
      create: data,
      update: data,
      where: { id: state.id }
    });
  }
  
  async destroy(id: string): Promise<void> {
    await this.prisma.client.session.delete({ where: { id } });
  }

  async clear(): Promise<void> {
    await this.prisma.client.session.deleteMany();
  }

  async cleanUpExpiredSessions(maxInactivity: number, maxLifeTime: number): Promise<void> {
    await this.prisma.client.session.deleteMany({
      where: {
        createdAt: { lt: Math.trunc(Date.now() / 1000) - maxLifeTime },
        updatedAt: { lt: Math.trunc(Date.now() / 1000) - maxInactivity },
      }
    })
  }
}