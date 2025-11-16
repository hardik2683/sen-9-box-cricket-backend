// Routes/RegisterUserApi.js
const express = require("express");
const bcryptjs = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const RegisterUser = require("../models/RegisterUser");
const { authanticateToken } = require("../utils/authMiddlware");
const { toAbsUploadUrl } = require("../utils/url");

const route = express.Router();

/* ---------- Brand + Mail Config ---------- */
const BRAND = {
  NAME: "Box Cricket",
  PRIMARY: "#2C4C97",
  SECONDARY: "#D6A74B",
  FROM_NAME: "Box Cricket Team",
};

const MAIL_USER = process.env.MAIL_USER || "yashkharva506@gmail.com";
const MAIL_PASS = process.env.MAIL_PASS || "gunlfkyciplkmvci";

/* ---------- Multer: save to ./upload ---------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "./upload"),
  filename: (_req, file, cb) =>
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    ),
});
const upload = multer({ storage });

let otpStore = {};

/* ---------- Nodemailer (shared) ---------- */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
});

const buildEmailHtml = ({
  title,
  subtitle,
  intro,
  rows = [],
  footerNote,
  ctaLabel,
  ctaUrl,
}) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title || BRAND.NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.18);">
          <tr>
            <td style="background:${BRAND.PRIMARY};padding:18px 24px;color:#ffffff;">
              <div style="font-size:20px;font-weight:700;">${BRAND.NAME}</div>
              ${
                subtitle
                  ? `<div style="font-size:13px;margin-top:4px;opacity:.9;">${subtitle}</div>`
                  : ""
              }
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 8px 24px;color:#0f172a;">
              ${
                title
                  ? `<div style="font-size:18px;font-weight:600;margin-bottom:8px;">${title}</div>`
                  : ""
              }
              ${
                intro
                  ? `<div style="font-size:14px;line-height:1.6;color:#4b5563;">${intro}</div>`
                  : ""
              }
            </td>
          </tr>

          ${
            rows.length
              ? `
          <tr>
            <td style="padding:8px 24px 16px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb;">
                ${rows
                  .map(
                    (row) => `
                <tr>
                  <td style="padding:8px 12px;font-size:13px;color:#6b7280;width:40%;border-bottom:1px solid #e5e7eb;">${row.label}</td>
                  <td style="padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #e5e7eb;font-weight:500;">${row.value}</td>
                </tr>`
                  )
                  .join("")}
              </table>
            </td>
          </tr>`
              : ""
          }

          ${
            ctaLabel && ctaUrl
              ? `
          <tr>
            <td style="padding:8px 24px 4px 24px;" align="left">
              <a href="${ctaUrl}" style="display:inline-block;background:${BRAND.SECONDARY};color:#111827;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px;text-decoration:none;">
                ${ctaLabel}
              </a>
            </td>
          </tr>`
              : ""
          }

          ${
            footerNote
              ? `
          <tr>
            <td style="padding:12px 24px 20px 24px;font-size:12px;color:#6b7280;line-height:1.5;">
              ${footerNote}
            </td>
          </tr>`
              : ""
          }

          <tr>
            <td style="padding:14px 24px 20px 24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;">
              This email was sent by ${BRAND.FROM_NAME}. If you did not request this, you can ignore it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendMail = async (to, subject, html, textFallback) => {
  try {
    if (!to) return;
    await transporter.sendMail({
      from: `"${BRAND.FROM_NAME}" <${MAIL_USER}>`,
      to,
      subject,
      html,
      text: textFallback || undefined,
    });
  } catch (err) {
    console.error("Register mail error:", err);
  }
};

/* ---------- SEND OTP (image upload happens here) ---------- */
route.post("/send-otp", upload.single("profile_image"), async (req, res) => {
  try {
    const {
      user_id,
      fname,
      lname,
      email,
      mobile,
      gender,
      city,
      state,
      address,
      password,
      cpassword,
    } = req.body;

    const exists = await RegisterUser.findOne({ email });
    if (exists)
      return res.status(400).json({ error: "Email already registered." });

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(String(password || ""), salt);
    const hashedCPassword = await bcryptjs.hash(
      String(cpassword || ""),
      salt
    );

    // absolute URL for profile image
    let profile_image = "";
    if (req.file) {
      profile_image = `${req.protocol}://${req.get("host")}/upload/${
        req.file.filename
      }`;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = {
      otp,
      userData: {
        user_id,
        fname,
        lname,
        email,
        mobile,
        gender,
        city,
        state,
        address,
        password: hashedPassword,
        cpassword: hashedCPassword,
        profile_image,
        role: "user",
      },
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    const html = buildEmailHtml({
      title: "Your OTP Code",
      subtitle: "Secure verification",
      intro: `Hi ${fname || "there"},<br/>Use the following One-Time Password (OTP) to complete your registration with <b>${BRAND.NAME}</b>.`,
      rows: [
        { label: "OTP", value: otp },
        { label: "Valid For", value: "5 minutes" },
      ],
      footerNote:
        "For your security, do not share this OTP with anyone. If you did not initiate this request, you can safely ignore this email.",
    });

    await sendMail(
      email,
      `${BRAND.NAME} – OTP Verification`,
      html,
      `Your OTP is: ${otp} (valid for 5 minutes)`
    );

    res.json({ success: true, message: "OTP sent successfully." });
  } catch (err) {
    console.error("send-otp error:", err);
    res.status(500).json({
      error: "Error sending OTP",
      details: err.message,
    });
  }
});

/* ---------- VERIFY OTP ---------- */
route.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const session = otpStore[email];
    if (!session)
      return res.status(400).json({ error: "OTP not found or expired." });

    if (Date.now() > session.expiresAt) {
      delete otpStore[email];
      return res
        .status(400)
        .json({ error: "OTP expired. Please request a new one." });
    }

    if (session.otp !== otp)
      return res.status(400).json({ error: "Incorrect OTP." });

    const savedUser = await RegisterUser.create(session.userData);
    delete otpStore[email];

    // 🔔 Welcome email
    try {
      const html = buildEmailHtml({
        title: "Welcome to Box Cricket",
        subtitle: "Registration successful",
        intro: `Hi ${
          savedUser.fname || "there"
        },<br/>Your account has been created successfully. You can now log in and book your favourite slots at <b>${BRAND.NAME}</b>.`,
        rows: [
          {
            label: "Name",
            value: `${savedUser.fname || ""} ${
              savedUser.lname || ""
            }`.trim(),
          },
          { label: "Email", value: savedUser.email },
          { label: "Mobile", value: savedUser.mobile || "—" },
        ],
        footerNote:
          "Please keep your login details safe. If you did not create this account, contact support immediately.",
        ctaLabel: "Login Now",
        ctaUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/Signin`,
      });

      await sendMail(
        savedUser.email,
        `${BRAND.NAME} – Welcome`,
        html,
        "Welcome to Box Cricket! Your registration was successful."
      );
    } catch (mailErr) {
      console.error("Welcome email error:", mailErr);
    }

    res.json({
      success: true,
      message: "User registered successfully.",
      data: savedUser,
    });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({
      error: "Error verifying OTP",
      details: err.message,
    });
  }
});

/* ---------- RESEND OTP ---------- */
route.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const session = otpStore[email];
    if (!session)
      return res.status(400).json({
        error: "No OTP session found. Please register again.",
      });

    session.otp = Math.floor(100000 + Math.random() * 900000).toString();
    session.expiresAt = Date.now() + 5 * 60 * 1000;

    const html = buildEmailHtml({
      title: "Your New OTP Code",
      subtitle: "Resent OTP",
      intro: `We have generated a new One-Time Password (OTP) for your registration with <b>${BRAND.NAME}</b>.`,
      rows: [
        { label: "OTP", value: session.otp },
        { label: "Valid For", value: "5 minutes" },
      ],
      footerNote:
        "For your security, do not share this OTP with anyone. If you did not request this, you can safely ignore this email.",
    });

    await sendMail(
      email,
      `${BRAND.NAME} – Resent OTP`,
      html,
      `Your new OTP is: ${session.otp} (valid for 5 minutes).`
    );

    res.json({ success: true, message: "OTP resent successfully." });
  } catch (err) {
    console.error("resend-otp error:", err);
    res.status(500).json({
      error: "Error resending OTP",
      details: err.message,
    });
  }
});

/* ---------- LIST USERS (normalize image to absolute) ---------- */
route.get("/getRegisterUser", authanticateToken, async (req, res) => {
  try {
    const users = await RegisterUser.find();
    const data = users.map((u) => {
      const o = u.toObject();
      o.profile_image = toAbsUploadUrl(req, o.profile_image);
      return o;
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("getRegisterUser error:", err);
    res.status(500).json({
      error: "Error in Fetching RegisterUser",
      details: err.message,
    });
  }
});

module.exports = route;
