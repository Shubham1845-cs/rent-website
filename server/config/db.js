const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod = null;

async function connectDB() {
  const atlasUri = process.env.MONGODB_URI;

  if (!atlasUri) {
    console.warn("⚠️ MONGODB_URI not found in .env");
  } else {
    // Hide password before printing
    const safeUri = atlasUri.replace(/\/\/(.*?):(.*?)@/, "//$1:******@");
    console.log("MongoDB URI:", safeUri);
  }

  // Try MongoDB Atlas first
  if (atlasUri) {
    try {
      console.log("🔄 Connecting to MongoDB Atlas...");

      await mongoose.connect(atlasUri, {
        serverSelectionTimeoutMS: 10000,
      });

      console.log("✅ Connected to MongoDB Atlas");
      console.log("Database:", mongoose.connection.name);
      return;
    } catch (err) {
      console.error("\n❌ MongoDB Atlas Connection Failed");
      console.error("----------------------------------");
      console.error("Error Name   :", err.name);
      console.error("Error Message:", err.message);

      // Print full error for debugging
      console.error("\nFull Error:");
      console.error(err);

      console.log("\n⚠️ Falling back to in-memory MongoDB...\n");
    }
  }

  // Fallback to in-memory MongoDB
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    await mongoose.connect(uri);

    console.log("✅ Connected to In-Memory MongoDB");
    console.log("⚠️ Data will be lost when the server stops.");
  } catch (err) {
    console.error("❌ Failed to start In-Memory MongoDB");
    console.error(err);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }

  console.log("MongoDB Disconnected");
}

module.exports = {
  connectDB,
  disconnectDB,
};