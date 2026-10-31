import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => process.stdout.write(`GUTECH LMS API listening on port ${env.PORT}\n`));
