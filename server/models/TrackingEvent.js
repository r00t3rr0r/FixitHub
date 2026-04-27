const mongoose = require('mongoose');

const TrackingEventSchema = new mongoose.Schema({
  event_name: { type: String, required: true },
  occurred_at: { type: Date, default: Date.now },
  page_url: String,
  page_path: String,
  page_title: String,
  referrer: String,
  source: String,
  medium: String,
  campaign: String,
  session_id: String,
  visitor_id: String,
  browser: String,
  browser_version: String,
  os: String,
  device_type: String,
  language: String,
  screen_width: Number,
  screen_height: Number,
  viewport_width: Number,
  viewport_height: Number,
  timezone: String,
  ip_hash: String,
  country: String,
  city: String,
  custom_data: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

// Performance-Indexe
TrackingEventSchema.index({ occurred_at: -1 });
TrackingEventSchema.index({ session_id: 1, occurred_at: 1 });
TrackingEventSchema.index({ visitor_id: 1 });
TrackingEventSchema.index({ event_name: 1, occurred_at: -1 });

module.exports = mongoose.model('TrackingEvent', TrackingEventSchema);
