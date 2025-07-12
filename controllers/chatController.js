const ChatList = require('../models/ChatList');
const ChatDetails = require('../models/ChatDetail');
const moment = require('moment'); // For date formatting (optional but recommended)
const { v4: uuidv4 } = require('uuid'); // Use this to generate a unique messageId
const User = require('../models/User');
const { sendPushNotification } = require("../utills/pushNotification");

const getUserChatList = async (req, res) => {
    try {
        const { userId } = req.body; // logged-in user ID
        const chatList = await getLastChat(userId); // Fetch the chat list for the user
        if (!chatList || chatList.length === 0) {
            return res.status(404).json({
                status: 0,
                message: "No chats found for this user",
                data: []
            });
        }

        return res.status(200).json({
            status: 1,
            message: "Chat list fetched successfully",
            data: chatList
        });

    } catch (error) {
        console.error("Chat list error:", error);
        return res.status(500).json({
            status: 0,
            message: "Server error",
            error: error.message
        });
    }
};

const getChatDetails = async (req, res) => {
    const { chatId, timeZone } = req.body;

    try {
        const chatDetails = await ChatDetails.find({ chatId }).sort({ timestamp: 1 });

        const today = moment().utcOffset(timeZone || '+00:00').startOf('day');
        const yesterday = moment().utcOffset(timeZone || '+00:00').subtract(1, 'day').startOf('day');

        const groupedMessages = chatDetails.reduce((acc, message) => {
            const messageMoment = moment(message.timestamp).utcOffset(timeZone || '+00:00');
            const messageDate = messageMoment.clone().startOf('day');

            let groupLabel;
            if (messageDate.isSame(today, 'day')) {
                groupLabel = 'Today';
            } else if (messageDate.isSame(yesterday, 'day')) {
                groupLabel = 'Yesterday';
            } else {
                groupLabel = messageMoment.format('D MMMM YYYY');
            }

            if (!acc[groupLabel]) {
                acc[groupLabel] = [];
            }

            acc[groupLabel].push(message);
            return acc;
        }, {});

        const formattedMessages = Object.keys(groupedMessages).map(date => ({
            dateLabel: date,
            messages: groupedMessages[date]
        }));

        // Sort priority
        formattedMessages.sort((a, b) => {
            const priority = { 'Today': 2, 'Yesterday': 1 };
            return (priority[b.dateLabel] || 0) - (priority[a.dateLabel] || 0)
                || new Date(b.dateLabel) - new Date(a.dateLabel);
        });

        res.status(200).json({
            status: 1,
            message: 'Chat details retrieved successfully',
            data: formattedMessages,
        });
    } catch (error) {
        console.error('Error fetching chat details:', error);
        res.status(500).json({
            status: -1,
            message: 'Internal server error',
        });
    }
};

const sendMessage = async (req, res) => {
    const { senderId, receiverId, message } = req.body;

    try {
        if (!senderId || !receiverId || !message) {
            return res.status(400).json({
                status: -1,
                message: 'Sender, receiver, and message are required',
            });
        }

        const io = req.io;
        const chatId = [senderId, receiverId].sort().join('_');
        const messageId = uuidv4();

        // const unreadStatuses = ['sent', 'delivered'];


        const newMessage = new ChatDetails({
            messageId,
            chatId,
            senderId,
            receiverId,
            message,
            status: 'sent',

        });

        await newMessage.save();

        // Count unread messages sent to sender
        const senderUnreadCount = await ChatDetails.countDocuments({
            chatId,
            receiverId: senderId,
            status: { $in: ['sent', 'delivered'] }
        });

        // Count unread messages sent to receiver
        const receiverUnreadCount = await ChatDetails.countDocuments({
            chatId,
            receiverId: receiverId,
            status: { $in: ['sent', 'delivered'] }
        });
        console.log("Sender unread count: %s, Receiver unread count: %s", senderUnreadCount, receiverUnreadCount);
        await ChatList.findOneAndUpdate(
            { userId: senderId, chatId },
            {
                userId: senderId,
                chatId,
                participants: [senderId, receiverId],
                lastMessage: message,
                senderId: senderId,
                receiverId: receiverId,
                lastMessageTime: Date.now(),
                lastMessageStatus: 'sent',
                unreadCount: senderUnreadCount, // Increment unread count for sender
            },
            { upsert: true }
        );

        await ChatList.findOneAndUpdate(
            { userId: receiverId, chatId },
            {
                userId: receiverId,
                chatId,
                participants: [receiverId, senderId],
                lastMessage: message,
                senderId: senderId,
                lastMessageStatus: 'none',
                receiverId: receiverId,
                lastMessageTime: Date.now(),
                unreadCount: receiverUnreadCount, // Increment unread count for receiver
            },
            { upsert: true }
        );

        const senderLastchat = await getLastChat(senderId); // Fetch updated chat list for sender
        const receiverLastchat = await getLastChat(receiverId); // Fetch updated chat list for receiver

        const chatDetailsData = {
            chatId,
            messageId,
            senderId,
            receiverId,
            message,
            timestamp: Date.now(),
            status: 'sent',
        };

        // Emit the message to the specific chat room
        io.in(senderId).emit('updateChatList', senderLastchat);  // Emit to chat room
        io.in(receiverId).emit('updateChatList', receiverLastchat);  // Emit to chat room
        io.in(chatId).emit('updateChatDetails', chatDetailsData);  // Emit to chat room
        const roomSockets = io.sockets.adapter.rooms.get(chatId);
        if (!roomSockets || roomSockets.size === 1) {
            const senderInfo = await User.findById(receiverId);
            const receiverInfo = await User.findById(receiverId);
            if (receiverInfo.devices.length !== 0) {
                sendPushNotification({
                    tokens: receiverInfo.devices.map(d => d.pushToken).filter(Boolean),
                    title: senderInfo.name,
                    body: message,
                    data: {
                        screen: "Chat",
                        type: 'text',
                        senderId: senderId,
                    },
                });
            }
        }
        res.status(200).json({
            status: 1,
            message: 'Message sent successfully',
            data: {
                messageId,
                chatId,
                senderId,
                receiverId,
                message,
                timestamp: Date.now(),
                status: 'sent',
            },
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            status: -1,
            message: 'Internal server error',
        });
    }
};

const updateMessageStatus = async (req, res) => {
    const { messageId, status } = req.body;

    try {
        // Ensure messageId and status are provided
        if (!messageId || !status) {
            return res.status(400).json({
                status: -1,
                message: 'messageId and status are required',
            });
        }

        // Update the status of the particular message based on messageId
        const updatedMessage = await ChatDetails.findOneAndUpdate(
            { messageId },  // Find message by messageId
            { status },     // Update the status
            { new: true }   // To return the updated message
        );

        if (!updatedMessage) {
            return res.status(404).json({
                status: -1,
                message: 'Message not found',
            });
        }

        res.status(200).json({
            status: 1, // Success
            message: 'Message status updated successfully',
            data: updatedMessage,
        });
    } catch (error) {
        console.error('Error updating message status:', error);
        res.status(500).json({
            status: -1, // Failure
            message: 'Internal server error',
        });
    }
};

const markMessagesAsRead = async (req, res) => {
    const { userId, chatId } = req.body;

    try {
        const io = req.io;

        // Get unique receiverIds of unread messages sent by this user
        const receiverIds = await ChatDetails.distinct('receiverId', {
            chatId,
            senderId: userId,

        });
        // Emit to all receiverIds found
        const receiverId = receiverIds[0]; // or whichever index you want
        // Mark all unread messages for the user as 'read'
        await ChatDetails.updateMany(
            { chatId, senderId: userId, senderUnreadCount: 0, status: { $ne: 'read' } },
            { $set: { status: 'read' } }
        );

        // Update the ChatList to set unreadCount to 0 for the user
        await ChatList.findOneAndUpdate(
            { userId: userId, chatId, },
            { $set: { unreadCount: 0, lastMessageStatus: 'read' } },
            { upsert: false }
        );



        console.log("Marking messages as read for userId: %s, receiverId: %s, chatId: %s", userId, receiverId, chatId);
        io.to(userId).emit('messageRead', { senderId: userId, receiverId, chatId });
        io.to(receiverId).emit('chatListCount', { count: 0, chatId });

        res.status(200).json({
            status: 1,
            message: 'All unread messages marked as read',
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            status: -1,
            message: 'Internal server error',
        });
    }
};

async function getLastChat(userId) {
    const chatList = await ChatList.aggregate([
        {
            $match: {
                userId: userId
            }
        },
        {
            $addFields: {
                receiverObjectId: {
                    $cond: {
                        if: { $eq: [{ $strLenCP: { $ifNull: ["$receiverId", ""] } }, 24] },
                        then: { $toObjectId: "$receiverId" },
                        else: null
                    }
                },
                senderObjectId: {
                    $cond: {
                        if: { $eq: [{ $strLenCP: { $ifNull: ["$senderId", ""] } }, 24] },
                        then: { $toObjectId: "$senderId" },
                        else: null
                    }
                }
            }
        },
        {
            $addFields: {
                opponentId: {
                    $cond: [
                        { $eq: ["$senderId", userId] },
                        "$receiverObjectId",
                        "$senderObjectId"
                    ]
                }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "opponentId",
                foreignField: "_id",
                as: "opponentDetails"
            }
        },
        {
            $unwind: {
                path: "$opponentDetails",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 0,
                chatId: 1,
                lastMessage: {
                    text: "$lastMessage",
                    status: "$lastMessageStatus",
                    time: "$lastMessageTime",
                    senderId: "$senderId",
                    receiverId: "$receiverId"
                },
                unreadCount: 1,
                opponent: {
                    id: "$opponentDetails._id",
                    name: "$opponentDetails.name",
                    phoneNumber: "$opponentDetails.phoneNumber",
                    countryCode: "$opponentDetails.countryCode",
                    profileImage: "$opponentDetails.profileImage"
                }
            }
        },
        {
            $sort: { "lastMessage.time": -1 }
        }
    ]);

    return chatList;
}


module.exports = { getUserChatList, getChatDetails, sendMessage, updateMessageStatus, markMessagesAsRead };