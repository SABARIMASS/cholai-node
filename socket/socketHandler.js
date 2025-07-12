import ChatList from '../models/ChatList.js';
import ChatDetails from '../models/ChatDetail.js';
import User from '../models/User.js';
import CallHistory from '../models/CallLogs.js';

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




        socket.on('offer', async (data) => {
            try {
                const callSessionId = data.callSessionId;
                const targetSocket = users[data.to];
                await CallHistory.create({
                    callSessionId,
                    callerId: data.from,
                    receiverId: data.to,
                    callType: data.isVideoCall ? "video" : "audio",
                    status: "missed",
                    startTime: new Date(),
                });
                if (!targetSocket) {

                    await CallHistory.findOneAndUpdate(
                        { callSessionId: data.callSessionId },
                        { status: "missed" }
                    );
                    io.to(data.from).emit('end_call', { message: 'User was not in online' });
                    return;
                }

                // Fetch userInfo
                const user = await User.findById(data.from); // assuming `data.from` contains userId

                if (!user) {
                    await CallHistory.findOneAndUpdate(
                        { callSessionId: data.callSessionId },
                        { status: "missed" }
                    );
                    io.to(data.from).emit('end_call', { message: 'User Not Found' });
                    return;
                }

                const userInfo = {
                    userId: user._id,
                    name: user.name,
                    countryCode: user.countryCode,
                    phoneNumber: user.phoneNumber,
                    about: user.about,
                    userStatus: user.userStatus,
                    profileImage: user.profileImage,
                };

                // Send offer along with userInfo
                io.to(targetSocket).emit('offer', { ...data, userInfo, callSessionId });
            } catch (error) {
                console.error('Offer error:', error);
                socket.emit('error', { message: 'Failed to process offer' });
            }
        });

        socket.on('answer', async (data) => {
            try {
                const targetSocket = users[data.to];

                if (!targetSocket) {
                    await CallHistory.findOneAndUpdate(
                        { callSessionId: data.callSessionId },
                        { status: "missed" }
                    );
                    io.to(data.from).emit('end_call', { message: 'User was not online' });
                    return;
                }

                // Fetch userInfo
                const user = await User.findById(data.from); // assuming `data.from` contains userId

                if (!user) {
                    await CallHistory.findOneAndUpdate(
                        { callSessionId: data.callSessionId },
                        { status: "missed" }
                    );
                    io.to(data.from).emit('end_call', { message: 'User not found' });
                    return;
                }

                const userInfo = {
                    userId: user._id,
                    name: user.name,
                    countryCode: user.countryCode,
                    phoneNumber: user.phoneNumber,
                    about: user.about,
                    userStatus: user.userStatus,
                    profileImage: user.profileImage,
                };
                // Update CallHistory status to 'completed' (or 'ongoing')
                await CallHistory.findOneAndUpdate(
                    { callSessionId: data.callSessionId },
                    { status: "ongoing" }
                );
                // Send answer along with userInfo
                io.to(targetSocket).emit('answer', { ...data, userInfo });
            } catch (error) {
                console.error('Answer error:', error);
                socket.emit('error', { message: 'Failed to process answer' });
            }
        });



        socket.on('ice-candidate', (data) => {
            //  console.log('ICE candidate received:', data);
            const targetSocket = users[data.to];
            io.to(targetSocket).emit('ice-candidate', data);
        });
        socket.on('end_call', async ({ to, callSessionId, isCallHangUp }) => {
            console.log('Ending call for:', to, callSessionId);
            //const targetSocket = users[to];
            // if (targetSocket) {
            const callRecord = await CallHistory.findOne({ callSessionId });

            if (!callRecord) {
                throw new Error("Call record not found");
            }

            const endTime = new Date();
            const durationSeconds = isCallHangUp === true ? Math.floor((endTime - callRecord.startTime) / 1000) : 0;
            await CallHistory.findOneAndUpdate(
                { callSessionId },
                {
                    status: "completed",
                    endTime: new Date(),
                    durationSeconds: durationSeconds, // Calculate duration in seconds
                    disconnectReason: "user_ended"
                }
            );
            io.to(to).emit('end_call');
            //}
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
