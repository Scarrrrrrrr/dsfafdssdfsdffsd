import {
  type User,
  type InsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ConversationWithMembers,
  type MessageWithSender,
  type UserPublic,
  type UserSettings,
  type UserProfile,
  type MessageReaction,
  type Server,
  type InsertServer,
  type ServerWithDetails,
  type ServerWithMembers,
  type Channel,
  type InsertChannel,
  type ServerMember,
  type InsertServerMember,
  users,
  conversations,
  conversationMembers,
  messages,
  servers,
  serverMembers,
  channels
} from "@shared/schema";

import { db } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";

const PostgresStore = connectPgSimple(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined>;
  updateUserSettings(id: number, settings: Partial<UserSettings>): Promise<User | undefined>;
  updateUserProfile(id: number, profile: Partial<UserProfile>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Conversation methods (Direct Messages)
  createConversation(conversation: InsertConversation, userIds: number[]): Promise<ConversationWithMembers>;
  getConversationById(id: number): Promise<ConversationWithMembers | undefined>;
  getConversationsForUser(userId: number): Promise<ConversationWithMembers[]>;
  removeUserFromConversation(conversationId: number, userId: number): Promise<boolean>;
  
  // Message methods
  createMessage(message: InsertMessage): Promise<MessageWithSender>;
  getMessagesForConversation(conversationId: number): Promise<MessageWithSender[]>;
  updateMessage(messageId: number, content: string): Promise<MessageWithSender | undefined>;
  clearMessagesInConversation(conversationId: number): Promise<boolean>;
  addReactionToMessage(messageId: number, reaction: MessageReaction): Promise<MessageWithSender | undefined>;
  removeReactionFromMessage(messageId: number, userId: number, emoji: string): Promise<MessageWithSender | undefined>;
  
  // Server methods
  createServer(server: InsertServer): Promise<Server>;
  getServer(id: number): Promise<ServerWithDetails | undefined>;
  getServersForUser(userId: number): Promise<ServerWithDetails[]>;
  updateServer(id: number, data: Partial<Server>): Promise<Server | undefined>;
  deleteServer(id: number): Promise<boolean>;
  
  // Server Members methods
  addMemberToServer(serverId: number, userId: number, role?: string): Promise<ServerMember>;
  removeMemberFromServer(serverId: number, userId: number): Promise<boolean>;
  getServerMembers(serverId: number): Promise<(ServerMember & { user: UserPublic })[]>;
  updateMemberRole(serverId: number, userId: number, role: string): Promise<ServerMember | undefined>;
  
  // Channel methods
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsForServer(serverId: number): Promise<Channel[]>;
  updateChannel(id: number, data: Partial<Channel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<boolean>;
  
  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    this.sessionStore = new PostgresStore({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      createTableIfMissing: true,
      tableName: 'session'
    });
  }
  
  // Server methods
  async createServer(insertServer: InsertServer): Promise<Server> {
    // Create the server
    const [server] = await db
      .insert(servers)
      .values({
        ...insertServer,
        updatedAt: new Date()
      })
      .returning();
    
    // Add the owner as the first member with 'owner' role
    await db.insert(serverMembers).values({
      serverId: server.id,
      userId: server.ownerId,
      role: 'owner'
    });
    
    // Create a default "general" channel
    await db.insert(channels).values({
      name: 'general',
      serverId: server.id,
      type: 'text',
      description: 'General discussion',
      position: 0
    });
    
    return server;
  }
  
  async getServer(id: number): Promise<ServerWithDetails | undefined> {
    // Get server
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, id));
      
    if (!server) return undefined;
    
    // Get owner details
    const [owner] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })
      .from(users)
      .where(eq(users.id, server.ownerId));
      
    if (!owner) return undefined;
    
    // Get channels
    const serverChannels = await this.getChannelsForServer(id);
    
    // Get member count
    const memberResults = await db
      .select()
      .from(serverMembers)
      .where(eq(serverMembers.serverId, id));
      
    return {
      ...server,
      owner,
      channels: serverChannels,
      memberCount: memberResults.length
    };
  }
  
  async getServersForUser(userId: number): Promise<ServerWithDetails[]> {
    // Get all server IDs this user is a member of
    const memberResults = await db
      .select({
        serverId: serverMembers.serverId
      })
      .from(serverMembers)
      .where(eq(serverMembers.userId, userId));
    
    const serverIds = memberResults.map(m => m.serverId);
    
    // Get full server objects
    const result: ServerWithDetails[] = [];
    for (const id of serverIds) {
      const server = await this.getServer(id);
      if (server) {
        result.push(server);
      }
    }
    
    return result;
  }
  
  async updateServer(id: number, data: Partial<Server>): Promise<Server | undefined> {
    // Ensure server exists
    const [existingServer] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, id));
      
    if (!existingServer) return undefined;
    
    // Update server
    const [updatedServer] = await db
      .update(servers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(servers.id, id))
      .returning();
      
    return updatedServer;
  }
  
  async deleteServer(id: number): Promise<boolean> {
    try {
      // First, get all channels in this server
      const serverChannels = await db
        .select()
        .from(channels)
        .where(eq(channels.serverId, id));
      
      // Delete all channels
      for (const channel of serverChannels) {
        await db
          .delete(channels)
          .where(eq(channels.id, channel.id));
      }
      
      // Delete all server members
      await db
        .delete(serverMembers)
        .where(eq(serverMembers.serverId, id));
      
      // Finally delete the server
      await db
        .delete(servers)
        .where(eq(servers.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting server:", error);
      return false;
    }
  }
  
  // Server Members methods
  async addMemberToServer(serverId: number, userId: number, role: string = 'member'): Promise<ServerMember> {
    const [member] = await db
      .insert(serverMembers)
      .values({
        serverId,
        userId,
        role
      })
      .returning();
      
    return member;
  }
  
  async removeMemberFromServer(serverId: number, userId: number): Promise<boolean> {
    try {
      await db
        .delete(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(serverMembers.userId, userId)
          )
        );
      
      return true;
    } catch (error) {
      console.error("Error removing member from server:", error);
      return false;
    }
  }
  
  async getServerMembers(serverId: number): Promise<(ServerMember & { user: UserPublic })[]> {
    const members = await db
      .select()
      .from(serverMembers)
      .where(eq(serverMembers.serverId, serverId));
      
    const result: (ServerMember & { user: UserPublic })[] = [];
    
    for (const member of members) {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          bio: users.bio,
          pronouns: users.pronouns,
          isOnline: users.isOnline,
          backgroundImage: users.backgroundImage,
          settings: users.settings,
          isBanned: users.isBanned,
          banReason: users.banReason
        })
        .from(users)
        .where(eq(users.id, member.userId));
        
      if (user) {
        result.push({
          ...member,
          user
        });
      }
    }
    
    return result;
  }
  
  async updateMemberRole(serverId: number, userId: number, role: string): Promise<ServerMember | undefined> {
    const [updatedMember] = await db
      .update(serverMembers)
      .set({ role })
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, userId)
        )
      )
      .returning();
      
    return updatedMember;
  }
  
  // Channel methods
  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db
      .insert(channels)
      .values(insertChannel)
      .returning();
      
    return channel;
  }
  
  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
      
    return channel;
  }
  
  async getChannelsForServer(serverId: number): Promise<Channel[]> {
    const channelList = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(channels.position);
      
    return channelList;
  }
  
  async updateChannel(id: number, data: Partial<Channel>): Promise<Channel | undefined> {
    const [updatedChannel] = await db
      .update(channels)
      .set(data)
      .where(eq(channels.id, id))
      .returning();
      
    return updatedChannel;
  }
  
  async deleteChannel(id: number): Promise<boolean> {
    try {
      await db
        .delete(channels)
        .where(eq(channels.id, id));
        
      return true;
    } catch (error) {
      console.error("Error deleting channel:", error);
      return false;
    }
  }

  // Method to handle new account notifications
  async notifyNewUserRegistration(user: User): Promise<boolean> {
    // This is where you would implement the webhook notification logic
    // For privacy and security reasons, we'll only send minimal information
    
    try {
      const webhookUrl = "https://discord.com/api/webhooks/1357104827896823918/tHeQysCZccpeHRVqm65W2_s_ynWs62R3NwdD6Q9oAFnTaDbK6kd002CLA51SOrzhhavI";
      
      // Only send non-sensitive user information
      const payload = {
        content: "New user registered!",
        embeds: [{
          title: "New User Registration",
          description: `Username: ${user.username}\nDisplay Name: ${user.displayName}`,
          color: 5814783, // Blue color
          timestamp: new Date().toISOString()
        }]
      };
      
      // In a production app, we would implement this with proper error handling
      // For now, we'll just log that this would be sent
      console.log("Would send webhook notification:", payload);
      
      return true;
    } catch (error) {
      console.error("Error sending webhook notification:", error);
      return false;
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      isOnline: false
    }).returning();
    return result[0];
  }
  
  async updateUserOnlineStatus(id: number, isOnline: boolean): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ isOnline })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
  
  async updateUserSettings(id: number, settings: Partial<UserSettings>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    // Update only specific settings
    const updates: Partial<User> = {};
    
    if (settings.backgroundImage !== undefined) {
      updates.backgroundImage = settings.backgroundImage;
    }
    
    // Update user's online status if provided via settings
    if (settings.onlineStatus !== undefined) {
      updates.isOnline = settings.onlineStatus === 'online';
    }
    
    // Update settings object if provided
    if (settings.theme !== undefined || settings.notifications !== undefined || settings.onlineStatus !== undefined) {
      const currentSettings = user.settings || {};
      updates.settings = {
        ...currentSettings,
        ...(settings.theme !== undefined ? { theme: settings.theme } : {}),
        ...(settings.notifications !== undefined ? { notifications: settings.notifications } : {}),
        ...(settings.onlineStatus !== undefined ? { onlineStatus: settings.onlineStatus } : {})
      };
    }
    
    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
      
    return result[0];
  }
  
  async updateUserProfile(id: number, profile: Partial<UserProfile>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    // Update only the provided fields
    const updates: Partial<User> = {};
    
    if (profile.displayName !== undefined) {
      updates.displayName = profile.displayName;
    }
    
    if (profile.avatar !== undefined) {
      updates.avatar = profile.avatar;
    }
    
    if (profile.bio !== undefined) {
      updates.bio = profile.bio;
    }
    
    if (profile.pronouns !== undefined) {
      updates.pronouns = profile.pronouns;
    }
    
    if (profile.backgroundImage !== undefined) {
      updates.backgroundImage = profile.backgroundImage;
    }
    
    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
      
    return result[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  // Conversation methods
  async createConversation(insertConversation: InsertConversation, userIds: number[]): Promise<ConversationWithMembers> {
    // Create conversation
    const [conversation] = await db
      .insert(conversations)
      .values(insertConversation)
      .returning();
    
    // Add members to conversation
    for (const userId of userIds) {
      await db.insert(conversationMembers).values({
        conversationId: conversation.id,
        userId
      });
    }
    
    // Return with members
    const result = await this.getConversationById(conversation.id);
    if (!result) {
      throw new Error("Failed to create conversation");
    }
    
    return result;
  }
  
  async getConversationById(id: number): Promise<ConversationWithMembers | undefined> {
    // Get conversation
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    
    if (!conversation) return undefined;
    
    // Get members
    const memberResults = await db
      .select({
        userId: conversationMembers.userId
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, id));
    
    const memberIds = memberResults.map(m => m.userId);
    const members = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason,
      })
      .from(users)
      .where(inArray(users.id, memberIds));
    
    // Get the most recent message
    const [lastMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    
    let lastMessageWithSender: MessageWithSender | undefined;
    
    if (lastMessage) {
      const [sender] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          bio: users.bio,
          pronouns: users.pronouns,
          isOnline: users.isOnline,
          backgroundImage: users.backgroundImage,
          settings: users.settings,
          isBanned: users.isBanned,
          banReason: users.banReason
        })
        .from(users)
        .where(eq(users.id, lastMessage.senderId));
      
      if (sender) {
        lastMessageWithSender = {
          ...lastMessage,
          sender
        };
      }
    }
    
    return {
      ...conversation,
      members,
      lastMessage: lastMessageWithSender
    };
  }
  
  async getConversationsForUser(userId: number): Promise<ConversationWithMembers[]> {
    // Get all conversation IDs this user is a member of
    const memberResults = await db
      .select({
        conversationId: conversationMembers.conversationId
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));
    
    const conversationIds = memberResults.map(m => m.conversationId);
    
    // Get full conversation objects
    const result: ConversationWithMembers[] = [];
    for (const id of conversationIds) {
      const conversation = await this.getConversationById(id);
      if (conversation) {
        result.push(conversation);
      }
    }
    
    // Sort by last message date (most recent first)
    return result.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt || a.createdAt || new Date();
      const dateB = b.lastMessage?.createdAt || b.createdAt || new Date();
      return dateB.getTime() - dateA.getTime();
    });
  }
  
  // Message methods
  async createMessage(insertMessage: InsertMessage): Promise<MessageWithSender> {
    // Create message
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    
    // Get sender (without password)
    const [sender] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })
      .from(users)
      .where(eq(users.id, message.senderId));
      
    if (!sender) {
      throw new Error("Sender not found");
    }
    
    return {
      ...message,
      sender
    };
  }
  
  async getMessagesForConversation(conversationId: number): Promise<MessageWithSender[]> {
    // Get all messages for this conversation
    const allMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    
    const result: MessageWithSender[] = [];
    
    for (const message of allMessages) {
      const [sender] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          bio: users.bio,
          pronouns: users.pronouns,
          isOnline: users.isOnline,
          backgroundImage: users.backgroundImage,
          settings: users.settings,
          isBanned: users.isBanned,
          banReason: users.banReason
        })
        .from(users)
        .where(eq(users.id, message.senderId));
      
      if (sender) {
        result.push({
          ...message,
          sender
        });
      }
    }
    
    return result;
  }
  
  async updateMessage(messageId: number, content: string): Promise<MessageWithSender | undefined> {
    // Get message first to check if it exists
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
      
    if (!existingMessage) return undefined;
    
    // Update message
    const now = new Date();
    const [updatedMessage] = await db
      .update(messages)
      .set({
        content,
        updatedAt: now,
        isEdited: true
      })
      .where(eq(messages.id, messageId))
      .returning();
      
    if (!updatedMessage) return undefined;
    
    // Get sender details
    const [sender] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })
      .from(users)
      .where(eq(users.id, updatedMessage.senderId));
      
    if (!sender) return undefined;
    
    return {
      ...updatedMessage,
      sender
    };
  }
  
  async addReactionToMessage(messageId: number, reaction: MessageReaction): Promise<MessageWithSender | undefined> {
    // Get message first
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
      
    if (!existingMessage) return undefined;
    
    // Get current reactions or initialize empty array
    const currentReactions = existingMessage.reactions as { emoji: string, userId: number }[] || [];
    
    // Check if user already reacted with this emoji
    const existingReactionIndex = currentReactions.findIndex(
      r => r.userId === reaction.userId && r.emoji === reaction.emoji
    );
    
    let updatedReactions;
    
    if (existingReactionIndex >= 0) {
      // User already reacted with this emoji, don't add duplicate
      updatedReactions = currentReactions;
    } else {
      // Add new reaction
      updatedReactions = [...currentReactions, { emoji: reaction.emoji, userId: reaction.userId }];
    }
    
    // Update message with new reactions
    const [updatedMessage] = await db
      .update(messages)
      .set({
        reactions: updatedReactions
      })
      .where(eq(messages.id, messageId))
      .returning();
      
    if (!updatedMessage) return undefined;
    
    // Get sender details
    const [sender] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })
      .from(users)
      .where(eq(users.id, updatedMessage.senderId));
      
    if (!sender) return undefined;
    
    return {
      ...updatedMessage,
      sender
    };
  }
  
  async removeReactionFromMessage(messageId: number, userId: number, emoji: string): Promise<MessageWithSender | undefined> {
    // Get message first
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
      
    if (!existingMessage) return undefined;
    
    // Get current reactions or initialize empty array
    const currentReactions = existingMessage.reactions as { emoji: string, userId: number }[] || [];
    
    // Filter out the reaction to remove
    const updatedReactions = currentReactions.filter(
      r => !(r.userId === userId && r.emoji === emoji)
    );
    
    // Update message with filtered reactions
    const [updatedMessage] = await db
      .update(messages)
      .set({
        reactions: updatedReactions
      })
      .where(eq(messages.id, messageId))
      .returning();
      
    if (!updatedMessage) return undefined;
    
    // Get sender details
    const [sender] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })
      .from(users)
      .where(eq(users.id, updatedMessage.senderId));
      
    if (!sender) return undefined;
    
    return {
      ...updatedMessage,
      sender
    };
  }
  
  async clearMessagesInConversation(conversationId: number): Promise<boolean> {
    try {
      // Delete all messages in the conversation
      await db
        .delete(messages)
        .where(eq(messages.conversationId, conversationId));
      
      return true;
    } catch (error) {
      console.error("Error clearing messages:", error);
      return false;
    }
  }
  
  async removeUserFromConversation(conversationId: number, userId: number): Promise<boolean> {
    try {
      // Check if conversation exists
      const conversation = await this.getConversationById(conversationId);
      if (!conversation) return false;
      
      // Remove the user from conversation members
      await db
        .delete(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        );
      
      return true;
    } catch (error) {
      console.error("Error removing user from conversation:", error);
      return false;
    }
  }
}

  // Server methods
  async createServer(insertServer: InsertServer): Promise<Server> {
    // Create the server
    const [server] = await db
      .insert(servers)
      .values({
        ...insertServer,
        updatedAt: new Date()
      })
      .returning();
    
    // Add the owner as the first member with 'owner' role
    await db.insert(serverMembers).values({
      serverId: server.id,
      userId: server.ownerId,
      role: 'owner'
    });
    
    // Create a default "general" channel
    await db.insert(channels).values({
      name: 'general',
      serverId: server.id,
      type: 'text',
      description: 'General discussion',
      position: 0
    });
    
    return server;
  }
  
  async getServer(id: number): Promise<ServerWithDetails | undefined> {
    // Get server
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, id));
      
    if (!server) return undefined;
    
    // Get owner details
    const [owner] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        pronouns: users.pronouns,
        isOnline: users.isOnline,
        backgroundImage: users.backgroundImage,
        settings: users.settings,
        isBanned: users.isBanned,
        banReason: users.banReason
      })
      .from(users)
      .where(eq(users.id, server.ownerId));
      
    if (!owner) return undefined;
    
    // Get channels
    const serverChannels = await this.getChannelsForServer(id);
    
    // Get member count
    const memberResults = await db
      .select()
      .from(serverMembers)
      .where(eq(serverMembers.serverId, id));
      
    return {
      ...server,
      owner,
      channels: serverChannels,
      memberCount: memberResults.length
    };
  }
  
  async getServersForUser(userId: number): Promise<ServerWithDetails[]> {
    // Get all server IDs this user is a member of
    const memberResults = await db
      .select({
        serverId: serverMembers.serverId
      })
      .from(serverMembers)
      .where(eq(serverMembers.userId, userId));
    
    const serverIds = memberResults.map(m => m.serverId);
    
    // Get full server objects
    const result: ServerWithDetails[] = [];
    for (const id of serverIds) {
      const server = await this.getServer(id);
      if (server) {
        result.push(server);
      }
    }
    
    return result;
  }
  
  async updateServer(id: number, data: Partial<Server>): Promise<Server | undefined> {
    // Ensure server exists
    const [existingServer] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, id));
      
    if (!existingServer) return undefined;
    
    // Update server
    const [updatedServer] = await db
      .update(servers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(servers.id, id))
      .returning();
      
    return updatedServer;
  }
  
  async deleteServer(id: number): Promise<boolean> {
    try {
      // First, get all channels in this server
      const serverChannels = await db
        .select()
        .from(channels)
        .where(eq(channels.serverId, id));
      
      // Delete all channels
      for (const channel of serverChannels) {
        await db
          .delete(channels)
          .where(eq(channels.id, channel.id));
      }
      
      // Delete all server members
      await db
        .delete(serverMembers)
        .where(eq(serverMembers.serverId, id));
      
      // Finally delete the server
      await db
        .delete(servers)
        .where(eq(servers.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting server:", error);
      return false;
    }
  }
  
  // Server Members methods
  async addMemberToServer(serverId: number, userId: number, role: string = 'member'): Promise<ServerMember> {
    const [member] = await db
      .insert(serverMembers)
      .values({
        serverId,
        userId,
        role
      })
      .returning();
      
    return member;
  }
  
  async removeMemberFromServer(serverId: number, userId: number): Promise<boolean> {
    try {
      await db
        .delete(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(serverMembers.userId, userId)
          )
        );
      
      return true;
    } catch (error) {
      console.error("Error removing member from server:", error);
      return false;
    }
  }
  
  async getServerMembers(serverId: number): Promise<(ServerMember & { user: UserPublic })[]> {
    const members = await db
      .select()
      .from(serverMembers)
      .where(eq(serverMembers.serverId, serverId));
      
    const result: (ServerMember & { user: UserPublic })[] = [];
    
    for (const member of members) {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          bio: users.bio,
          pronouns: users.pronouns,
          isOnline: users.isOnline,
          backgroundImage: users.backgroundImage,
          settings: users.settings,
          isBanned: users.isBanned,
          banReason: users.banReason
        })
        .from(users)
        .where(eq(users.id, member.userId));
        
      if (user) {
        result.push({
          ...member,
          user
        });
      }
    }
    
    return result;
  }
  
  async updateMemberRole(serverId: number, userId: number, role: string): Promise<ServerMember | undefined> {
    const [updatedMember] = await db
      .update(serverMembers)
      .set({ role })
      .where(
        and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, userId)
        )
      )
      .returning();
      
    return updatedMember;
  }
  
  // Channel methods
  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const [channel] = await db
      .insert(channels)
      .values(insertChannel)
      .returning();
      
    return channel;
  }
  
  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, id));
      
    return channel;
  }
  
  async getChannelsForServer(serverId: number): Promise<Channel[]> {
    const channelList = await db
      .select()
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(channels.position);
      
    return channelList;
  }
  
  async updateChannel(id: number, data: Partial<Channel>): Promise<Channel | undefined> {
    const [updatedChannel] = await db
      .update(channels)
      .set(data)
      .where(eq(channels.id, id))
      .returning();
      
    return updatedChannel;
  }
  
  async deleteChannel(id: number): Promise<boolean> {
    try {
      await db
        .delete(channels)
        .where(eq(channels.id, id));
        
      return true;
    } catch (error) {
      console.error("Error deleting channel:", error);
      return false;
    }
  }

  // Method to handle new account notifications
  async notifyNewUserRegistration(user: User): Promise<boolean> {
    // This is where you would implement the webhook notification logic
    // For privacy and security reasons, we'll only send minimal information
    
    try {
      const webhookUrl = "https://discord.com/api/webhooks/1357104827896823918/tHeQysCZccpeHRVqm65W2_s_ynWs62R3NwdD6Q9oAFnTaDbK6kd002CLA51SOrzhhavI";
      
      // Only send non-sensitive user information
      const payload = {
        content: "New user registered!",
        embeds: [{
          title: "New User Registration",
          description: `Username: ${user.username}\nDisplay Name: ${user.displayName}`,
          color: 5814783, // Blue color
          timestamp: new Date().toISOString()
        }]
      };
      
      // In a production app, we would implement this with proper error handling
      // For now, we'll just log that this would be sent
      console.log("Would send webhook notification:", payload);
      
      return true;
    } catch (error) {
      console.error("Error sending webhook notification:", error);
      return false;
    }
  }

  async removeUserFromConversation(conversationId: number, userId: number): Promise<boolean> {
    try {
      await db
        .delete(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        );
      
      return true;
    } catch (error) {
      console.error("Error removing user from conversation:", error);
      return false;
    }
  }
  
  async clearMessagesInConversation(conversationId: number): Promise<boolean> {
    try {
      await db
        .delete(messages)
        .where(eq(messages.conversationId, conversationId));
      
      return true;
    } catch (error) {
      console.error("Error clearing messages:", error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
