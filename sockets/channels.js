const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const { saveHumanAgentMessage } = require('../services/messageService');

/**
 * ALERTS CHANNEL HANDLER
 * Handles events related to business alerts
 */
function alertHandler(io, socket) {
    socket.on('join_alerts', (businessId) => {
      const room = `business_${businessId}_alerts`;
      socket.join(room);
      console.log(`🔔 Socket ${socket.id} joined alerts room: ${room}`);
      
      // Confirma al cliente que se unió exitosamente
      socket.emit('joined_alerts', { businessId, room });
    });
  
    socket.on('leave_alerts', (businessId) => {
      const room = `business_${businessId}_alerts`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left alerts room: ${room}`);
    });
  }
  
  /**
   * CHAT LIVE CHANNEL HANDLER
   * Handles real-time chat communication
   */
// sockets/channels.js
function chatLiveHandler(io, socket) {
  
    // ✅ AGREGA ESTO - Para recibir notificaciones de TODAS las conversaciones
    socket.on('join_business_conversations', (businessId) => {
      const room = `business_${businessId}_chat`;
      socket.join(room);
      console.log(`💬 Socket ${socket.id} joined business conversations room: ${room}`);
      socket.emit('joined_business_conversations', { room });
    });
  
    socket.on('leave_business_conversations', (businessId) => {
      const room = `business_${businessId}_chat`;
      socket.leave(room);
      console.log(`👋 Socket ${socket.id} left business conversations room: ${room}`);
    });
  
    // Para unirse a UNA conversación específica (cuando abres el chat)
    socket.on('join_conversation', (sessionId) => {
      socket.join(sessionId);
      console.log(`✅ Socket ${socket.id} joined session: ${sessionId}`);
    });
  
    socket.on('leave_conversation', (sessionId) => {
      socket.leave(sessionId);
      console.log(`👋 Socket ${socket.id} left session: ${sessionId}`);
    });
  
    socket.on('support_message', async ({ sessionId, message }) => {
      const messageData = {
        ...message,
        _id: new mongoose.Types.ObjectId(),
        timestamp: new Date()
      };
      // Broadcast to session room
      io.to(sessionId).emit('new_message', {
        sessionId,
        message: messageData
      });
      // Save to DB async
      try {
        await saveHumanAgentMessage(sessionId, message.content);
        console.log(`Human agent message saved in MongoDB from support_message`);
      } catch (error) {
        console.error('Error saving human agent message:', error);
      }
      
    });
  
    socket.on('support_typing', ({ sessionId }) => {
      socket.to(sessionId).emit('support_typing', { sessionId });
    });
  
    socket.on('support_stopped_typing', ({ sessionId }) => {
      socket.to(sessionId).emit('support_stopped_typing', { sessionId });
    });
  }
  
  module.exports = {
    alertHandler,
    chatLiveHandler,
  };
  