import 'source-map-support/register';

// std
import * as http from 'http';

// 3p
import { Config, createApp } from '@foal/core';

// App
import { AppController } from './app/controllers/app.controller';

async function main() {
  const app = await createApp(AppController);

  const httpServer = http.createServer(app);
  const socket = Config.get('listen_socket', 'string');
  if (socket) {
    httpServer.listen(socket, () => {
      console.log(`Listening on socket ${socket}...`);
    });
  } else {
    const port = Config.get('port', 'number', 3001);
    httpServer.listen(port, () => {
      console.log(`Listening on port ${port}...`);
    });
  }
}

main()
  .catch(err => { console.error(err.stack); process.exit(1); });
