// app.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");

// Init DB
require("./db.js");

const userRoute = require("./Routes/userApi");
const registerUserAPI = require("./Routes/RegisterUserApi");

const app = express();

app.set("trust proxy", 1);

/* ----------------------------------------
   FIXED CORS (FINAL)
---------------------------------------- */
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// If empty allow ALL (development)
const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

/* For preflight requests */
app.options("*", cors(corsOptions));

/* ----------------------------------------
   BODY PARSERS
---------------------------------------- */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* ----------------------------------------
   STATIC / UPLOADS
---------------------------------------- */
const uploadDir = path.join(__dirname, "upload");
fs.mkdirSync(uploadDir, { recursive: true });

app.use(
  "/upload",
  express.static(uploadDir, {
    etag: true,
    maxAge: "7d",
    fallthrough: true,
  })
);

/* ----------------------------------------
   ROUTES
---------------------------------------- */
app.get("/", (_req, res) => res.send("Hello World"));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.use("/api/userapi", userRoute);
app.use("/api/registeruserapi", registerUserAPI);

/* ----------------------------------------
   404 Handler
---------------------------------------- */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    path: req.originalUrl,
  });
});

/* ----------------------------------------
   GLOBAL ERROR HANDLER
---------------------------------------- */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

/* ----------------------------------------
   START SERVER
---------------------------------------- */
const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (allowedOrigins.length) {
    console.log("CORS allowed origins:", allowedOrigins);
  } else {
    console.log("CORS: allowing ALL origins (dev mode)");
  }
});

/* ----------------------------------------
   PROCESS SAFETY
---------------------------------------- */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
