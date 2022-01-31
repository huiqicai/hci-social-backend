// 3p
import { createApp } from '@foal/core';
import { Application } from 'express';
import * as request from 'supertest';

// App
import { AppController } from '../app/controllers/app.controller';

describe('The server', () => {

  let app: Application;

  before(async () => {
    app = await createApp(AppController) as Application;
  });

  it('should return a 200 status on GET / requests.', () => {
    return request(app)
      .get('/')
      .expect(200);
  });

});
