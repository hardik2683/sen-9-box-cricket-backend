// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RegisterUser', required: true },
  slot_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AreaWiseSlot', required: true },
  area_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true },

  // required contact fields
  email:  { type: String, required: true },
  mobile: { type: String, required: true },

  // booking context
  date:  { type: Date, required: true },
  price: { type: Number, required: true },
  advance_payment: { type: Number, required: true },
  due_payment: { type: Number, required: true },

  // optional (you were sending these from UI)
  start_time: { type: String, default: null },
  end_time:   { type: String, default: null },
  area_name:  { type: String, default: null },

  // payment tracking
  transition_id: { type: String, default: null },
  stripe_session_id: { type: String, default: null },
  stripe_payment_intent: { type: String, default: null },
  currency: { type: String, default: 'inr' },

  payment_status: {
    type: String,
    enum: [
      'pending',
      'paid',
      'failed',
      'refunded',
      'cancelled',
      'refund_pending' // 👈 added here
    ],
    default: 'pending'
  },

  feedback_submitted: { type: Boolean, default: false },

  booking_status: {
    type: String,
    enum: ['pending', 'upcoming', 'confirmed', 'completed', 'cancelled'],
    default: 'upcoming'
  },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

/* Indexes */
bookingSchema.index({ user_id: 1 });
bookingSchema.index({ slot_id: 1 });
bookingSchema.index({ area_id: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ payment_status: 1 });
bookingSchema.index({ booking_status: 1 });

/* Timestamps */
bookingSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

/* Static: bookings by user */
bookingSchema.statics.findByUserId = async function(userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ user_id: userId })
    .sort({ date: -1, created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('slot_id', 'slot_start_time slot_end_time')
    .populate('area_id', 'area_name');
};

/* Static: bookings by area with filters */
bookingSchema.statics.findByArea = async function(areaId, filters = {}, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const query = { area_id: areaId };

  if (filters.startDate && filters.endDate) {
    query.date = { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) };
  }
  if (filters.paymentStatus) query.payment_status = filters.paymentStatus;
  if (filters.bookingStatus) query.booking_status = filters.bookingStatus;

  return this.find(query)
    .sort({ date: -1, created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user_id', 'fname lname email mobile')
    .populate('slot_id', 'slot_start_time slot_end_time');
};

/* Static: all bookings (superadmin) */
bookingSchema.statics.findAllBookings = async function(filters = {}, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const query = {};

  if (filters.areaId) query.area_id = filters.areaId;
  if (filters.startDate && filters.endDate) {
    query.date = { $gte: new Date(filters.startDate), $lte: new Date(filters.endDate) };
  }
  if (filters.paymentStatus) query.payment_status = filters.paymentStatus;
  if (filters.bookingStatus) query.booking_status = filters.bookingStatus;
  if (filters.userId) query.user_id = filters.userId;

  return this.find(query)
    .sort({ date: -1, created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user_id', 'fname lname email mobile')
    .populate('slot_id', 'slot_start_time slot_end_time')
    .populate('area_id', 'area_name');
};

module.exports = mongoose.model('Booking', bookingSchema);
