require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const cors = require('cors');
const { QdrantClient } = require('@qdrant/js-client-rest');
const axios = require('axios');

// --- INITIALIZATIONS ---
const app = express();
const server = http.createServer(app);

// --- CORS CONFIGURATION ---
const allowedOrigins = [
  'https://chatapp-1-j6a5.onrender.com',
  'http://localhost:3000'                     
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());

// --- DATABASE & CLIENTS SETUP ---
const io = new Server(server, { cors: corsOptions });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// --- HELPER FUNCTIONS ---

// Definitive function combining retry logic with the correct payload format
async function getEmbedding(text) {
  const maxRetries = 3;
  const delay = 3000; // Increased delay to 3 seconds

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
        // The payload is now { sentences: [text] }
        { sentences: [text] },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } }
      );

      // The API returns an array of embeddings, so we take the first one
      const embedding = response.data[0];

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error('Invalid embedding format from Hugging Face.');
      }
      
      return embedding; // Success!

    } catch (error) {
      const statusCode = error.response ? error.response.status : null;
      const errorMessage = error.response ? error.response.data : error.message;

      console.error(
        `Attempt ${i + 1} failed with status ${statusCode}:`,
        JSON.stringify(errorMessage)
      );
      
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error('Failed to generate embedding after multiple attempts.');
      }
    }
  }
}

// --- MODEL IMPORTS ---
const User = require('./models/User');
const Message = require('./models/Message');

// --- API ROUTES ---

// POST /users -> Create a user or log them in
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

// GET /users -> Get a list of all users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /messages -> Send a message and index it for search
app.post('/messages', async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    const newMessage = new Message({ senderId, receiverId, message });
    await newMessage.save();

    const embedding = await getEmbedding(newMessage.message);

    await qdrantClient.upsert('messages', {
      wait: true,
      points: [{
        id: newMessage._id.toString(),
        vector: embedding,
        payload: {
          text: newMessage.message,
          timestamp: newMessage.createdAt,
          senderId: newMessage.senderId.toString(),
          receiverId: newMessage.receiverId.toString(),
        },
      }],
    });

    io.emit('receiveMessage', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error in POST /messages:', error);
    res.status(500).json({ error: 'Server error while posting message.' });
  }
});

// GET /messages -> Fetch recent chats for a user
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

// GET /semantic-search -> Perform a semantic search on messages
app.get('/semantic-search', async (req, res) => {
  try {
    const { userId, q } = req.query;
    if (!q || !userId) {
      return res.status(400).json({ error: 'Search query (q) and userId are required.' });
    }

    const queryVector = await getEmbedding(q);

    const searchResult = await qdrantClient.search('messages', {
      vector: queryVector,
      limit: 10,
      filter: {
        should: [
          { key: 'senderId', match: { value: userId } },
          { key: 'receiverId', match: { value: userId } },
        ],
      },
    });

    const formattedResults = searchResult.map((result) => ({
      message: result.payload.text,
      score: result.score,
      timestamp: result.payload.timestamp,
    }));

    res.status(200).json(formattedResults);
  } catch (error) {
    console.error('Error in /semantic-search:', error);
    res.status(500).json({ error: 'Server error during semantic search.' });
  }
});


// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
