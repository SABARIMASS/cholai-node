const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceName: { type: String },
  deviceType: { type: String, enum: ['android', 'ios', 'web'], required: true },
  versionCode: { type: String },
  versionName: { type: String },
  appVersion: { type: String },
  pushToken: { type: String },
  lastLoginAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: false },
    phoneNumber: { type: String, required: true, unique: true },
    countryCode: { type: String, required: true },
    about: { type: String, required: false },
    profileImage: { type: String, required: false },
    userIn: { type: Boolean, required: false, default: false },
    otp: { type: String, required: false },
    otpExpiration: { type: Date, required: false },
    userStatus: { type: String, enum: ['new', 'unverified', 'verified'], default: 'new' },
    jwtToken: { type: String, required: false },
    isOnline: { type: Boolean, default: null },
    lastSeenDateTime: { type: Date, default: null },
    devices: [DeviceSchema] // 🟢 New devices array
  },
  { timestamps: true }
);

// Optionally keep your pre-save hook
userSchema.pre('save', function (next) {
  if (this.email) {
    delete this.email;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
