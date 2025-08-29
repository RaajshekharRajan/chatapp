// client/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css'; // We'll create this file for styling

const socket = io('http://localhost:5000'); // Your backend server address

function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  
  // A simple placeholder for the other user. In a real app, you'd have a user list.
  const receiverId = 'RECEIVER_USER_ID_PLACEHOLDER'; 

  // Effect to handle incoming messages
  useEffect(() => {
    socket.on('receiveMessage', (message) => {
      // Make sure we don't add the message twice if we sent it
      if (message.senderId !== user?._id) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    // Cleanup on component unmount
    return () => {
      socket.off('receiveMessage');
    };
  }, [user]);

  // Function to handle user login/signup 
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/users', { name, email });
      setUser(response.data);
      localStorage.setItem('user', JSON.stringify(response.data)); // Persist user
      fetchMessages(response.data._id);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Function to fetch initial messages
  const fetchMessages = async (userId) => {
    try {
      const response = await axios.get(`http://localhost:5000/messages?userId=${userId}&limit=50`);
      setMessages(response.data.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Function to handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user) return;

    const messageData = {
      senderId: user._id,
      receiverId: receiverId, // NOTE: This needs to be dynamic in a real app
      message: newMessage,
    };

    try {
      // 1. Persist message to DB 
      const response = await axios.post('http://localhost:5000/messages', messageData);
      
      // 2. Send message via Socket.IO for real-time update 
      socket.emit('sendMessage', response.data);

      // 3. Update local state
      setMessages((prevMessages) => [...prevMessages, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Login/Signup form
  if (!user) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin}>
          <h2>Login / Signup</h2>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Enter Chat</button>
        </form>
      </div>
    );
  }

  // Chat UI
  return (
    <div className="chat-container">
      <div className="messages-list">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.senderId === user._id ? 'sent' : 'received'}`}>
            <p>{msg.message}</p>
          </div>
        ))}
      </div>
      <form className="message-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default App;