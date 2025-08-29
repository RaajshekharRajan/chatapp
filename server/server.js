// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Middleware to parse JSON bodies

const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Your React app's address
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));


// Socket.IO connection logic for real-time communication 
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Listen for a new message from a client
  socket.on('sendMessage', (messageData) => {
    // Broadcast the message to the receiver
    // In a real app, you would target a specific user's socket ID or room
    socket.broadcast.emit('receiveMessage', messageData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

const User = require('./models/User');
const Message = require('./models/Message');

// API to create a user [cite: 11]
app.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      // For simplicity, if user exists, we'll just return them
      return res.status(200).json(user);
    }
    // If not, create a new one
    user = new User({ name, email });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API to send a message [cite: 12]
app.post('/messages', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    const newMessage = new Message({ senderId, receiverId, message });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API to fetch recent chats for a user [cite: 13]
app.get('/messages', async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query; // Default limit to 50
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
    .sort({ createdAt: -1 }) // Get the most recent messages
    .limit(parseInt(limit));
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

// --- We will add API routes below this line ---