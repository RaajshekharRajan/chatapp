// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// --- START OF CORS CONFIGURATION ---

// 1. Define the URLs that are allowed to connect
const allowedOrigins = [
  'https://chatapp-1-j6a5.onrender.com', // Your deployed frontend URL
  'http://localhost:3000'                      // Your local development URL
];

// 2. Set up CORS options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};

// 3. Use the CORS middleware for all Express routes
app.use(cors(corsOptions));

// --- END OF CORS CONFIGURATION ---

app.use(express.json());

// Initialize Socket.IO and attach it to the HTTP server with the same CORS options
const io = new Server(server, {
  cors: corsOptions
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import models
const User = require('./models/User');
const Message = require('./models/Message');

// --- API Routes ---

// API to create a user
app.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(200).json(user);
    }
    user = new User({ name, email });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API to send a message
app.post('/messages', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    const newMessage = new Message({ senderId, receiverId, message });
    await newMessage.save();
    // Emit the message to the receiver in real-time
    io.emit('receiveMessage', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API to fetch recent chats for a user
app.get('/messages', async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// --- Socket.IO Logic ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Note: We are now emitting messages globally from the POST /messages route
  // to ensure messages are saved before being sent.
  // This simplifies the logic and guarantees persistence.

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
