const express = require('express');
const { getChatList, getChatDetails, sendMessage, markMessagesAsRead, updateMessageStatus } = require('../controllers/chatController');
const router = express.Router();

router.post('/chat-list', getChatList);
router.post('/chat-details', getChatDetails);
router.post('/send-message', sendMessage);
router.post('/mark-messages_read', markMessagesAsRead);
router.post('/mark-message_status', updateMessageStatus);

module.exports = router;
