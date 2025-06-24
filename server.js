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
const socketHandler = require('./socket/socketHandler').default;
// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/contacts', contactRoutes);
app.use('/api/documents', imageRoutes);
app.use('/api/chats', (req, res, next) => {
    req.io = io; // Pass io object to chatRoutes
    next();
}, chatRoutes);


// Serve static files from the "local/temp" folder
app.use('/local', express.static(path.join(__dirname, 'local')));
// Initialize socket connections
socketHandler(io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
