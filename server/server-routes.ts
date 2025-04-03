import express, { type Request, type Response } from 'express';
import { storage } from './storage';
import { insertServerSchema, insertChannelSchema } from '@shared/schema';
import { z } from 'zod';

export function registerServerRoutes(app: express.Express) {
  // Get servers for current user
  app.get('/api/servers', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
      const servers = await storage.getServersForUser(req.user.id);
      res.json(servers);
    } catch (error) {
      console.error('Error fetching servers:', error);
      res.status(500).json({ error: 'Failed to fetch servers' });
    }
  });

  // Create a new server
  app.post('/api/servers', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const validatedData = insertServerSchema.safeParse(req.body);
    if (!validatedData.success) {
      return res.status(400).json({ error: 'Invalid server data', details: validatedData.error });
    }

    try {
      const newServer = await storage.createServer({
        ...validatedData.data,
        ownerId: req.user.id
      });
      
      res.status(201).json(newServer);
    } catch (error) {
      console.error('Error creating server:', error);
      res.status(500).json({ error: 'Failed to create server' });
    }
  });

  // Get a specific server
  app.get('/api/servers/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Check if user is a member of this server
      const serverMembers = await storage.getServerMembers(serverId);
      const isMember = serverMembers.some(member => member.user.id === req.user.id);
      
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this server' });
      }
      
      res.json(server);
    } catch (error) {
      console.error('Error fetching server:', error);
      res.status(500).json({ error: 'Failed to fetch server' });
    }
  });

  // Update a server
  app.patch('/api/servers/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if user is the owner
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      if (server.owner.id !== req.user.id) {
        return res.status(403).json({ error: 'Only the server owner can update server settings' });
      }
      
      // Validate update data
      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        icon: z.string().optional(),
        description: z.string().optional()
      });
      
      const validatedData = updateSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({ error: 'Invalid update data', details: validatedData.error });
      }
      
      const updatedServer = await storage.updateServer(serverId, validatedData.data);
      res.json(updatedServer);
    } catch (error) {
      console.error('Error updating server:', error);
      res.status(500).json({ error: 'Failed to update server' });
    }
  });

  // Delete a server
  app.delete('/api/servers/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if user is the owner
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      if (server.owner.id !== req.user.id) {
        return res.status(403).json({ error: 'Only the server owner can delete the server' });
      }
      
      const success = await storage.deleteServer(serverId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to delete server' });
      }
    } catch (error) {
      console.error('Error deleting server:', error);
      res.status(500).json({ error: 'Failed to delete server' });
    }
  });

  // Get server members
  app.get('/api/servers/:id/members', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if user is a member of this server
      const serverMembers = await storage.getServerMembers(serverId);
      const isMember = serverMembers.some(member => member.user.id === req.user.id);
      
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this server' });
      }
      
      res.json(serverMembers);
    } catch (error) {
      console.error('Error fetching server members:', error);
      res.status(500).json({ error: 'Failed to fetch server members' });
    }
  });

  // Add a member to server (join server)
  app.post('/api/servers/:id/members', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if server exists
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Check if user is already a member
      const serverMembers = await storage.getServerMembers(serverId);
      const isAlreadyMember = serverMembers.some(member => member.user.id === req.user.id);
      
      if (isAlreadyMember) {
        return res.status(400).json({ error: 'You are already a member of this server' });
      }
      
      // Add the user to the server
      const member = await storage.addMemberToServer(serverId, req.user.id);
      res.status(201).json(member);
    } catch (error) {
      console.error('Error joining server:', error);
      res.status(500).json({ error: 'Failed to join server' });
    }
  });

  // Leave server
  app.delete('/api/servers/:id/members/me', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if server exists
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Check if user is the owner
      if (server.owner.id === req.user.id) {
        return res.status(400).json({ 
          error: 'The server owner cannot leave. Transfer ownership or delete the server instead.' 
        });
      }
      
      // Remove the user from the server
      const success = await storage.removeMemberFromServer(serverId, req.user.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to leave server' });
      }
    } catch (error) {
      console.error('Error leaving server:', error);
      res.status(500).json({ error: 'Failed to leave server' });
    }
  });

  // Create a channel in a server
  app.post('/api/servers/:id/channels', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if server exists and user is a member with appropriate permissions
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // For now, only server owner can create channels
      if (server.owner.id !== req.user.id) {
        return res.status(403).json({ error: 'Only the server owner can create channels' });
      }
      
      // Validate channel data
      const validatedData = insertChannelSchema.safeParse({
        ...req.body,
        serverId
      });
      
      if (!validatedData.success) {
        return res.status(400).json({ error: 'Invalid channel data', details: validatedData.error });
      }
      
      const newChannel = await storage.createChannel(validatedData.data);
      res.status(201).json(newChannel);
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  });

  // Get all channels in a server
  app.get('/api/servers/:id/channels', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const serverId = parseInt(req.params.id);
    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }
    
    try {
      // Check if server exists and user is a member
      const serverMembers = await storage.getServerMembers(serverId);
      const isMember = serverMembers.some(member => member.user.id === req.user.id);
      
      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this server' });
      }
      
      const channels = await storage.getChannelsForServer(serverId);
      res.json(channels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  // Update a channel
  app.patch('/api/channels/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }
    
    try {
      // Get the channel to check permissions
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      
      // Get the server to check if user is the owner
      const server = await storage.getServer(channel.serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Only server owner can update channels
      if (server.owner.id !== req.user.id) {
        return res.status(403).json({ error: 'Only the server owner can update channels' });
      }
      
      // Validate update data
      const updateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        position: z.number().optional(),
        type: z.enum(['text', 'voice', 'announcement']).optional(),
        webhook: z.string().optional()
      });
      
      const validatedData = updateSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({ error: 'Invalid update data', details: validatedData.error });
      }
      
      const updatedChannel = await storage.updateChannel(channelId, validatedData.data);
      res.json(updatedChannel);
    } catch (error) {
      console.error('Error updating channel:', error);
      res.status(500).json({ error: 'Failed to update channel' });
    }
  });

  // Delete a channel
  app.delete('/api/channels/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
    
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }
    
    try {
      // Get the channel to check permissions
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      
      // Get the server to check if user is the owner
      const server = await storage.getServer(channel.serverId);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // Only server owner can delete channels
      if (server.owner.id !== req.user.id) {
        return res.status(403).json({ error: 'Only the server owner can delete channels' });
      }
      
      // Don't allow deleting the last channel
      const channels = await storage.getChannelsForServer(channel.serverId);
      if (channels.length <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last channel in a server' });
      }
      
      const success = await storage.deleteChannel(channelId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to delete channel' });
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      res.status(500).json({ error: 'Failed to delete channel' });
    }
  });
}