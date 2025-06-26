import ChatList from '../models/ChatList.js';
import ChatDetails from '../models/ChatDetail.js';
import User from '../models/User.js';
// Maintain peer mapping
const users = {};
export default function (io) {

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        const userId = socket.handshake.query.userId;

        io.emit('updateUserStatus', { userId, status: 'online' });
        if (userId) {
            socket.join(userId);
            console.log(`User ${userId} joined their personal room`);
            const now = new Date();
            User.findByIdAndUpdate(userId, {
                isOnline: true,
                lastSeenDateTime: now,
            }, { new: true }).then((updatedUser) => {
                if (updatedUser) {
                    io.emit('updateUserStatus', {
                        userId,
                        status: 'online'
                    });
                }
            }).catch(console.error);

        }

        socket.on('joinChat', (chatId) => {
            socket.join(chatId);
            console.log(`Joined chat room: ${chatId}`);
        });

        socket.on('leaveChat', (chatId) => {
            socket.leave(chatId);
            console.log(`Left chat room: ${chatId}`);
        });

        socket.on('markAsDelivered', async (data) => {
            const { senderId, receiverId, chatId, messageId } = data;

            console.log(`Marking message  as delivered from ${senderId} to ${receiverId} in chat ${chatId}`);

            try {
                const result = await ChatDetails.updateMany(
                    { chatId, senderId, receiverId, status: 'sent' },
                    { $set: { status: 'delivered' } }
                );
                console.log('Matched:', result.matchedCount, 'Modified:', result.acknowledged);

                console.log(`ChatDetails: Message  marked as delivered`);

                // Update ChatList if this message is the last one shown
                await ChatList.updateOne(

                    {
                        userId: senderId,
                        chatId, senderId, receiverId,
                        lastMessageStatus: { $ne: "delivered" }
                    },
                    { $set: { lastMessageStatus: "delivered" } }
                    // { $set: { lastMessageStatus: 'delivered' } }
                );
                console.log('Matched:', result.matchedCount);
                console.log('Modified:', result.modifiedCount);
                console.log(`ChatList: Last message status updated to delivered for chat ${chatId}`);

                // Emit event to receiver and chat room
                //io.to(chatId).emit('messageDeliveredAll', { senderId, receiverId, chatId, messageId });
                io.to(senderId).emit('messageDeliveredAll', { senderId, receiverId, chatId, messageId });
                io.to(senderId).emit('messageDelivered', { senderId, receiverId, chatId, messageId });

            } catch (err) {
                console.error(`Error in markAsDelivered: ${err.message}`);
            }
        });

        socket.on('markAsRead', async (data) => {
            const { senderId, receiverId, chatId } = data;

            console.log(`Marking messages as read from ${senderId} to ${receiverId} in chat ${chatId}`);

            try {
                // 1. Update all unread ChatDetails messages from sender to receiver
                const result = await ChatDetails.updateMany(
                    {
                        chatId,
                        senderId,
                        receiverId, senderUnreadCount: 0,
                        status: { $ne: 'read' },
                    },
                    { $set: { status: 'read' } }
                );

                console.log(`ChatDetails: ${result.modifiedCount} messages marked as read`);

                // 2. Update ChatList: Set lastMessageStatus to 'read' and reset unread count
                await ChatList.updateOne(
                    {
                        userId: receiverId,
                        chatId,
                        // senderId,
                        // receiverId,
                    },
                    {
                        $set: {
                            lastMessageStatus: 'read',
                            unreadCount: 0,
                        },
                    }
                );
                await ChatList.updateOne(
                    {
                        userId: senderId,
                        chatId,
                        // senderId,
                        // receiverId,
                    },
                    {
                        $set: {
                            lastMessageStatus: 'read',
                            unreadCount: 0,
                        },
                    }
                );

                console.log(`ChatList: Last message status updated to read for chat ${chatId}`);

                // 3. Emit to sender (who originally sent the message), so their UI updates
                io.to(senderId).emit('messageRead', {
                    senderId,
                    receiverId,
                    chatId,
                });
                io.to(receiverId).emit('chatListCount', { count: 0, chatId });
            } catch (err) {
                console.error(`Error in markAsRead: ${err.message}`);
            }
        });

        socket.on('typing', ({ chatId, senderId }) => {
            socket.broadcast.to(chatId).emit('userTyping', { senderId, chatId });
        });

        socket.on('stopTyping', ({ chatId, senderId }) => {
            socket.broadcast.to(chatId).emit('userStoppedTyping', { senderId, chatId });
        });

        ////VOICE AND VIDEO CALLS
        // socket.on('register', (userId) => {
           
        // });
         users[userId] = socket.id;

        socket.on('offer', (data) => {
            console.log('Offer received:', data);
            const targetSocket = users[data.to];
            io.to(targetSocket).emit('offer', data);
        });

        socket.on('answer', (data) => {
            console.log('Answer received:', data);
            const targetSocket = users[data.to];
            io.to(targetSocket).emit('answer', data);
        });

        socket.on('ice-candidate', (data) => {
            console.log('ICE candidate received:', data);
            const targetSocket = users[data.to];
            io.to(targetSocket).emit('ice-candidate', data);
        });
socket.on('end_call', ({ to }) => {
  const targetSocket = users[to];
  if (targetSocket) {
    io.to(targetSocket).emit('end_call');
  }
});

        socket.on('disconnect', async () => {

            if (userId) {
                try {
                    const now = new Date();
                    await User.findByIdAndUpdate(userId, {
                        isOnline: false,
                        lastSeenDateTime: now,
                    });

                    io.emit('updateUserStatus', {
                        userId,
                        status: 'offline',
                        lastSeen: now
                    });
                } catch (err) {
                    console.error('Error updating user status on disconnect:', err);
                }
            }
            console.log('User disconnected:', socket.id, userId);
            ///VOICE AND VIDEO CALLS
            for (const [userId, id] of Object.entries(users)) {
                if (id === socket.id) {
                    delete users[userId];
                    break;
                }
            }

        });
    });
};
