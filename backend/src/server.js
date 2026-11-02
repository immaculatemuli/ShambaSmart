import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`ShambaSmart backend on http://localhost:${config.port}`);
});
