// models/RegisterUser.js
const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const isBcryptHash = (v) =>
  typeof v === "string" && /^\$2[aby]\$\d{2}\$/.test(v || "");

const userSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: false },

    fname: { type: String, required: true },
    lname: { type: String, required: true },

    // 🔹 Always store email in lowercase & trimmed so lookups are reliable
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    mobile: { type: Number, required: true },

    gender: {
      type: String,
      enum: ["Male", "Female"],
      default: "Male",
    },

    city: { type: String, required: true },
    state: { type: String, required: false },
    address: { type: String, required: false },

    // 🔹 Roles
    role: {
      type: String,
      enum: ["superadmin", "admin", "user"],
      default: "user",
    },

    password: { type: String, required: false },
    cpassword: { type: String, required: false },

    profile_image: { type: String, required: false },
  },
  { timestamps: true }
);

// Hash password fields only when they are plain text
userSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password") && this.password && !isBcryptHash(this.password)) {
      const salt = await bcryptjs.genSalt(10);
      this.password = await bcryptjs.hash(this.password, salt);
    }

    if (this.isModified("cpassword") && this.cpassword && !isBcryptHash(this.cpassword)) {
      const salt = await bcryptjs.genSalt(10);
      this.cpassword = await bcryptjs.hash(this.cpassword, salt);
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("RegisterUser", userSchema);
