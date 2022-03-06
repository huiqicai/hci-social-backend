import { Context, Hook, HookDecorator, HttpResponseBadRequest, ServiceManager } from '@foal/core';

function isStringArray(arr: unknown[]): arr is string[] {
  return !arr.some(entry => typeof entry !== 'string');
}

export function ParseAttributes(): HookDecorator {
  return Hook(async (ctx: Context, services: ServiceManager) => {
    const query: {attributes?: string | unknown} = ctx.request.query as {attributes?: string | unknown};

    if (!query.attributes) return;

    if (typeof query.attributes === 'string') {
      const parsed = JSON.parse(query.attributes) as unknown;
      query.attributes = [parsed];
    } else if (Array.isArray(query.attributes) && isStringArray(query.attributes)) {
      const parsed = query.attributes.map(filter => JSON.parse(filter) as unknown);
      query.attributes = parsed;
    } else {
      return new HttpResponseBadRequest('Attributes filter should be either a JSON string or an array of JSON strings');
    }
  });
}
