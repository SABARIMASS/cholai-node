const mongoose = require('mongoose');

const chatListSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // The user viewing this chat list
    chatId: { type: String, required: true }, // Unique chat ID for the conversation
    participants: { type: [String], required: true }, // Array of participant user IDs
    lastMessage: { type: String, required: true }, // Content of the last message
    receiverId: { type: String, required: true }, // User ID of the last sender
      senderId: { type: String, required: true }, // User ID of the last sender
    lastMessageTime: { type: Date, default: Date.now }, // Time of the last message
    
    lastMessageStatus: {
        type: String,
        enum: ['sent', 'delivered', 'read','none'],
        default: 'sent'
    }, // Status of the last message
    unreadCount: { type: Number, default: 0 }, // Count of unread messages
});

module.exports = mongoose.model('ChatList', chatListSchema);
