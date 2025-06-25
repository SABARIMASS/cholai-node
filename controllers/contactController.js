const User = require('../models/User');

// Function to check contacts and return verified users
const checkContacts = async (req, res) => {
    const { contacts } = req.body;

    // Validate input
    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({
            status: -1,
            message: 'Invalid contacts format. Expected an array.',
        });
    }

    try {
        // Query the database to find matching verified users
        const users = await User.find({
            userStatus: 'verified', // Only check verified users
            $or: contacts.map(({ countryCode, phoneNumber }) => ({
                countryCode,
                phoneNumber,
            })),
        });

        // Transform the data for the response
        const results = users.map(user => ({
            name: user.name,
            chatId: user.id, // Assuming user._id is used as chatId
             profileImage: user.profileImage || '', // Default to empty string if no profile image
            countryCode: user.countryCode,
            phoneNumber: user.phoneNumber,
        }));

        res.status(200).json({
            status: 1,
            message: 'Contacts retrieved successfully',
            data: results,
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            status: -1,
            message: 'Internal server error',
        });
    }
};
const userStatus = async (req, res) => {
      const { userId } = req.body;

    try {
        const user = await User.findById(userId, 'isOnline lastSeenDateTime userStatus');
console.log('Fetching user status for userId:', userId);
        if (!user) {
            return res.status(404).json({
                status: 0,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            status: 1,
            message: 'User status fetched successfully',
            data: {
                userId: userId,
                isOnline: user.isOnline,
                lastSeen: user.lastSeenDateTime,
                userStatus: user.userStatus
            },
        });
    } catch (error) {
        console.error('Error fetching user status:', error);
        return res.status(500).json({
            status: -1,
            message: 'Internal server error',
        });
    }
};

module.exports = { checkContacts ,userStatus};
