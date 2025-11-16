

// models/AreaWiseSlot.js
const mongoose = require('mongoose');

const areaWiseSlotSchema = new mongoose.Schema(
  {
    area: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true }, // if you use 'area'
    area_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Area' }, // keep if your code also stores 'area_id'
    slot_start_time: { type: String, required: true },
    slot_end_time: { type: String, required: true },
    price: Number,
    city: { type: String },
  },
  { timestamps: true }
);

// IMPORTANT: name must be EXACTLY 'AreaWiseSlot'
module.exports = mongoose.model('AreaWiseSlot', areaWiseSlotSchema);
