const mongoose = require('mongoose');



const chatDetailsSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },  // Unique messageId
    chatId: { type: String, required: true }, // Unique chatId for the conversation
    senderId: { type: String, required: true }, // Sender of the message
    receiverId: { type: String, required: true }, // Receiver of the message
    message: { type: String, required: true },  // Message content
    status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },  // Status of the message
    timestamp: { type: Date, default: Date.now }, // Time message was sent
    senderUnreadCount: { type: Number, default: 0 }, // Count of unread messages for the receiver
    receiverUnreadCount: { type: Number, default: 0 }, // Count of unread messages for the receiver
}, { timestamps: true });

const ChatDetails = mongoose.model('ChatDetails', chatDetailsSchema);

module.exports = ChatDetails;


module.exports = mongoose.model('ChatDetail', chatDetailsSchema);
// Frontend Display Logic:
// Chat List:
// If lastSenderId === userId:
// Show ticks for lastMessageStatus:
// sent: Single tick.
// delivered: Double tick.
// read: Blue double tick.
// If lastSenderId !== userId:
// Show the last message text and the unreadCount.
// Chat Details:
// If message.senderId === userId:
// Align to the right with status ticks.
// If message.senderId !== userId:
// Align to the left.