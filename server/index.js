require("dotenv").config();
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const adminSeed = require("./utils/adminSeed");
const initSocket = require("./socket");

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
initSocket(httpServer);

(async () => {
  await connectDB();
  await adminSeed();
  httpServer.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
})();