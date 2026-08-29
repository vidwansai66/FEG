import app from './app.js';
import { config } from './config/env.js';

const startServer = () => {
  app.listen(config.port, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });
};

startServer();
