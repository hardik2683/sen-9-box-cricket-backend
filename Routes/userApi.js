// routes/userapi.js
require("dotenv").config();

const express = require("express");
const bcryptjs = require("bcryptjs");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const Stripe = require("stripe");


const Feedback = require("../models/Feedback");
const Booking = require("../models/Booking");
const Area = require("../models/Area");
const AreaWiseSlot = require("../models/AreaWiseSlot");
const Counter = require("../models/Counter");

const ContactUs = require("../models/Contactus");
const RegisterUser = require("../models/RegisterUser");

const normEmail = (e) => String(e || "").trim().toLowerCase();

const { generateToken } = require("../utils/jwtutils");
const { auth } = require("../utils/authMiddlware"); // <-- unified auth
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

/* ---------- Stripe ---------- */
const stripeSecret =
  process.env.STRIPE_SECRET_KEY ||
  "sk_test_51QyZGWFEFmRRpSNl286lgNOzVBFmxoaL3QbT3IlGi3xRprd0SQEhyaxVmZy6XVnqh8O6fxInrFGG8EU2UCyJLG3I00CzFpfsGR";
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const STRIPE_SUCCESS_PATH =
  process.env.STRIPE_SUCCESS_PATH || "/payment-success";
const STRIPE_CANCEL_PATH =
  process.env.STRIPE_CANCEL_PATH || "/payment-cancelled";

/* ---------- helpers ---------- */
const isBcryptHash = (v) =>
  typeof v === "string" && /^\$2[aby]\$\d{2}\$/.test(v || "");
// const normEmail = (e) => String(e || "").trim().toLowerCase();

/* ---------- email helper (branded) ---------- */
const mailer = nodemailer.createTransport({
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
              This email was sent by ${BRAND.FROM_NAME}. If you did not expect this email, you can safely ignore it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendMail = async (to, subject, html) => {
  try {
    if (!to) return;
    await mailer.sendMail({
      from: `"${BRAND.FROM_NAME}" <${MAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("Mail error:", e);
  }
};

/* ---------- Booking mail helpers ---------- */
async function sendBookingConfirmationEmail(booking) {
  try {
    const user = await RegisterUser.findById(booking.user_id).lean().catch(() => null);
    const recipient = booking.email || user?.email;
    if (!recipient) return;

    const fullName = user
      ? `${user.fname || ""} ${user.lname || ""}`.trim()
      : "";

    const html = buildEmailHtml({
      title: "Your Booking is Confirmed",
      subtitle: "Payment successful",
      intro: `Hi ${fullName || "there"},<br/>Your booking with ${
        BRAND.NAME
      } is now <b>confirmed</b>. Here are your booking details:`,
      rows: [
        { label: "Booking ID", value: String(booking._id) },
        {
          label: "Area",
          value:
            booking.area_name ||
            (booking.area_id && booking.area_id.area_name) ||
            "—",
        },
        {
          label: "Date",
          value: booking.date
            ? new Date(booking.date).toLocaleDateString()
            : "—",
        },
        {
          label: "Time",
          value:
            booking.start_time && booking.end_time
              ? `${booking.start_time} – ${booking.end_time}`
              : "See ticket",
        },
        { label: "Total Price", value: `₹${booking.price}` },
        {
          label: "Advance Paid",
          value: `₹${booking.advance_payment}`,
        },
        {
          label: "Payment Status",
          value: booking.payment_status || "paid",
        },
      ],
      footerNote:
        "You can download your ticket anytime from your bookings page. Please arrive a few minutes early for your slot.",
      ctaLabel: "View My Bookings",
      ctaUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/my-bookings`,
    });

    await sendMail(recipient, `${BRAND.NAME} – Booking Confirmed`, html);
  } catch (err) {
    console.error("Booking confirmation mail error:", err);
  }
}

async function sendBookingCancelOrRefundEmail(booking, { triggeredByAdmin }) {
  try {
    const user = await RegisterUser.findById(booking.user_id).lean().catch(() => null);
    const recipient = booking.email || user?.email;
    if (!recipient) return;

    const fullName = user
      ? `${user.fname || ""} ${user.lname || ""}`.trim()
      : "";

    const hadPaidOrRefundPending =
      booking.payment_status === "refund_pending" ||
      booking.payment_status === "refunded";

    const subject = hadPaidOrRefundPending
      ? `${BRAND.NAME} – Booking Cancelled & Refund Initiated`
      : `${BRAND.NAME} – Booking Cancelled`;

    const intro = `
      Hi ${fullName || "there"},<br/>
      Your booking has been <b>cancelled</b>${
        triggeredByAdmin ? " by our team" : ""
      }.
      ${
        hadPaidOrRefundPending
          ? "<br/>A refund for your advance payment will be processed shortly."
          : ""
      }
    `;

    const footerNote = hadPaidOrRefundPending
      ? "Refund timelines may vary across banks and card providers. If you do not see the refund within 5–7 working days, please contact support with your booking ID."
      : "As no advance payment was captured, there is no refund associated with this cancellation.";

    const html = buildEmailHtml({
      title: "Booking Cancelled",
      subtitle: triggeredByAdmin ? "Cancelled by Admin" : "",
      intro,
      rows: [
        { label: "Booking ID", value: String(booking._id) },
        {
          label: "Area",
          value:
            booking.area_name ||
            (booking.area_id && booking.area_id.area_name) ||
            "—",
        },
        {
          label: "Date",
          value: booking.date
            ? new Date(booking.date).toLocaleDateString()
            : "—",
        },
        { label: "Total Price", value: `₹${booking.price}` },
        {
          label: "Advance Paid",
          value: `₹${booking.advance_payment}`,
        },
        {
          label: "Due Amount",
          value: `₹${booking.due_payment}`,
        },
        {
          label: "Payment Status",
          value: booking.payment_status || "cancelled",
        },
      ],
      footerNote,
      ctaLabel: "View My Bookings",
      ctaUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/my-bookings`,
    });

    await sendMail(recipient, subject, html);
  } catch (err) {
    console.error("Booking cancel/refund mail error:", err);
  }
}

/* ---------- counter helper ---------- */
const getNextSequenceValue = async (modelName) => {
  const counter = await Counter.findOneAndUpdate(
    { modelName },
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true }
  );
  return counter.sequenceValue;
};

/* ---------- PDF ticket ---------- */
async function generateTicketPDF(bookingDetails) {
  return new Promise(async (resolve, reject) => {
    try {
      const slot = await AreaWiseSlot.findById(
        bookingDetails.slot_id
      ).populate("area");
      if (!slot || !slot.area)
        return reject(new Error("Slot/Area not found"));

      const user = await RegisterUser.findById(bookingDetails.user_id);
      if (!user) return reject(new Error("User not found"));

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const ticketPath = path.join(
        __dirname,
        `../tickets/ticket_${bookingDetails._id}.pdf`
      );
      const dir = path.dirname(ticketPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const writeStream = fs.createWriteStream(ticketPath);
      doc.pipe(writeStream);

      const leftX = 70;
      const rightX = 300;
      const lineSpacing = 20;

      const logoPath = path.join(__dirname, "../assets/logo.png");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, doc.page.width / 2 - 50, 30, { width: 100 });
      }

      doc.moveDown(5);
      const headerTop = doc.y;
      doc.rect(0, headerTop - 20, doc.page.width, 100).fill("#ffcccc");
      doc
        .fillColor("#ff4d4d")
        .fontSize(28)
        .text("Box Cricket Ticket", { align: "center" });
      doc
        .fillColor("black")
        .fontSize(16)
        .text("Booking Confirmed", { align: "center" })
        .moveDown(1);
      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(1)
        .stroke();
      doc.moveDown(2);

      const bodyTop = doc.y;
      doc.rect(40, bodyTop - 10, 520, 400).fill("#f9f9f9");
      doc.fillColor("black").fontSize(14);

      let currentY = bodyTop;
      doc.font("Helvetica").fillColor("#333333");
      doc.text("Booking ID:", leftX, currentY + 10);
      doc.text("User Name:", leftX, currentY + 30);
      doc.text("Mobile:", leftX, currentY + 50);
      doc.text("Area Name:", leftX, currentY + 70);
      doc.text("Slot Time:", leftX, currentY + 90);
      doc.text("Booking Date:", leftX, currentY + 110);
      doc.text("Slot ID:", leftX, currentY + 130);

      doc.font("Helvetica-Bold");
      doc
        .fillColor("#3366cc")
        .text(`${bookingDetails._id}`, rightX, currentY + 10);
      doc
        .fillColor("#3366cc")
        .text(`${user.fname} ${user.lname}`, rightX, currentY + 30);
      doc
        .fillColor("#3366cc")
        .text(`${user.mobile}`, rightX, currentY + 50);
      doc
        .fillColor("#3366cc")
        .text(`${slot.area.area_name}`, rightX, currentY + 70);
      doc
        .fillColor("#3366cc")
        .text(
          `${slot.slot_start_time} to ${slot.slot_end_time}`,
          rightX,
          currentY + 90
        );
      doc
        .fillColor("#3366cc")
        .text(
          `${new Date(bookingDetails.date).toLocaleDateString()}`,
          rightX,
          currentY + 110
        );
      doc
        .fillColor("#3366cc")
        .text(`${bookingDetails.slot_id}`, rightX, currentY + 130);

      doc.moveDown(8);
      doc
        .font("Helvetica")
        .fontSize(16)
        .fillColor("#ff4d4d")
        .text("Payment Details", { align: "center" })
        .moveDown(1);

      doc.fontSize(14);
      currentY = doc.y;
      doc.font("Helvetica").fillColor("#333333");
      doc.text("Total Price:", leftX, currentY);
      doc.text("Advance Payment:", leftX, currentY + lineSpacing);
      doc.text("Due Payment:", leftX, currentY + lineSpacing * 2);
      doc.text("Payment Status:", leftX, currentY + lineSpacing * 3);

      doc.font("Helvetica-Bold");
      doc
        .fillColor("#3366cc")
        .text(`${bookingDetails.price}`, rightX, currentY);
      doc
        .fillColor("#ff9933")
        .text(
          `${bookingDetails.advance_payment}`,
          rightX,
          currentY + lineSpacing
        );
      doc
        .fillColor("#ff4d4d")
        .text(
          `${bookingDetails.due_payment}`,
          rightX,
          currentY + lineSpacing * 2
        );
      doc
        .fillColor("#00cc66")
        .text(
          `${bookingDetails.payment_status}`,
          rightX,
          currentY + lineSpacing * 3
        );

      const qrData = `Booking ID: ${bookingDetails._id}
User Name: ${user.fname} ${user.lname}
Mobile: ${user.mobile}
Area Name: ${slot.area.area_name}
Slot Timing: ${slot.slot_start_time} to ${slot.slot_end_time}
Booking Date: ${new Date(
        bookingDetails.date
      ).toLocaleDateString()}
Slot ID: ${bookingDetails.slot_id}
Total Price: ₹${bookingDetails.price}
Advance Payment: ₹${bookingDetails.advance_payment}
Due Payment: ₹${bookingDetails.due_payment}
Payment Status: ${bookingDetails.payment_status}`;

      const qrImage = await QRCode.toDataURL(qrData);
      doc.image(qrImage, doc.page.width / 2 - 50, doc.y + 40, {
        width: 100,
      });

      doc.moveDown(8);
      const cutLineY = doc.y;
      doc
        .moveTo(50, cutLineY)
        .lineTo(doc.page.width - 50, cutLineY)
        .dash(5, { space: 5 })
        .strokeColor("#999999")
        .lineWidth(1)
        .stroke();
      doc.undash();
      doc.moveDown(2);

      const footerTop = doc.y;
      doc.rect(0, footerTop, doc.page.width, 70).fill("#ffcccc");
      doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor("gray")
        .text("Thank you for booking with Box Cricket!", 0, footerTop + 25, {
          align: "center",
        });

      doc.end();
      writeStream.on("finish", () => resolve(ticketPath));
      writeStream.on("error", (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
}

/* ---------- Generic CRUD helper ---------- */
const createCRUDRoutes = (model, modelName, endpoint, options = {}) => {
  const { isUser = false, autoSequenceField = null } = options;

  // CREATE
  route.post(`/add${endpoint}`, async (req, res) => {
    try {
      const payload = { ...(req.body || {}) };

      if (autoSequenceField) {
        const nextId = await getNextSequenceValue(modelName);
        payload[autoSequenceField] = nextId;
      }

      if (isUser && payload.password && !isBcryptHash(payload.password)) {
        payload.password = await bcryptjs.hash(payload.password, 10);
        payload.cpassword = payload.password;
      }

      const saved = await model.create(payload);
      res
        .status(201)
        .json({
          success: `${modelName} Inserted Successfully`,
          data: saved,
        });
    } catch (error) {
      if (error.code === 11000) {
        res.status(400).json({
          error: `Duplicate key error: ${modelName} already exists`,
          details: error.message,
        });
      } else {
        res.status(500).json({
          error: `Error Saving ${modelName}`,
          details: error.message,
        });
      }
    }
  });

  // READ
  route.get(`/view${endpoint}`, async (req, res) => {
    try {
      const query = req.query || {};
      const searchFilter = {};
      const areaFilterName = query.area;
      if (areaFilterName) delete query.area;

      Object.keys(query).forEach((key) => {
        if (query[key]) searchFilter[key] = new RegExp(query[key], "i");
      });

      let q = model.find(searchFilter);
      if (model.schema.paths.area) q = q.populate("area", "area_name");

      let allData = await q;
      if (areaFilterName) {
        const target = String(areaFilterName).toLowerCase();
        allData = allData.filter(
          (doc) =>
            doc.area &&
            String(doc.area.area_name || "").toLowerCase().trim() ===
              target
        );
      }

      res
        .status(200)
        .json({
          success: `${modelName} Fetched Successfully`,
          data: allData,
        });
    } catch (error) {
      res.status(500).json({
        error: `Error Fetching ${modelName}`,
        details: error.message,
      });
    }
  });

  // DELETE
  route.delete(`/delete${endpoint}/:id`, async (req, res) => {
    try {
      const deleted = await model.findByIdAndDelete(req.params.id);
      if (!deleted)
        return res
          .status(404)
          .json({ error: `${modelName} Not Found` });
      res
        .status(200)
        .json({ success: `${modelName} Deleted`, data: deleted });
    } catch (error) {
      res.status(500).json({
        error: `Error Deleting ${modelName}`,
        details: error.message,
      });
    }
  });

  // UPDATE
  route.put(`/update${endpoint}/:id`, async (req, res) => {
    try {
      const updateData = { ...(req.body || {}) };

      if (
        isUser &&
        updateData.password &&
        !isBcryptHash(updateData.password)
      ) {
        updateData.password = await bcryptjs.hash(
          String(updateData.password),
          10
        );
        updateData.cpassword = updateData.password;
      }

      const updated = await model.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
      if (!updated)
        return res
          .status(404)
          .json({ error: `${modelName} Not Found` });
      res
        .status(200)
        .json({ success: `${modelName} Updated`, data: updated });
    } catch (error) {
      res.status(500).json({
        error: `Error Updating ${modelName}`,
        details: error.message,
      });
    }
  });
};

/* ---------- bind CRUD routes ---------- */
createCRUDRoutes(RegisterUser, "RegisterUser", "User", { isUser: true });
createCRUDRoutes(ContactUs, "Franchise", "Franchise");
createCRUDRoutes(Feedback, "Feedback", "Feedback");
createCRUDRoutes(Booking, "Booking", "Booking");
createCRUDRoutes(Area, "Area", "Area", { autoSequenceField: "area_id" });
createCRUDRoutes(AreaWiseSlot, "AreaWiseSlot", "AreaWiseSlot", {
  autoSequenceField: "slot_id",
});

/* ---------- Login route ---------- */
route.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Email and password are required." });
    }

    const user = await RegisterUser.findOne({
      email: normEmail(email),
    });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password." });
    }

    const stored =
      (user.password && String(user.password).trim()) ||
      (user.cpassword && String(user.cpassword).trim()) ||
      "";

    let isMatch = false;
    if (stored) {
      if (isBcryptHash(stored))
        isMatch = await bcryptjs.compare(password, stored);
      else isMatch = stored === password;
    }
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password." });
    }

    let role = user.role || "user";
    if (user.email === "superadmin@gmail.com" && !user.role)
      role = "superadmin";

    const token = generateToken({ _id: user._id, email: user.email, role });
    const redirectTo =
      role === "superadmin" || role === "admin" ? "/admin" : "/";

    return res.json({
      success: true,
      message: "Login successful",
      token,
      role,
      redirectTo,
      user: {
        _id: user._id,
        id: user._id,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        mobile: user.mobile,
        role,
        city: user.city,
        state: user.state,
        address: user.address,
        profile_image: toAbsUploadUrl(req, user.profile_image),
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Login failed", details: err.message });
  }
});

/* ---------- Counts Summary route ---------- */
route.get("/counts/summary", async (req, res) => {
  try {
    const { city } = req.query || {};

    const userFilter = {};
    const bookingFilter = {};
    const contactFilter = {};
    const feedbackFilter = {};
    const areaFilter = {};
    const slotFilter = {};

    if (city) {
      userFilter.city = city;
      bookingFilter.city = city;
      contactFilter.city = city;
      feedbackFilter.city = city;
      areaFilter.city = city;
      slotFilter.city = city;
    }

    const [
      areas,
      areaWiseSlots,
      feedback,
      contactus,
      booking,
      users,
    ] = await Promise.all([
      Area.countDocuments(areaFilter),
      AreaWiseSlot.countDocuments(slotFilter),
      Feedback.countDocuments(feedbackFilter),
      ContactUs.countDocuments(contactFilter),
      Booking.countDocuments(bookingFilter),
      RegisterUser.countDocuments(userFilter),
    ]);

    return res.json({
      success: true,
      data: { areas, areaWiseSlots, feedback, contactus, booking, users },
    });
  } catch (err) {
    console.error("Counts summary error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch counts summary",
      details: err.message,
    });
  }
});

/* ---------- Franchise Superadmin endpoints ---------- */
/* =========================================================
   FRANCHISE LEADS (SUPERADMIN) + APPLY ENDPOINT
   ========================================================= */

// POST /api/userapi/franchise/apply
// Called from your multi-step ContactUs form on the public site
route.post("/franchise/apply", async (req, res) => {
  try {
    const body = req.body || {};

    // Basic required fields
    const name = String(body.name || "").trim();
    const email = normEmail(body.email);
    const phone = String(body.phone || "").trim();
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim();

    if (!name || !email || !phone || !city || !state) {
      return res.status(400).json({
        success: false,
        error: "Name, email, phone, city and state are required.",
      });
    }

    // Coerce numbers safely
    const areaSqFt = Number(body.areaSqFt || 0) || 0;
    const investmentBudget = Number(body.investmentBudget || 0) || 0;
    const yearsExperience = Number(body.yearsExperience || 0) || 0;

    const payload = {
      name,
      email,
      phone,
      city,
      state,
      haveVenue: !!body.haveVenue,
      venueType: body.haveVenue ? body.venueType || "NA" : "NA",
      areaSqFt,
      address: body.address || "",
      investmentBudget,
      timeline: body.timeline || "0-3 months",
      experienceSports: !!body.experienceSports,
      yearsExperience,
      currentBusiness: body.currentBusiness || "",
      message: body.message || "",
      howHeard: body.howHeard || "",
      agree: !!body.agree,
      status: "pending",
    };

    const lead = await ContactUs.create(payload);

    // Optional: notify internal email
    try {
      const html = buildEmailHtml({
        title: "New Franchise Enquiry",
        subtitle: "Franchise Lead Submitted",
        intro: `A new franchise enquiry has been submitted for ${BRAND.NAME}.`,
        rows: [
          { label: "Name", value: lead.name },
          { label: "Email", value: lead.email },
          { label: "Phone", value: lead.phone },
          { label: "City", value: lead.city },
          { label: "State", value: lead.state },
          {
            label: "Venue",
            value: lead.haveVenue
              ? `${lead.venueType} • ${lead.areaSqFt} sqft`
              : "No venue yet",
          },
          {
            label: "Budget",
            value: `₹${lead.investmentBudget || 0}`,
          },
          { label: "Timeline", value: lead.timeline },
        ],
        footerNote:
          "This is an internal notification. Please contact the lead and update the status in the Superadmin panel.",
      });

      await sendMail(
        process.env.SALES_EMAIL || MAIL_USER,
        `${BRAND.NAME} – New Franchise Enquiry`,
        html
      );
    } catch (mailErr) {
      console.error("Franchise apply mail error:", mailErr);
    }

    return res.status(201).json({
      success: true,
      message: "Franchise enquiry submitted",
      data: lead,
    });
  } catch (err) {
    console.error("franchise/apply error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to submit franchise enquiry",
      details: err.message,
    });
  }
});

// GET /api/userapi/franchise/list
route.get("/franchise/list", async (req, res) => {
  try {
    const { status, q } = req.query || {};
    const filter = {};

    if (status && status !== "all") {
      if (status === "pending") {
        filter.$or = [
          { status: { $exists: false } },
          { status: "" },
          { status: null },
          { status: "pending" },
        ];
      } else {
        filter.status = status;
      }
    }

    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), "i");
      filter.$or = (filter.$or || []).concat([
        { name: rx },
        { email: rx },
        { phone: rx },
        { city: rx },
        { state: rx },
        { message: rx },
      ]);
    }

    const leads = await ContactUs.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, data: leads });
  } catch (err) {
    console.error("Franchise list error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch franchise leads",
      details: err.message,
    });
  }
});

// PUT /api/userapi/franchise/:id/approve
route.put("/franchise/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Load lead
    const lead = await ContactUs.findById(id);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, error: "Franchise lead not found" });
    }

    const safeEmail = normEmail(lead.email);
    if (!safeEmail) {
      return res.status(400).json({
        success: false,
        error: "Lead email missing; cannot create/upgrade admin",
      });
    }

    // 2) Find or create admin user by lowercase email
    let adminUser = await RegisterUser.findOne({ email: safeEmail });
    let generatedPassword = null;
    let isNewUser = false;

    if (!adminUser) {
      // ---- New admin user ----
      isNewUser = true;
      generatedPassword = Math.random().toString(36).slice(-8);
      const hashed = await bcryptjs.hash(generatedPassword, 10);

      adminUser = await RegisterUser.create({
        fname: lead.name || "Franchise",
        lname: "Admin",
        email: safeEmail,
        mobile: lead.phone || "",
        role: "admin",
        password: hashed,
        cpassword: hashed,
        city: lead.city || "",
        state: lead.state || "",
        address: lead.address || "",
      });
    } else {
      // ---- Existing user → upgrade to admin (unless superadmin) ----
      const newRole =
        adminUser.role === "superadmin" ? "superadmin" : "admin";

      const update = {
        role: newRole,
      };

      if (!adminUser.city) update.city = lead.city || "";
      if (!adminUser.state) update.state = lead.state || "";
      if (!adminUser.address) update.address = lead.address || "";

      adminUser = await RegisterUser.findByIdAndUpdate(
        adminUser._id,
        { $set: update },
        { new: true }
      );
    }

    // 3) Update the lead status
    const updatedLead = await ContactUs.findByIdAndUpdate(
      id,
      {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.body.approvedBy || "Superadmin",
        createdAdminId: adminUser?._id || lead.createdAdminId,
      },
      { new: true }
    );

    // 4) Send email (different text for new vs existing admin)
    if (isNewUser && generatedPassword) {
      const html = buildEmailHtml({
        title: "Your Franchise Admin Access",
        subtitle: "Franchise Approved",
        intro: `Dear ${
          lead.name || "Partner"
        },<br/>Your franchise request has been <b>approved</b>. A new admin account has been created for you on <b>${BRAND.NAME}</b>.`,
        rows: [
          { label: "Login Email", value: safeEmail },
          { label: "Temporary Password", value: generatedPassword },
        ],
        footerNote:
          "For security, please log in and change your password immediately after first login.",
        ctaLabel: "Go to Admin Login",
        ctaUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/Signin`,
      });

      await sendMail(
        safeEmail,
        `${BRAND.NAME} – Franchise Approved (Admin Access)`,
        html
      );
    } else {
      const html = buildEmailHtml({
        title: "Your Account is Now Admin",
        subtitle: "Franchise Approved",
        intro: `Dear ${
          lead.name || "Partner"
        },<br/>Your franchise request has been <b>approved</b>. Your existing account on <b>${BRAND.NAME}</b> has been upgraded to <b>Admin</b>.`,
        rows: [
          { label: "Login Email", value: safeEmail },
          { label: "Role", value: adminUser.role || "admin" },
        ],
        footerNote:
          "You can continue to log in with your existing password. If you don’t remember it, please use the “Forgot Password” option on the login page.",
        ctaLabel: "Go to Admin Login",
        ctaUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/Signin`,
      });

      await sendMail(
        safeEmail,
        `${BRAND.NAME} – Admin Access Granted`,
        html
      );
    }

    return res.json({
      success: true,
      data: { lead: updatedLead, adminUser },
    });
  } catch (err) {
    console.error("Franchise approve error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to approve franchise lead",
      details: err.message,
    });
  }
});

// PUT /api/userapi/franchise/:id/reject
route.put("/franchise/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await ContactUs.findById(id);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, error: "Franchise lead not found" });
    }

    const updatedLead = await ContactUs.findByIdAndUpdate(
      id,
      { status: "rejected", rejectedAt: new Date() },
      { new: true }
    );

    return res.json({ success: true, data: updatedLead });
  } catch (err) {
    console.error("Franchise reject error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to reject franchise lead",
      details: err.message,
    });
  }
});


/* ---------- Stripe Checkout + Verify ---------- */

// POST /api/userapi/create-checkout-session
route.post("/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res
        .status(500)
        .json({
          error: "Stripe not configured. Set STRIPE_SECRET_KEY.",
        });
    }

    const body = req.body || {};
    const booking_id = body.booking_id || body.bookingId;

    const userEmail = normEmail(body.userEmail || body.email);
    const user_id = body.user_id || body.userId;
    const slot_id = body.slot_id || body.slotId;
    const area_id = body.area_id || body.areaId;
    const date = body.date || body.selectedDate;
    const price = Number(body.price || body.total_price || 0);
    const advance_payment = Number(
      body.advance_payment || body.advancePayment || 0
    );
    const due_payment = Number.isFinite(Number(body.due_payment))
      ? Number(body.due_payment)
      : price - advance_payment;

    const received = {
      booking_id: !!booking_id,
      userEmail: !!userEmail,
      user_id: !!user_id,
      slot_id: !!slot_id,
      area_id: !!area_id,
      date: !!date,
      price: Number.isFinite(price) && price > 0,
      advance_payment:
        Number.isFinite(advance_payment) && advance_payment > 0,
    };

    const missing = Object.entries(received)
      .filter(([, ok]) => !ok)
      .map(([k]) => k);

    if (missing.length) {
      return res.status(400).json({
        error: `Missing or invalid fields: ${missing.join(", ")}`,
        received,
      });
    }

    const amountInPaise = Math.round(advance_payment * 100);
    const CLIENT_URL =
      process.env.CLIENT_URL ||
      req.get("origin") ||
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userEmail,
      client_reference_id: String(booking_id),
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "Box Cricket – Advance Payment",
              description: `Area: ${area_id} | Slot: ${slot_id} | Date: ${new Date(
                date
              ).toLocaleDateString()}`,

            },
            unit_amount: amountInPaise,
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}${STRIPE_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}${STRIPE_CANCEL_PATH}`,
      metadata: {
        booking_id: String(booking_id),
        user_id: String(user_id),
        slot_id: String(slot_id),
        area_id: String(area_id),
        date: String(date),
        total_price: String(price),
        advance_payment: String(advance_payment),
        due_payment: String(due_payment),
      },
    });

    return res.status(200).json({ id: session.id });
  } catch (err) {
    console.error("Stripe session error:", err);
    return res.status(500).json({
      error: "Failed to create checkout session",
      details: err.message,
    });
  }
});

// GET /api/userapi/checkout/session/:sessionId
route.get("/checkout/session/:sessionId", async (req, res) => {
  try {
    if (!stripe)
      return res.status(500).json({ error: "Stripe not configured" });

    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
    if (!session)
      return res.status(404).json({ error: "Session not found" });

    const paid =
      session.payment_status === "paid" || session.status === "complete";
    const bookingId =
      session?.metadata?.booking_id || session?.client_reference_id;
    if (!bookingId) {
      return res
        .status(400)
        .json({ error: "Missing booking_id in session metadata" });
    }

    const update = {
      stripe_session_id: session.id,
      stripe_payment_intent:
        session.payment_intent?.id ||
        (session.payment_intent && String(session.payment_intent)),
      payment_status: paid ? "paid" : "pending",
      booking_status: paid ? "upcoming" : "pending",
      advance_payment: Number(session.amount_total || 0) / 100,
      currency: session.currency || "inr",
      updated_at: new Date(),
    };

    const updated = await Booking.findByIdAndUpdate(bookingId, update, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Booking not found" });

    // 🔔 Send booking confirmation mail on successful payment
    if (paid && updated) {
      await sendBookingConfirmationEmail(updated);
    }

    return res.json({
      success: true,
      data: updated,
      session_status: session.status,
      payment_status: session.payment_status,
      paid,
    });
  } catch (e) {
    console.error("Verify session error:", e);
    return res.status(500).json({
      error: "Failed to verify session",
      details: e.message,
    });
  }
});

/* ---------- User Booking: my-bookings, ticket, cancel, feedback ---------- */

// GET /api/userapi/my-bookings
route.get("/my-bookings", auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "User missing in token" });
    }

    // returning all for this user (no pagination for UI simplicity)
    const items = await Booking.find({ user_id: userId })
      .populate({ path: "area_id", model: "Area", select: "area_name" })
      .populate({
        path: "slot_id",
        model: "AreaWiseSlot",
        select: "slot_start_time slot_end_time",
      })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.json({ success: true, data: items });
  } catch (err) {
    console.error("my-bookings error:", err);
    if (
      String(err?.message || "").includes(`Schema hasn't been registered`)
    ) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch bookings",
        details:
          "A referenced model is not registered. Make sure AreaWiseSlot and Area are registered before this route.",
      });
    }
    return res.status(500).json({
      success: false,
      error: "Failed to fetch bookings",
      details: err.message,
    });
  }
});

// GET /api/userapi/download-ticket/:bookingId
route.get("/download-ticket/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ error: "Booking not found" });

    const ticketPath = await generateTicketPDF(booking);
    return res.download(ticketPath, (err) => {
      if (err) console.error("Ticket download error:", err);
    });
  } catch (err) {
    console.error("download-ticket error:", err);
    return res.status(500).json({
      error: "Failed to download ticket",
      details: err.message,
    });
  }
});

// DELETE /api/userapi/cancel-booking/:bookingId (USER)
route.delete("/cancel-booking/:bookingId", auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found" });
    }

    const userId = req.user.id || req.user._id;
    if (String(booking.user_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        error: "Not allowed to cancel this booking",
      });
    }

    if (["completed", "cancelled"].includes(booking.booking_status)) {
      return res.status(400).json({
        success: false,
        error: "This booking cannot be cancelled",
      });
    }

    const hadPaid = booking.payment_status === "paid";

    booking.booking_status = "cancelled";
    if (hadPaid) {
      booking.payment_status = "refund_pending";
    } else if (booking.payment_status === "pending") {
      booking.payment_status = "cancelled";
    }
    booking.updated_at = new Date();
    await booking.save();

    // 🔔 Send cancel / refund mail
    await sendBookingCancelOrRefundEmail(booking, {
      triggeredByAdmin: false,
    });

    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error("cancel-booking error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to cancel booking",
      details: err.message,
    });
  }
});

// DELETE /api/userapi/admin-cancel-booking/:bookingId (ADMIN/SUPERADMIN)
route.delete("/admin-cancel-booking/:bookingId", auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found" });
    }

    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, error: "Unauthorized" });
    }

    if (["completed", "cancelled"].includes(booking.booking_status)) {
      return res.status(400).json({
        success: false,
        error: "Booking cannot be cancelled",
      });
    }

    const hadPaid = booking.payment_status === "paid";

    booking.booking_status = "cancelled";
    if (hadPaid) {
      booking.payment_status = "refund_pending";
    } else if (booking.payment_status === "pending") {
      booking.payment_status = "cancelled";
    }
    booking.updated_at = new Date();
    await booking.save();

    // 🔔 Send cancel / refund mail (admin-triggered)
    await sendBookingCancelOrRefundEmail(booking, {
      triggeredByAdmin: true,
    });

    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error("Admin cancel error:", err);
    res.status(500).json({
      success: false,
      error: "Server error",
      details: err.message,
    });
  }
});

// POST /api/userapi/bookings/:bookingId/feedback
route.post("/bookings/:bookingId/feedback", auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, comment } = req.body || {};
    if (!rating)
      return res.status(400).json({ error: "Rating is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking)
      return res.status(404).json({ error: "Booking not found" });

    const userId = req.user.id || req.user._id;
    if (String(booking.user_id) !== String(userId)) {
      return res
        .status(403)
        .json({ error: "Not allowed to review this booking" });
    }

    await Feedback.create({
      user_id: booking.user_id,
      booking_id: booking._id,
      area_id: booking.area_id,
      rating,
      comment: comment || "",
      createdAt: new Date(),
    });

    booking.feedback_submitted = true;
    await booking.save();

    return res.json({ success: true, message: "Feedback submitted" });
  } catch (err) {
    console.error("feedback error:", err);
    return res.status(500).json({
      error: "Failed to submit feedback",
      details: err.message,
    });
  }
});

module.exports = route;
