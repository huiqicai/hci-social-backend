import { Config, controller, IAppController } from '@foal/core';
import { createConnection } from 'typeorm';
import { fkFixedSync } from '../utils';

import { ApiController } from './api.controller';
import { OpenApiController } from './openapi.controller';

const prefix = Config.get('api_prefix', 'string', '');
export class AppController implements IAppController {
  subControllers = [
    controller(`${prefix}/swagger`, OpenApiController),
    controller(`${prefix}/api`, ApiController),
  ];

  async init() {
    const conn = await createConnection();
    if (Config.get('database.synchronize', 'boolean', false)) {
      await fkFixedSync(conn);
    }
  }
}
