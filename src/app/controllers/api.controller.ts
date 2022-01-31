import { ApiDefineSchema, ApiDefineSecurityScheme, ApiInfo, ApiSecurityRequirement, ApiServer, Config, Context, controller, Hook, HttpResponseNoContent, Options, UseSessions } from '@foal/core';
import { ConnectionController, GroupController, GroupMemberController, PostController, PostReactionController, FileUploadController } from './api';
import { AuthController } from './api/auth.controller';
import { UserController } from './api/user.controller';
import { attributeSchema, fetchUser } from '../utils';
import { PrismaSessionStore } from '../services';

const prefix = Config.get('api_prefix', 'string', '');

@ApiInfo({
  title: 'HCI-Social API',
  version: '2.0.0'
})
@ApiServer({ url: `${prefix}/api` })
@ApiSecurityRequirement({ bearerAuth: [] })
@ApiDefineSecurityScheme('bearerAuth', { type: 'http', scheme: 'bearer' })
@ApiDefineSchema('attribute', attributeSchema)
@Hook(() => response => { response.setHeader('Access-Control-Allow-Origin', '*'); })
@UseSessions({ user: fetchUser, store: PrismaSessionStore })
export class ApiController {
  subControllers = [
    controller('/auth', AuthController),
    controller('/users', UserController),
    controller('/file-uploads', FileUploadController),
    controller('/connections', ConnectionController),
    controller('/posts', PostController),
    controller('/post-reactions', PostReactionController),
    controller('/groups', GroupController),
    controller('/group-members', GroupMemberController)
  ];

  @Options('*')
  options(ctx: Context) {
    const response = new HttpResponseNoContent();
    response.setHeader('Access-Control-Allow-Methods', 'HEAD, GET, POST, PUT, PATCH, DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }
}
