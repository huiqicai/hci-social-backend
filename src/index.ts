import 'source-map-support/register';
import { Config, ServiceManager, createApp } from '@foal/core';
import { AppController } from './app/controllers/app.controller';
import type { Application } from 'express';
import * as http from 'http';
import { WebsocketService } from './app/services/ws.service';


async function main() {

  const serviceManager = new ServiceManager();
  
  const app = (await createApp(AppController, {serviceManager})) as Application;

  const socket = Config.get('listen_socket', 'string');
  const httpServer = http.createServer(app);
  await serviceManager.get(WebsocketService).attachHttpServer(httpServer);

  if (socket) {
    httpServer.listen(socket, () => {
      console.log(`Listening on socket ${socket}...`);
      serviceManager.get(WebsocketService).attachHttpServer(httpServer)
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