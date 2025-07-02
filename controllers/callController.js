const CallHistory = require('../models/CallLogs');

const callLogs = async (req, res) => {
  try {
    const { userId } = req.body; // Assuming userId is sent in the request body

    if (!userId) {
      return res.status(400).json({
        status: -1,
        message: "User ID is required"
      });
    }

    const calls = await CallHistory.find({
      $or: [
        { callerId: userId },
        { receiverId: userId }
      ]
    })
      .populate("callerId", "name profileImage countryCode phoneNumber")
      .populate("receiverId", "name profileImage countryCode phoneNumber")
      
      .sort({ startTime: -1 })
      .lean();

    const callsWithDirection = calls.map(call => {
      const isOutgoing = String(call.callerId._id) === userId;
      return {
        callSessionId: call.callSessionId,
        callType: call.callType,
        status: call.status,
        startTime: call.startTime,
        endTime: call.endTime,
        durationSeconds: call.durationSeconds,
        direction: isOutgoing ? "outgoing" : "incoming",
        otherUser: isOutgoing
          ? {
              id: call.receiverId._id,
              name: call.receiverId.name,
              profileImage: call.receiverId.profileImage,
              countryCode:call.receiverId.countryCode,
              phoneNumber:call.receiverId.phoneNumber
            }
          : {
              id: call.callerId._id,
              name: call.callerId.name,
              profileImage: call.callerId.profileImage,
               countryCode:call.callerId.countryCode,
              phoneNumber:call.callerId.phoneNumber
            }
      };
    });

    res.json({
      status: 1,
      data: callsWithDirection
    });

  } catch (err) {
    res.status(500).json({
      status: -1,
      message: err.message
    });
  }
};

module.exports = { callLogs };
