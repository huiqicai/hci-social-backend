import { ApiDefineSchema, ApiDefineSecurityScheme, ApiInfo, ApiSecurityRequirement, ApiServer, Config, Context, controller, Hook, HttpResponseNoContent, Options, UseSessions, ValidatePathParam } from '@foal/core';
import { ConnectionController, GroupController, GroupMemberController, PostController, PostReactionController, FileUploadController, ChatHistoryController } from './api';
import { AuthController } from './api/auth.controller';
import { UserController } from './api/user.controller';
import { BadgeController } from './api/badge.controller';
import { UserBadgeController } from './api/user-badge.controller';

import { attributeSchema, fetchUser } from '../utils';
import { DB, PrismaSessionStore } from '../services';

const prefix = Config.get('api_prefix', 'string', '');
const tenants = Object.keys(DB.getTenantsConfig());

@ApiInfo({
  title: 'HCI-Social API',
  version: '2.0.0'
})
@ApiServer({ url: `${prefix}/api/{tenantId}`, variables: {'tenantId': {enum: tenants, default: tenants[0]}} })
@ApiSecurityRequirement({ bearerAuth: [] })
@ApiDefineSecurityScheme('bearerAuth', { type: 'http', scheme: 'bearer' })
@ApiDefineSchema('attribute', attributeSchema)
@ValidatePathParam('tenantId', { type: 'string' }, { openapi: false })
@Hook(() => response => { response.setHeader('Access-Control-Allow-Origin', '*'); })
@UseSessions({ store: PrismaSessionStore, user: fetchUser })
export class ApiController {
  subControllers = [
    controller('/auth', AuthController),
    controller('/users', UserController),
    controller('/file-uploads', FileUploadController),
    controller('/connections', ConnectionController),
    controller('/posts', PostController),
    controller('/post-reactions', PostReactionController),
    controller('/groups', GroupController),
    controller('/group-members', GroupMemberController),
    controller('/chat-history', ChatHistoryController),
    controller('/badge', BadgeController),
    controller('/user-badge', UserBadgeController),
  ];

  @Options('*')
  options(ctx: Context) {
    const response = new HttpResponseNoContent();
    response.setHeader('Access-Control-Allow-Methods', 'HEAD, GET, POST, PUT, PATCH, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }
}
