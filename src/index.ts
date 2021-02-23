import 'source-map-support/register';

// 3p
import { Config, createApp } from '@foal/core';

// App
import { AppController } from './app/controllers/app.controller';

async function main() {
  const app = await createApp(AppController);

  const socket = Config.get('listen_socket', 'string');
  if (socket) {
    const fcgi = require('node-fastcgi');
    const httpServer = fcgi.createServer(app);
    httpServer.listen(socket, () => {
      console.log(`Listening on socket ${socket}...`);
    });
  } else {
    const port = Config.get('port', 'number', 3001);
    const http = require('http');
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
      console.log(`Listening on port ${port}...`);
    });
  }
}

main()
  .catch(err => { console.error(err.stack); process.exit(1); });
