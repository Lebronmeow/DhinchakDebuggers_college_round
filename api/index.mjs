import { createApp } from "../server/app.mjs";

let appPromise = null;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  return app(req, res);
}
