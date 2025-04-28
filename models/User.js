const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: false },
        phoneNumber: { type: String, required: true, unique: true },
        countryCode: { type: String, required: true },
        about: { type: String, required: false },
        profileImage: { type: String, required: false },
        userIn: { type: Boolean, required: false, default: false },
        otp: { type: String, required: false },
        deviceId: { type: String, required: false },
        deviceToken: { type: String, required: false },
        otpExpiration: { type: Date, required: false },
        userStatus: { type: String, enum: ['new', 'unverified', 'verified'], default: 'new' },
        jwtToken: { type: String, required: false },
    },
    { timestamps: true }
);

userSchema.pre('save', function (next) {
    if (this.email) {
        // Handle case where email shouldn't be set
        delete this.email;
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
