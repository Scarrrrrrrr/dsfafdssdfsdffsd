import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupSocketServer } from "./socket";
import { storage } from "./storage";
import { z } from "zod";
import { insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { db } from "./db";
import { users, conversations, conversationMembers, messages } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { registerServerRoutes } from "./server-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Register server routes
  registerServerRoutes(app);
  
  // Middleware to check if user is admin (user with ID 1 is admin)
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || req.user?.id !== 1) {
      return res.status(403).json({ error: "Access denied. Admin privileges required." });
    }
    next();
  };

  // Conversation routes
  app.get("/api/conversations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.user?.id;
    const conversations = await storage.getConversationsForUser(userId);
    res.json(conversations);
  });

  app.post("/api/conversations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const validatedData = insertConversationSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({ error: "Invalid conversation data" });
    }
    
    const { name, isGroup } = validatedData.data;
    const userIds = z.array(z.number()).safeParse(req.body.userIds);
    
    if (!userIds.success) {
      return res.status(400).json({ error: "Invalid user IDs" });
    }
    
    // For private conversations between two users
    if (!isGroup && userIds.data.length !== 1) {
      return res.status(400).json({ error: "Private conversations must have exactly one recipient" });
    }

    // Always include the current user
    const allUserIds = [...userIds.data, req.user.id];
    
    try {
      const conversation = await storage.createConversation({
        name,
        isGroup,
      }, allUserIds);
      
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    
    try {
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Check if user is a member of this conversation
      const isMember = conversation.members.some(member => member.id === req.user.id);
      if (!isMember) {
        return res.status(403).json({ error: "Not authorized to view this conversation" });
      }
      
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Message routes
  app.get("/api/conversations/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    
    try {
      // Verify user is part of the conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const isMember = conversation.members.some(member => member.id === req.user.id);
      if (!isMember) {
        return res.status(403).json({ error: "Not authorized to view these messages" });
      }
      
      const messages = await storage.getMessagesForConversation(conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation ID" });
    }
    
    try {
      // Verify user is part of the conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const isMember = conversation.members.some(member => member.id === req.user.id);
      if (!isMember) {
        return res.status(403).json({ error: "Not authorized to send messages to this conversation" });
      }
      
      const messageData = insertMessageSchema.parse({
        conversationId,
        senderId: req.user.id,
        content: req.body.content,
        attachments: req.body.attachments || [],
      });
      
      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // File upload route
  app.post("/api/upload", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files were uploaded" });
    }
    
    try {
      // Handle single file or multiple files
      const files = req.files.file ? 
        Array.isArray(req.files.file) ? req.files.file : [req.files.file] : 
        [];
      
      const uploadedFiles = [];
      
      for (const file of files) {
        const timestamp = Date.now();
        const uniqueFilename = `${req.user.id}_${timestamp}_${file.name}`;
        const uploadPath = `uploads/${uniqueFilename}`;
        
        // Move the file
        await file.mv(uploadPath);
        
        // Return the file details
        uploadedFiles.push({
          name: file.name,
          type: file.mimetype,
          size: file.size,
          url: `/uploads/${uniqueFilename}`
        });
      }
      
      res.json(uploadedFiles);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  // Users route for searching/adding to conversations
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const users = await storage.getAllUsers();
      // Filter out password and sensitive data
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  app.get("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Filter out password and sensitive data
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  
  // User settings endpoint
  app.patch("/api/user/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const settings = req.body;
      const userId = req.user?.id;
      const user = await storage.updateUserSettings(userId, settings);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user settings:", error);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  });
  
  // User profile update endpoint
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { displayName, avatar, bio, pronouns, backgroundImage } = req.body;
      const userId = req.user?.id;
      const user = await storage.updateUserProfile(userId, { 
        displayName,
        avatar,
        bio,
        pronouns,
        backgroundImage
      });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user profile:", error);
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });
  
  // Clear all messages in a conversation
  app.delete("/api/conversations/:conversationId/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const conversationId = parseInt(req.params.conversationId);
      const userId = req.user?.id;
      
      // Check if user is a member of this conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const isMember = conversation.members.some(member => member.id === userId);
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this conversation" });
      }
      
      // Call storage method to clear messages
      const result = await storage.clearMessagesInConversation(conversationId);
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error clearing chat messages:", error);
      return res.status(500).json({ error: "Failed to clear messages" });
    }
  });
  
  // Leave/Close a conversation
  app.delete("/api/conversations/:conversationId/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const conversationId = parseInt(req.params.conversationId);
      const userId = req.user?.id;
      
      // Check if user is a member of this conversation
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const isMember = conversation.members.some(member => member.id === userId);
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this conversation" });
      }
      
      // Remove user from conversation
      await storage.removeUserFromConversation(conversationId, userId);
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error leaving conversation:", error);
      return res.status(500).json({ error: "Failed to leave conversation" });
    }
  });
  
  // Message edit endpoint
  app.patch("/api/messages/:messageId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const messageId = parseInt(req.params.messageId);
      const { content } = req.body;
      
      if (!content || content.trim() === "") {
        return res.status(400).json({ error: "Message content cannot be empty" });
      }
      
      const updatedMessage = await storage.updateMessage(messageId, content);
      
      if (!updatedMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      return res.json(updatedMessage);
    } catch (error) {
      console.error("Error updating message:", error);
      return res.status(500).json({ error: "Failed to update message" });
    }
  });
  
  // Message reaction endpoints
  app.post("/api/messages/:messageId/reactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const messageId = parseInt(req.params.messageId);
      const { emoji } = req.body;
      
      if (!emoji) {
        return res.status(400).json({ error: "Emoji is required" });
      }
      
      const reaction = {
        messageId,
        emoji,
        userId: req.user?.id
      };
      
      const updatedMessage = await storage.addReactionToMessage(messageId, reaction);
      
      if (!updatedMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      return res.json(updatedMessage);
    } catch (error) {
      console.error("Error adding reaction:", error);
      return res.status(500).json({ error: "Failed to add reaction" });
    }
  });
  
  app.delete("/api/messages/:messageId/reactions/:emoji", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const messageId = parseInt(req.params.messageId);
      const emoji = req.params.emoji;
      const userId = req.user?.id;
      
      const updatedMessage = await storage.removeReactionFromMessage(messageId, userId, emoji);
      
      if (!updatedMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      return res.json(updatedMessage);
    } catch (error) {
      console.error("Error removing reaction:", error);
      return res.status(500).json({ error: "Failed to remove reaction" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter out password
      const sanitizedUsers = allUsers.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Don't allow deleting the admin user
      if (userId === 1) {
        return res.status(403).json({ error: "Cannot delete the admin user" });
      }
      
      // Use the imported pool directly for direct SQL access
      const { pool } = await import("./db");
      
      // First delete any messages sent by this user
      await pool.query(`DELETE FROM messages WHERE sender_id = $1`, [userId]);
      
      // Delete conversation memberships
      await pool.query(`DELETE FROM conversation_members WHERE user_id = $1`, [userId]);
      
      // Delete conversations with no members
      await pool.query(`
        DELETE FROM conversations 
        WHERE id NOT IN (
          SELECT conversation_id 
          FROM conversation_members
        )`);
      
      // Finally delete the user
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
  
  // Ban a user
  app.post("/api/admin/users/:userId/ban", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { reason } = req.body;
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Don't allow banning the admin user
      if (userId === 1) {
        return res.status(403).json({ error: "Cannot ban the admin user" });
      }
      
      // Use the imported pool for direct SQL
      const { pool } = await import("./db");
      
      // Update the user's ban status
      await pool.query(
        `UPDATE users SET is_banned = TRUE, ban_reason = $1 WHERE id = $2`,
        [reason || "No reason provided", userId]
      );
      
      // Get the updated user to return
      const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      const user = result.rows[0];
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove the password from the response
      delete user.password;
      
      res.json(user);
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ error: "Failed to ban user" });
    }
  });
  
  // Unban a user
  app.post("/api/admin/users/:userId/unban", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Use the imported pool for direct SQL
      const { pool } = await import("./db");
      
      // Update the user's ban status
      await pool.query(
        `UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE id = $1`,
        [userId]
      );
      
      // Get the updated user to return
      const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      const user = result.rows[0];
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove the password from the response
      delete user.password;
      
      res.json(user);
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ error: "Failed to unban user" });
    }
  });

  app.post("/api/admin/reset-users", requireAdmin, async (req, res) => {
    try {
      // Use the imported pool directly for direct SQL access
      const { pool } = await import("./db");
      
      // Delete all messages first (to avoid foreign key constraints)
      await pool.query(`DELETE FROM messages WHERE sender_id != 1`);
      
      // Delete all conversation members except admin
      await pool.query(`DELETE FROM conversation_members WHERE user_id != 1`);
      
      // Delete conversations with no members
      await pool.query(`
        DELETE FROM conversations 
        WHERE id NOT IN (
          SELECT conversation_id 
          FROM conversation_members
        )`);
      
      // Finally, delete all users except admin (ID 1)
      await pool.query(`DELETE FROM users WHERE id != 1`);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting database:", error);
      res.status(500).json({ error: "Failed to reset database" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup Socket.io server
  setupSocketServer(httpServer, storage);

  return httpServer;
}
