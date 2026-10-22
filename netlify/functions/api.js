import serverless from 'serverless-http';
import app from '../../src/app.js';
import { seedAdmin } from '../../src/utils/catalog.js';

const expressHandler = serverless(app);
let initialization;

export async function handler(event, context) {
  initialization ??= seedAdmin();
  await initialization;
  return expressHandler(event, context);
}
