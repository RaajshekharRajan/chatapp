import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

// ====================================================================================
// IMPORTANT: Replace this with the URL of your deployed backend Web Service on Render
const SERVER_URL = 'https://chatapp-mbgw.onrender.com';
// ====================================================================================

const socket = io(SERVER_URL);

function App() {
  // State for login and current user
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // State for chat functionality
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // New state for user list and selection
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Effect to handle incoming messages in real-time
  useEffect(() => {
    socket.on('receiveMessage', (message) => {
      // Add message to state only if it's part of the selected conversation
      if (selectedUser && (message.senderId === selectedUser._id || message.senderId === user._id)) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    return () => {
      socket.off('receiveMessage');
    };
  }, [selectedUser, user]);


  // Function to handle user login/signup
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${SERVER_URL}/users`, { name, email });
      const loggedInUser = response.data;
      setUser(loggedInUser);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      
      // Fetch all users after logging in
      fetchUsers();
    } catch (error)      {
      console.error('Login failed:', error);
    }
  };

  // Function to fetch all users from the server
  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${SERVER_URL}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  // Function to fetch messages for a given user
  const fetchMessages = async (userId) => {
    try {
      const response = await axios.get(`${SERVER_URL}/messages?userId=${userId}`);
      setMessages(response.data.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Function to handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || !selectedUser) {
      return; // Don't send if no message or no user selected
    }

    const messageData = {
      senderId: user._id,
      receiverId: selectedUser._id, // Use the dynamically selected user's ID
      message: newMessage,
    };

    try {
      // POST the message to the server to save it and emit it
      const response = await axios.post(`${SERVER_URL}/messages`, messageData);
      
      // The server will emit 'receiveMessage', which our useEffect will catch.
      // We can also add it to our own state immediately for a snappier feel.
      setMessages((prevMessages) => [...prevMessages, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Function to handle selecting a user from the list
  const handleUserSelect = (selected) => {
    setSelectedUser(selected);
    fetchMessages(user._id); // Fetch all messages for the logged-in user
    // A more advanced app would filter messages for just this conversation
  };

  // Render Login/Signup form if no user is logged in
  if (!user) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin}>
          <h2>Chat App Login</h2>
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

  // Render the main chat interface if logged in
  return (
    <div className="app-container">
      <div className="users-list">
        <h3>Users</h3>
        {users
          .filter((u) => u._id !== user._id) // Don't show the current user in the list
          .map((u) => (
            <div
              key={u._id}
              className={`user-item ${selectedUser?._id === u._id ? 'selected' : ''}`}
              onClick={() => handleUserSelect(u)}
            >
              {u.name}
            </div>
          ))}
      </div>
      <div className="chat-container">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h4>Chatting with {selectedUser.name}</h4>
            </div>
            <div className="messages-list">
              {messages
                // Filter messages for the current conversation
                .filter(msg => 
                  (msg.senderId === user._id && msg.receiverId === selectedUser._id) || 
                  (msg.senderId === selectedUser._id && msg.receiverId === user._id)
                )
                .map((msg, index) => (
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
          </>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a user from the list to start chatting</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
