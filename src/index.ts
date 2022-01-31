import 'source-map-support/register';
import {createServer} from 'http';
import { Config, createApp } from '@foal/core';
import { AppController } from './app/controllers/app.controller';
import type { Application } from 'express';

async function main() {
  const app = (await createApp(AppController)) as Application;

  const socket = Config.get('listen_socket', 'string');
  const httpServer = createServer(app);
  if (socket) {
    httpServer.listen(socket, () => {
      console.log(`Listening on socket ${socket}...`);
    });
  } else {
    const port = Config.getOrThrow('listen_port', 'number');
    httpServer.listen(port, () => {
      console.log(`Listening on port ${port}...`);
    });
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
