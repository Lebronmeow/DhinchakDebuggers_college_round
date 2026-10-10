import { createApp } from "./app.mjs";
const app = await createApp();
app.listen(3100, "127.0.0.1", () =>
  console.log("Nexus API listening on http://127.0.0.1:3100"),
);
