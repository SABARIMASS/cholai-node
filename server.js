const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const contactRoutes = require('./routes/contactRoutes');
const chatRoutes = require('./routes/chatRoutes');
const imageRoutes = require('./routes/documnetsRoutes');
const path = require('path');
// Load environment variables
dotenv.config();

// Initialize the app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/contacts', contactRoutes);
app.use('/api/documents', imageRoutes);
app.use('/api/chats', (req, res, next) => {
    req.io = io; // Pass io object to chatRoutes
    next();
}, chatRoutes);


// Serve static files from the "local/temp" folder
app.use('/local/temp', express.static(path.join(__dirname, 'local/temp')));
// Initialize socket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle joining a specific chat room (using chatId as room identifier)
    socket.on('joinChat', (chatId) => {
        console.log('User joined chat room:', chatId);
        socket.join(chatId);  // User joins a specific chat room
    });

    // Handle leaving a chat room
    socket.on('leaveChat', (chatId) => {
        console.log('User left chat room:', chatId);
        socket.leave(chatId);  // User leaves the specific chat room
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
