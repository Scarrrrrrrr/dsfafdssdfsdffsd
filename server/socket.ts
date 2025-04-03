import { Server as HttpServer } from "http";
import { WebSocketServer } from "ws";
import { IStorage } from "./storage";
import WebSocket from "ws";
import { MessageReaction } from "@shared/schema";

type MessagePayload = {
  type: string;
  conversationId?: number;
  message?: any;
  messageId?: number;
  content?: string;
  reaction?: MessageReaction;
  emoji?: string;
  userId?: number;
  attachments?: Array<{
    name: string;
    type: string;
    url: string;
    size?: number;
  }>;
};

export function setupSocketServer(httpServer: HttpServer, storage: IStorage) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track clients by userId
  const clients = new Map<number, WebSocket>();
  
  wss.on('connection', (ws, req) => {
    console.log('WebSocket connection established');
    
    // Parse userId from cookie (using session)
    let userId: number | undefined;
    
    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString()) as MessagePayload;
        
        switch (payload.type) {
          case 'authenticate':
            // User is authenticating with their ID
            userId = Number(payload.message);
            if (isNaN(userId)) {
              console.error('Invalid user ID for authentication');
              break;
            }
            
            // Store client connection mapped to user ID
            clients.set(userId, ws);
            
            // Update user's online status
            await storage.updateUserOnlineStatus(userId, true);
            
            // Broadcast user's online status to all clients
            broadcastUserStatus(userId, true);
            
            console.log(`User ${userId} authenticated via WebSocket`);
            break;
            
          case 'message':
            if (!userId) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Not authenticated'
              }));
              break;
            }
            
            if (!payload.conversationId || !payload.message) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
              }));
              break;
            }
            
            // Save message to storage
            const messageData = {
              conversationId: payload.conversationId,
              senderId: userId,
              content: payload.message,
              attachments: payload.attachments || []
            };
            
            const savedMessage = await storage.createMessage(messageData);
            
            // Get conversation to determine recipients
            const conversation = await storage.getConversationById(payload.conversationId);
            
            if (conversation) {
              // Broadcast message to all members of the conversation
              conversation.members.forEach(member => {
                const client = clients.get(member.id);
                if (client && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'new_message',
                    conversationId: payload.conversationId,
                    message: savedMessage
                  }));
                }
              });
            }
            break;
            
          case 'typing':
            if (!userId || !payload.conversationId) break;
            
            // Get conversation to determine recipients
            const typingConversation = await storage.getConversationById(payload.conversationId);
            
            if (typingConversation) {
              // Broadcast typing status to other members
              typingConversation.members.forEach(member => {
                if (member.id !== userId) { // Don't send back to the typer
                  const client = clients.get(member.id);
                  if (client && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'typing',
                      conversationId: payload.conversationId,
                      userId: userId
                    }));
                  }
                }
              });
            }
            break;
            
          case 'edit_message':
            if (!userId || !payload.messageId || !payload.content) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message edit format'
              }));
              break;
            }
            
            // Edit the message
            const updatedMessage = await storage.updateMessage(payload.messageId, payload.content);
            
            if (!updatedMessage) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to update message'
              }));
              break;
            }
            
            // Get conversation to determine recipients
            const messageConversation = await storage.getConversationById(updatedMessage.conversationId);
            
            if (messageConversation) {
              // Broadcast updated message to all members of the conversation
              messageConversation.members.forEach(member => {
                const client = clients.get(member.id);
                if (client && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'message_updated',
                    conversationId: updatedMessage.conversationId,
                    message: updatedMessage
                  }));
                }
              });
            }
            break;
            
          case 'add_reaction':
            if (!userId || !payload.messageId || !payload.emoji) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid reaction format'
              }));
              break;
            }
            
            // Add reaction to the message
            const reaction = {
              messageId: payload.messageId,
              userId,
              emoji: payload.emoji
            };
            
            const messageWithReaction = await storage.addReactionToMessage(payload.messageId, reaction);
            
            if (!messageWithReaction) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to add reaction'
              }));
              break;
            }
            
            // Get conversation to determine recipients
            const reactionConversation = await storage.getConversationById(messageWithReaction.conversationId);
            
            if (reactionConversation) {
              // Broadcast updated message to all members of the conversation
              reactionConversation.members.forEach(member => {
                const client = clients.get(member.id);
                if (client && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'message_reacted',
                    conversationId: messageWithReaction.conversationId,
                    message: messageWithReaction
                  }));
                }
              });
            }
            break;
            
          case 'remove_reaction':
            if (!userId || !payload.messageId || !payload.emoji) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid reaction removal format'
              }));
              break;
            }
            
            // Remove reaction from the message
            const messageAfterRemoval = await storage.removeReactionFromMessage(
              payload.messageId,
              userId,
              payload.emoji
            );
            
            if (!messageAfterRemoval) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to remove reaction'
              }));
              break;
            }
            
            // Get conversation to determine recipients
            const removalConversation = await storage.getConversationById(messageAfterRemoval.conversationId);
            
            if (removalConversation) {
              // Broadcast updated message to all members of the conversation
              removalConversation.members.forEach(member => {
                const client = clients.get(member.id);
                if (client && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'message_reaction_removed',
                    conversationId: messageAfterRemoval.conversationId,
                    message: messageAfterRemoval
                  }));
                }
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', async () => {
      if (userId) {
        // Remove client from tracking
        clients.delete(userId);
        
        // Update user's online status
        await storage.updateUserOnlineStatus(userId, false);
        
        // Broadcast user's offline status
        broadcastUserStatus(userId, false);
        
        console.log(`User ${userId} disconnected`);
      }
    });
    
    // Send initial connection success message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to chat server'
    }));
  });
  
  // Function to broadcast user status changes to relevant users
  async function broadcastUserStatus(userId: number, isOnline: boolean) {
    const user = await storage.getUser(userId);
    if (!user) return;
    
    // Get all conversations this user is part of
    const conversations = await storage.getConversationsForUser(userId);
    
    // Collect unique members from all these conversations
    const uniqueMembers = new Set<number>();
    conversations.forEach(conv => {
      conv.members.forEach(member => {
        uniqueMembers.add(member.id);
      });
    });
    
    // Send status update to all relevant members
    uniqueMembers.forEach(memberId => {
      if (memberId !== userId) { // Don't send to the user themselves
        const client = clients.get(memberId);
        if (client && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user_status',
            userId,
            isOnline
          }));
        }
      }
    });
  }
  
  console.log('WebSocket server initialized');
}
