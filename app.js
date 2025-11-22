const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const { alertHandler, chatLiveHandler } = require('./sockets/channels');

require('dotenv').config();

//require("./cronJobs/generateSummary");
require("./cronJobs/deactiveSessions");

const connectDB = require('./config/db');
const chatRoutes = require('./routes/chatRoutes');
const knowledgeRoutes = require('./routes/knowledgeRoutes');
const businessRoutes = require('./routes/businessRoutes');
const testRoutes = require('./routes/testRoutes')
const authRoutes = require('./routes/authRoutes');
const alertRoutes = require('./routes/alertRoutes');

//Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  process.env.DASHBOARD_URL,
  process.env.WIDGET_URL,
];
// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

app.use(bodyParser.json());
app.use(express.json());

io.on('connection', (socket) => {
    // Register both handlers
    alertHandler(io, socket);
    chatLiveHandler(io, socket);
  
    socket.on('disconnect', () => {
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });
  
app.set('io', io);

app.use('/api/chat', chatRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/business', businessRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/test', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/alert', alertRoutes);


app.get('/api', (req, res) => {
  res.send('Chatbot microservice is running 🚀');
});

//Start server
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`🚀 Chatbot service running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready on ws://localhost:${PORT}`);
});

