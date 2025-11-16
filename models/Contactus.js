// models/Contactus.js
const mongoose = require("mongoose");

const FranchiseLeadSchema = new mongoose.Schema(
  {
    // Contact
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },

    // Location / Facility
    haveVenue: { type: Boolean, default: false },
    venueType: {
      type: String,
      enum: ["Indoor", "Outdoor", "Both", "NA"],
      default: "NA",
    },
    areaSqFt: { type: Number, default: 0 },
    address: { type: String, default: "" },

    // Investment & Experience
    investmentBudget: { type: Number, required: true },
    timeline: {
      type: String,
      enum: [
        "0-3 months",
        "3-6 months",
        "6-12 months",
        "12+ months",
      ],
      required: true,
    },
    experienceSports: { type: Boolean, default: false },
    yearsExperience: { type: Number, default: 0 },
    currentBusiness: { type: String, default: "" },

    // Notes / Source
    message: { type: String, default: "" },
    howHeard: { type: String, default: "" },
    agree: { type: Boolean, default: false },

    // Workflow
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },

    createdAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegisterUser",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contactus", FranchiseLeadSchema);
