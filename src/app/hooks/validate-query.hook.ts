import { HookDecorator, MergeHooks } from '@foal/core';
import { ValidateQueryParamWithDoc } from './validate-query-param-with-doc';

export function ValidateQuery(
  schema: {properties: Record<string, {description?: string, [key: string]: any}>, required: readonly string[]}
): HookDecorator {  
  return MergeHooks(
    ...Object.keys(schema.properties).map(
      name => ValidateQueryParamWithDoc(name, schema.properties[name], {
        required: schema.required.includes(name),
        description: schema.properties[name].description
      })
    )
  );
}
