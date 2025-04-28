const express = require('express');
const {
    handleOtpRequest,
    verifyOtp,
    setProfile, getUserList, deleteUser, profileUpdate, logout
} = require('../controllers/authController'); // Import all required controller functions
const router = express.Router();

// Route to request OTP (for registration or login)
router.post('/otp-request', handleOtpRequest); // Renamed for clarity: 'request-otp'

// Route to verify OTP (for registration or login)
router.post('/verify-otp', verifyOtp);

// Route to set profile for new users
router.post('/set-profile', setProfile);

// Route to get user list (requires OTP verification)
router.get('/user-list', getUserList);

// Route to delete user (requires OTP verification)
router.delete('/delete-user/:id', deleteUser);

// Route to update user profile (requires OTP verification)
router.put('/profile-update/:id', profileUpdate);

// Logout route
router.post('/logout', logout);
module.exports = router;
