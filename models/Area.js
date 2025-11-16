const mongoose = require("mongoose");

const AreaSchema = new mongoose.Schema({
  area_name: { type: String, required: true },
});

module.exports = mongoose.model("Area", AreaSchema);
