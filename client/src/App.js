import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const SERVER_URL = 'https://chatapp-mbgw.onrender.com';


const socket = io(SERVER_URL);

function App() {
  // State for login and current user
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // State for chat functionality
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // State for user list and selection
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // --- NEW: State for semantic search ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);


  // Effect to handle incoming messages in real-time
  useEffect(() => {
    socket.on('receiveMessage', (message) => {
      if (selectedUser && (message.senderId === selectedUser._id || message.receiverId === selectedUser._id)) {
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
      fetchUsers();
    } catch (error) {
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

  // Function to fetch all messages for a given user
  const fetchMessages = async (userId) => {
    try {
      const response = await axios.get(`${SERVER_URL}/messages?userId=${userId}`);
      setMessages(response.data.reverse());
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };
  
  // --- NEW: Function to handle semantic search ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim() === '' || !user) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const response = await axios.get(`${SERVER_URL}/semantic-search`, {
        params: {
          userId: user._id,
          q: searchQuery,
        },
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Failed to perform semantic search:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !user || !selectedUser) return;

    const messageData = {
      senderId: user._id,
      receiverId: selectedUser._id,
      message: newMessage,
    };

    try {
      const response = await axios.post(`${SERVER_URL}/messages`, messageData);
      setMessages((prevMessages) => [...prevMessages, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Function to handle selecting a user from the list
  const handleUserSelect = (selected) => {
    setSelectedUser(selected);
    fetchMessages(user._id);
  };

  // Render Login/Signup form if no user is logged in
  if (!user) {
    return (
      <div className="login-container">
        <form onSubmit={handleLogin}>
          <h2>Chat App Login</h2>
          <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit">Enter Chat</button>
        </form>
      </div>
    );
  }

  // Render the main chat interface if logged in
  return (
    <div className="app-container">
      <div className="users-list">
        <h3>Users & Search</h3>
        
        {/* --- Search Form --- */}
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search messages by meaning..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" disabled={isSearching}>{isSearching ? '...' : 'Search'}</button>
        </form>

        {/* --- Search Results --- */}
        <div className="search-results-container">
          {isSearching && <p>Searching...</p>}
          {searchResults.length > 0 && (
            <div className="search-results">
              <h4>Search Results</h4>
              {searchResults.map((result, index) => (
                <div key={index} className="result-item">
                  <p className="result-text">"{result.message}"</p>
                  <span className="result-meta">
                    Score: {result.score.toFixed(3)} | {new Date(result.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- User List --- */}
        <div className="user-list-items">
          {users
            .filter((u) => u._id !== user._id)
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
      </div>

      <div className="chat-container">
        {selectedUser ? (
          <>
            <div className="chat-header"><h4>Chatting with {selectedUser.name}</h4></div>
            <div className="messages-list">
              {messages
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
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected"><h3>Select a user from the list to start chatting</h3></div>
        )}
      </div>
    </div>
  );
}

export default App;
