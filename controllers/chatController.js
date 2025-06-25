const ChatList = require('../models/ChatList');
const ChatDetails = require('../models/ChatDetail');
const moment = require('moment'); // For date formatting (optional but recommended)
const { v4: uuidv4 } = require('uuid'); // Use this to generate a unique messageId
const mongoose = require('mongoose');
const User = require('../models/User');


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
    const { chatId } = req.body;

    try {
        // Fetch all messages for the given chatId and sort by timestamp
        const chatDetails = await ChatDetails.find({ chatId }).sort({ timestamp: 1 });

        // Group messages by date (today, yesterday, and older dates)
        const groupedMessages = chatDetails.reduce((acc, message) => {
            const messageDate = moment(message.timestamp).format('YYYY-MM-DD');
            const today = moment().format('YYYY-MM-DD');
            const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

            // Determine the label for the group (Today, Yesterday, or older date)
            let groupLabel;
            if (messageDate === today) {
                groupLabel = 'Today';
            } else if (messageDate === yesterday) {
                groupLabel = 'Yesterday';
            } else {
                groupLabel = moment(message.timestamp).format('D MMMM YYYY');
            }

            // If the group doesn't exist in the accumulator, create it
            if (!acc[groupLabel]) {
                acc[groupLabel] = [];
            }

            // Push the message into the appropriate group
            acc[groupLabel].push(message);

            return acc;
        }, {});

        // Convert the grouped messages into an array for easier display
        const formattedMessages = Object.keys(groupedMessages).map(date => ({
            dateLabel: date,
            messages: groupedMessages[date]
        }));

        // Sort the groups to show "Today" first, followed by "Yesterday", and then older dates
        formattedMessages.sort((a, b) => {
            if (a.dateLabel === 'Today') return -1;
            if (b.dateLabel === 'Today') return 1;
            if (a.dateLabel === 'Yesterday') return -1;
            if (b.dateLabel === 'Yesterday') return 1;
            return new Date(b.dateLabel) - new Date(a.dateLabel);
        });

        res.status(200).json({
            status: 1, // Success
            message: 'Chat details retrieved successfully',
            data: formattedMessages,
        });
    } catch (error) {
        console.error('Error fetching chat details:', error);
        res.status(500).json({
            status: -1, // Failure
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
                lastMessageStatus:'none',
                receiverId: receiverId,
                lastMessageTime: Date.now(),
                unreadCount: receiverUnreadCount , // Increment unread count for receiver
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
            { chatId, senderId: userId, senderUnreadCount:0,status: { $ne: 'read' } },
            { $set: { status: 'read' } }
        );

        // Update the ChatList to set unreadCount to 0 for the user
        await ChatList.findOneAndUpdate(
            { userId:userId, chatId, },
            { $set: { unreadCount: 0, lastMessageStatus: 'read' } },
            { upsert: false }
        );
   

        
        console.log("Marking messages as read for userId: %s, receiverId: %s, chatId: %s", userId, receiverId, chatId);
        io.to(userId).emit('messageRead', { senderId:userId, receiverId, chatId });
        io.to(receiverId).emit('chatListCount', { count: 0, chatId  });

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