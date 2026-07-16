const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  registrationData: {
    name: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    rollNumber: { type: String, required: true },
    batch: { type: String, required: true },
    adminId: { type: String, required: true }
  },
  expiresAt: {
    type: Date,
    required: true
  },
  lastSentAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { timestamps: true });

// Auto-delete the document after 5 minutes (300 seconds) from creation
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('Otp', OtpSchema);
