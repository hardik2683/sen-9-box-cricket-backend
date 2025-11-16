// db.js
// === Quick dev workaround (temporary) + recommended production alternative ===

/**
 * WARNING:
 * The lines that disable TLS verification below (NODE_TLS_REJECT_UNAUTHORIZED = "0"
 * and tlsAllowInvalidCertificates: true) make your process accept untrusted certificates.
 * Use ONLY for local development / debugging. Do NOT use in production.
 */

/* ---------- DEV: disable Node TLS checks (temporary) ---------- */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // <-- dev only! (global effect)

/* ---------- Mongoose connection ---------- */
const mongoose = require("mongoose");
require("dotenv").config();

mongoose.set("strictQuery", false); // optional

const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,

  // For SRV (mongodb+srv) URIs the driver uses TLS; these options apply to that TLS layer:
  tls: true,
  tlsAllowInvalidCertificates: true,    // dev only: accept self-signed certs
  tlsAllowInvalidHostnames: true,       // dev only: accept hostname mismatch (if needed)
  // ssl: true, // alternative name; tls: true is preferred for modern drivers
};

/* Attempt connection (async) so we can catch immediate errors */
async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URL, connectOptions);
    console.log("✅ Connection successfully to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error (connect attempt):", err);
  }
}

/* Connection event handlers */
mongoose.connection.on("connected", () => {
  console.log("🔗 Mongoose connected");
});
mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error (event):", err);
});
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ Mongoose disconnected");
});
mongoose.connection.on("reconnected", () => {
  console.log("♻️ Mongoose reconnected");
});

/* Start connection immediately */
connectDB();

module.exports = mongoose;

/* ===========================
   PRODUCTION / SECURE OPTION
   ===========================
If you have a CA certificate (recommended for production), remove the
process.env.NODE_TLS_REJECT_UNAUTHORIZED line above and the tlsAllowInvalid* options,
and use sslCA/tlsCAFile to validate the server certificate, for example:

const fs = require("fs");
const ca = fs.readFileSync("/path/to/your/ca.pem");

const secureOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsCAFile: "/path/to/your/ca.pem", // or sslCA: ca
  // OR
  // sslCA: ca
};

await mongoose.connect(process.env.DB_URL, secureOptions);
====================================== */
