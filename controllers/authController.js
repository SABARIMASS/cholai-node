require('dotenv').config(); // Load environment variables from .env file
const User = require('../models/User');
const { authenticator } = require('otplib');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { moveImageToMain } = require('../utills/temp_main'); // Import the function to move images from temp to main storage
// Configuration
authenticator.options = { step: 300 }; // Set OTP validity to 5 minutes
const OTP_SECRET = process.env.OTP_SECRET || 'default_secret_key'; // Use environment variable for security
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Use environment variable for JWT secret

// Generate OTP and store it in the DB
const generateAndStoreOtp = async (phoneNumber, countryCode) => {
    const otp = authenticator.generate(OTP_SECRET); // Generate OTP
    const otpExpiration = moment().add(5, 'minutes').toDate(); // OTP expires in 5 minutes

    // Save OTP and expiration time in the database
    await User.findOneAndUpdate(
        { phoneNumber, countryCode },
        { otp, otpExpiration },
        { new: true, upsert: true }
    );

    return otp; // Return the OTP
};

// Generate JWT Token for the user
const generateToken = (user) => {
    if (!user || !user._id) {
        return null; // Return null if user is invalid or user ID is missing
    }

    return jwt.sign(
        { userId: user._id, name: user.name },
        JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
    );
};

const handleOtpRequest = async (req, res) => {
    const { phoneNumber, countryCode } = req.body;

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ phoneNumber, countryCode });

        // Generate and store OTP
        const otp = await generateAndStoreOtp(phoneNumber, countryCode);
        if (!otp) {
            return res.status(400).json({ status: -1, message: "OTP generation failed" });
        }

        if (existingUser) {
            // User exists: Generate JWT token for login
            const token = generateToken(existingUser);
            if (!token) {
                return res.status(500).json({ status: -1, message: "Token generation failed" });
            }

            // If the user is verified, send a successful login response
            if (existingUser.userStatus === 'verified') {
                return res.status(200).json({
                    status: 1,
                    message: 'OTP sent for login',
                    userStatus: 'existing',
                    responseData: {
                        userId: existingUser._id,
                        token,
                    },
                    otp, // For testing purposes only, remove this in production
                });
            }

            // If the user is unverified, send a response indicating the unverified status
            return res.status(200).json({
                status: 2,
                message: 'OTP sent for registration',
                userStatus: 'unverified',
                responseData: {
                    userId: existingUser._id,

                },
                otp, // For testing purposes only, remove this in production
            });
        } else {
            // New user: send OTP for registration
            return res.status(200).json({
                status: 2,
                message: 'OTP sent for registration',
                userStatus: 'new',
                otp, // For testing purposes only, remove this in production
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: -1, message: error.message });
    }
};

// Verify OTP for Registration or Login
const verifyOtp = async (req, res) => {
    const { phoneNumber, countryCode, otp, userStatus, deviceId,
        deviceName,
        deviceType,
        versionCode,
        versionName,
        appVersion,
        pushToken } = req.body;

    try {
        const user = await User.findOne({ phoneNumber, countryCode });

        if (!user) {
            return res.status(404).json({ status: -1, message: 'User not found' });
        }

        if (moment().isAfter(moment(user.otpExpiration))) {
            return res.status(400).json({ status: -1, message: 'OTP has expired' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ status: -1, message: 'Invalid OTP' });
        }

        if (deviceId && deviceType) {
            const deviceInfo = {
                deviceId,
                deviceName,
                deviceType,
                versionCode,
                versionName,
                appVersion,
                pushToken,
                lastLoginAt: new Date()
            };
            console.log("Device Info", deviceInfo);

            // Make sure user.devices is always an array
            if (!Array.isArray(user.devices)) {
                user.devices = [];
            }

            // Remove any existing device with same deviceId
            user.devices = user.devices.filter(d => d.deviceId !== deviceId);

            // Add current device info
            user.devices.push(deviceInfo);

            // Keep only the last 2 devices
            if (user.devices.length > 2) {
                user.devices = user.devices.slice(-2);
            }

            //console.log("Devices after push:", user.devices);

            // Make sure you save the user if this is a Mongoose document
            await user.save();

        }
        if (userStatus === 'new' || userStatus === 'unverified') {


            const token = generateToken(user);
            if (!token) {
                return res.status(500).json({ status: -1, message: "Token generation failed" });
            }

            return res.status(201).json({
                status: 2,
                message: 'User registered successfully',
                responseData: {
                    userId: user._id,
                    countryCode: user.countryCode,
                    phoneNumber: user.phoneNumber,
                    token,
                },
            });
        } else if (userStatus === 'existing') {


            const token = generateToken(user);
            if (!token) {
                return res.status(500).json({ status: -1, message: "Token generation failed" });
            }

            return res.status(200).json({
                status: 1,
                message: 'Login successful',
                responseData: {
                    userId: user._id,
                    name: user.name,
                    countryCode: user.countryCode,
                    phoneNumber: user.phoneNumber,
                    about: user.about,
                    userStatus: user.userStatus,
                    profileImage: user.profileImage,
                    token: token,
                },
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: -1, message: error.message });
    }
};
const resendOtp = async (req, res) => {
    const { userId } = req.body;

    try {
        // Find the user by ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: -1,
                message: 'User not found',
            });
        }

        const { phoneNumber, countryCode } = user;

        // Generate and store new OTP
        const newOtp = await generateAndStoreOtp(phoneNumber, countryCode);
        if (!newOtp) {
            return res.status(500).json({
                status: -1,
                message: 'Failed to generate OTP',
            });
        }

        return res.status(200).json({
            status: 1,
            message: 'OTP resent successfully',
            otp: newOtp, // Remove this in production
        });
    } catch (error) {
        console.error('Resend OTP Error:', error);
        return res.status(500).json({
            status: -1,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};



const setProfile = async (req, res) => {
    const { phoneNumber, countryCode, userId, name, about, tempImage, deviceId, deviceToken,
        deviceName,
        deviceType,
        versionCode,
        versionName,
        appVersion,
        pushToken } = req.body;

    try {
        const user = await User.findOne({ phoneNumber, countryCode, _id: userId });

        if (!user) {
            return res.status(404).json({ status: -1, message: 'User not found' });
        }

        if (user.userStatus === 'verified' && user.userIn === true) {
            return res.status(400).json({
                status: 0,
                message: 'User already verified and logged in on another device, cannot login now',
            });
        }

        user.name = name;
        user.about = about || user.about;
        user.userStatus = 'verified';
        user.deviceId = deviceId;
        user.deviceToken = deviceToken;
        user.userIn = true;

        // 🔁 If Firebase tempImage path is given
        if (tempImage) {
            try {
                const firebaseFinalUrl = await moveImageToMain(tempImage, 'profileImages');
                user.profileImage = firebaseFinalUrl;
            } catch (err) {
                console.error('Error moving image on Firebase:', err);
                return res.status(400).json({ status: -1, message: 'Error processing profile image' });
            }
        }
        if (deviceId && deviceType) {
            const deviceInfo = {
                deviceId,
                deviceName,
                deviceType,
                versionCode,
                versionName,
                appVersion,
                pushToken,
                lastLoginAt: new Date()
            };
            // console.log("Device Info", deviceInfo);

            // Make sure user.devices is always an array
            if (!Array.isArray(user.devices)) {
                user.devices = [];
            }

            // Remove any existing device with same deviceId
            user.devices = user.devices.filter(d => d.deviceId !== deviceId);

            // Add current device info
            user.devices.push(deviceInfo);

            // Keep only the last 2 devices
            if (user.devices.length > 2) {
                user.devices = user.devices.slice(-2);
            }

            console.log("Devices after push:", user.devices);
            // Make sure you save the user if this is a Mongoose document
            await user.save();
        }




        const token = generateToken(user);

        return res.status(200).json({
            status: 1,
            message: 'Profile updated successfully',
            responseData: {
                userId: user._id,
                name: user.name,
                countryCode: user.countryCode,
                phoneNumber: user.phoneNumber,
                about: user.about,
                userStatus: user.userStatus,
                profileImage: user.profileImage,
                token: token,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: -1, message: error.message });
    }
};


const getUserList = async (req, res) => {
    try {
        const users = await User.find({}, '-otp -otpExpiration'); // Exclude OTP-related fields
        return res.status(200).json({
            status: 1,
            message: 'User list fetched successfully',
            data: users
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: -1,
            message: 'Failed to fetch user list',
            error: error.message
        });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({
                status: -1,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            status: 1,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: -1,
            message: 'Failed to delete user',
            error: error.message
        });
    }
};
const profileUpdate = async (req, res) => {
    const { id } = req.params;
    const { name, phoneNumber, countryCode } = req.body;

    try {
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                status: -1,
                message: 'User not found'
            });
        }

        user.name = name || user.name;
        user.phoneNumber = phoneNumber || user.phoneNumber;
        user.countryCode = countryCode || user.countryCode;
        await user.save();

        return res.status(200).json({
            status: 1,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: -1,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

const logout = async (req, res) => {
    const { userId } = req.body;

    try {
        // Find the user by ID
        const user = await User.findById({ _id: userId });

        if (!user) {
            return res.status(404).json({ status: -1, message: 'User not found' });
        }

        // Update the user's fields
        user.deviceId = null;
        user.deviceToken = null;
        user.userIn = false;

        // Save changes
        await user.save();

        return res.status(200).json({
            status: 1,
            message: 'User logged out successfully',
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: -1, message: error.message });
    }
};

const userInfo = async (req, res) => {
    const { userId } = req.body;

    try {
        // Find the user by ID
        const user = await User.findById({ _id: userId });

        if (!user) {
            return res.status(404).json({ status: -1, message: 'User not found' });
        }



        return res.status(200).json({
            status: 1,
            message: 'User logged out successfully',
            responseData: {
                userId: user._id,
                name: user.name,
                countryCode: user.countryCode,
                phoneNumber: user.phoneNumber,
                about: user.about,
                userStatus: user.userStatus,
                profileImage: user.profileImage,
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: -1, message: error.message });
    }
};
module.exports = { handleOtpRequest, verifyOtp, setProfile, resendOtp, getUserList, deleteUser, profileUpdate, logout, userInfo };
