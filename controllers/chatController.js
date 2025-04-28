const ChatList = require('../models/ChatList');
const ChatDetails = require('../models/ChatDetail');
const moment = require('moment'); // For date formatting (optional but recommended)
const { v4: uuidv4 } = require('uuid'); // Use this to generate a unique messageId


const getChatList = async (req, res) => {
    const { userId } = req.body;

    try {
        // Aggregate the chat list with grouping by lastMessageDate (date only)
        const chatList = await ChatList.aggregate([
            { $match: { userId } }, // Match the userId
            {
                $project: {
                    chatId: 1,
                    participants: 1,
                    lastMessage: 1,
                    lastMessageTime: 1,
                    lastMessageDate: { $toDate: "$lastMessageTime" }, // Extract the date part of the last message time
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$lastMessageDate" } } // Group by date
                    },
                    chats: { $push: "$$ROOT" } // Push all the chats into the 'chats' array
                }
            },
            { $sort: { "_id.date": -1 } }, // Sort the dates in descending order (most recent first)
        ]);

        // Format the date and structure the response to make it user-friendly
        const formattedChatList = chatList.map(group => ({
            date: moment(group._id.date).format('YYYY-MM-DD'), // Format date as 'YYYY-MM-DD'
            chats: group.chats.sort((a, b) => b.lastMessageTime - a.lastMessageTime) // Sort chats by lastMessageTime (newest first)
        }));

        res.status(200).json({
            status: 1, // Success
            message: 'Chat list retrieved successfully',
            data: formattedChatList, // Send the grouped and formatted chat list
        });
    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).json({
            status: -1, // Failure
            message: 'Internal server error',
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
                groupLabel = messageDate;
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
        const io = req.io; // Access io from the request
        const chatId = [senderId, receiverId].sort().join('_');
        const messageId = uuidv4();

        const newMessage = new ChatDetails({
            messageId,
            chatId,
            senderId,
            receiverId,
            message,
            status: 'sent',
        });

        await newMessage.save();

        await ChatList.findOneAndUpdate(
            { userId: senderId, chatId },
            {
                userId: senderId,
                chatId,
                participants: [senderId, receiverId],
                lastMessage: message,
                lastSenderId: senderId,
                lastMessageTime: Date.now(),
                lastMessageStatus: 'sent',
            },
            { upsert: true }
        );

        await ChatList.findOneAndUpdate(
            { userId: receiverId, chatId },
            {
                userId: receiverId,
                chatId,
                participants: [senderId, receiverId],
                lastMessage: message,
                lastSenderId: senderId,
                lastMessageTime: Date.now(),
                unreadCount: 1,
            },
            { upsert: true }
        );

        const chatListData = {
            chatId,
            participants: [senderId, receiverId],
            lastMessage: message,
            lastSenderId: senderId,
            lastMessageTime: Date.now(),
            unreadCount: 1,
        };

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
        io.in(chatId).emit('updateChatList', chatListData);  // Emit to chat room
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
        // Mark all unread messages for the user as 'read'
        await ChatDetails.updateMany(
            { chatId, receiverId: userId, status: { $ne: 'read' } },
            { $set: { status: 'read' } }
        );

        // Update the ChatList to set unreadCount to 0 for the user
        await ChatList.findOneAndUpdate(
            { userId, chatId },
            { $set: { unreadCount: 0 } },
            { upsert: true }
        );

        res.status(200).json({
            status: 1, // Success
            message: 'All unread messages marked as read',
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            status: -1, // Failure
            message: 'Internal server error',
        });
    }
};



module.exports = { getChatList, getChatDetails, sendMessage, updateMessageStatus, markMessagesAsRead };