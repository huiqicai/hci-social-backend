import { Context, Hook, HookDecorator, ServiceManager } from '@foal/core';

export function ParseAttributes(): HookDecorator {
  return Hook(async (ctx: Context, services: ServiceManager) => {
    const query: {attributes?: string | unknown} = ctx.request.query as {attributes?: string | unknown};

    if (query.attributes && typeof query.attributes === 'string') {
      const parsed = JSON.parse(query.attributes) as unknown;
      if (Array.isArray(parsed)) query.attributes = parsed;
      else query.attributes = [parsed];
    }
  });
}
