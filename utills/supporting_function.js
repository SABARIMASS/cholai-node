const generateOtp = () => {
    return Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit OTP
};
const sendOtp = (phone, otp) => {
    // Use an SMS service (e.g., Twilio, Nexmo) to send the OTP
    console.log(`Sending OTP ${otp} to ${phone}`);
};
const generateToken = (user) => {
    const payload = { userId: user._id, phoneNumber: user.phoneNumber };
    const secretKey = process.env.JWT_SECRET; // Store this in your environment variables
    return jwt.sign(payload, secretKey, { expiresIn: '1d' });
};
const generateChatId = (user1, user2) => {
    return [user1, user2].sort().join('_'); // Consistently sort and join user IDs
};
module.exports = { generateChatId };