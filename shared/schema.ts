import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  pronouns: text("pronouns"),
  isOnline: boolean("is_online").default(false),
  // New field for user background image
  backgroundImage: text("background_image"),
  // User settings as JSON
  settings: jsonb("settings"),
  // Ban status
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  displayName: true,
  avatar: true,
  bio: true,
  pronouns: true,
}).extend({
  backgroundImage: z.string().optional(),
  settings: z.object({
    theme: z.string().optional(),
    notifications: z.boolean().optional(),
  }).optional(),
});

// New server tables
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  description: text("description"),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertServerSchema = createInsertSchema(servers).pick({
  name: true,
  icon: true,
  description: true,
  ownerId: true,
});

export const serverMembers = pgTable("server_members", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => servers.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertServerMemberSchema = createInsertSchema(serverMembers).pick({
  serverId: true,
  userId: true,
  role: true,
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("text"), // text, voice, announcement
  description: text("description"),
  serverId: integer("server_id").notNull().references(() => servers.id),
  position: integer("position").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  webhook: text("webhook"),
});

export const insertChannelSchema = createInsertSchema(channels).pick({
  name: true,
  type: true,
  description: true,
  serverId: true,
  position: true,
  webhook: true,
});

// Original conversations table for direct messages
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  name: text("name"),
  isGroup: boolean("is_group").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  name: true,
  isGroup: true,
});

export const conversationMembers = pgTable("conversation_members", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  userId: integer("user_id").notNull().references(() => users.id),
});

export const insertConversationMemberSchema = createInsertSchema(conversationMembers).pick({
  conversationId: true,
  userId: true,
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  isEdited: boolean("is_edited").default(false),
  attachments: jsonb("attachments"),
  reactions: jsonb("reactions"),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  senderId: true,
  content: true,
}).extend({
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    url: z.string(),
    size: z.number().optional(),
  })).optional(),
  reactions: z.array(z.object({
    emoji: z.string(),
    userId: z.number(),
  })).optional(),
});

// Message reaction schema
export const messageReactionSchema = z.object({
  messageId: z.number(),
  emoji: z.string(),
  userId: z.number(),
});

// Message edit schema
export const messageEditSchema = z.object({
  messageId: z.number(),
  content: z.string(),
});

// User settings schema for updates
export const userSettingsSchema = z.object({
  backgroundImage: z.string().optional(),
  theme: z.string().optional(),
  notifications: z.boolean().optional(),
  onlineStatus: z.enum(["online", "idle", "offline"]).optional(),
});

// User profile schema for updates
export const userProfileSchema = z.object({
  displayName: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  pronouns: z.string().optional(),
  backgroundImage: z.string().optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserSettings = z.infer<typeof userSettingsSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;

// Server types
export type Server = typeof servers.$inferSelect;
export type InsertServer = z.infer<typeof insertServerSchema>;

export type ServerMember = typeof serverMembers.$inferSelect;
export type InsertServerMember = z.infer<typeof insertServerMemberSchema>;

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

// Original conversation types
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type ConversationMember = typeof conversationMembers.$inferSelect;
export type InsertConversationMember = z.infer<typeof insertConversationMemberSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MessageReaction = z.infer<typeof messageReactionSchema>;
export type MessageEdit = z.infer<typeof messageEditSchema>;

// User type without password
export type UserPublic = Omit<User, 'password'>;

// Extended types for frontend use
export type ConversationWithMembers = Conversation & {
  members: UserPublic[];
  lastMessage?: MessageWithSender;
};

export type MessageWithSender = Message & {
  sender: UserPublic;
};

// Extended server types
export type ServerWithDetails = Server & {
  owner: UserPublic;
  memberCount: number;
  channels: Channel[];
};

export type ServerWithMembers = Server & {
  members: (ServerMember & { user: UserPublic })[];
  channels: Channel[];
};
