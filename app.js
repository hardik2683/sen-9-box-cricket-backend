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
   FIXED CORS (FINAL + PRODUCTION SAFE)
---------------------------------------- */
const allowedOrigins = [
  "https://sen-9-box-cricket-frontend.vercel.app",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight headers
app.options("*", cors());

/* ----------------------------------------
   BODY PARSERS
---------------------------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
app.get("/", (_req, res) => res.send("Backend Running Successfully 🚀"));
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
  console.error("🚨 Global Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});

/* ----------------------------------------
   START SERVER
---------------------------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log("CORS Allowed Origins:", allowedOrigins);
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
