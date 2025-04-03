import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { MessageWithSender, ConversationWithMembers, MessageReaction } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";
import { Loader2, File, Image, FileText, Download, ExternalLink, Smile, Edit, Check, X } from "lucide-react";
import { onNewMessage, onTyping, onMessageUpdated, onMessageReacted, addReaction, removeReaction, editMessage } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import Picker from "emoji-picker-react";

type ChatMessagesProps = {
  conversation: ConversationWithMembers;
};

// Define the attachment type and extend MessageWithSender
type Attachment = {
  name: string;
  type: string;
  url: string;
  size?: number;
};

// Extend the MessageWithSender type to include attachments and reactions
type ExtendedMessageWithSender = MessageWithSender & {
  attachments?: Attachment[];
  reactions?: MessageReaction[];
};

export function ChatMessages({ conversation }: ChatMessagesProps) {
  const { user: currentUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [typingUsers, setTypingUsers] = useState<Record<number, number>>({});
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  
  const { data: messages = [], isLoading } = useQuery<ExtendedMessageWithSender[]>({
    queryKey: [`/api/conversations/${conversation.id}/messages`],
  });
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Group messages by date for day separators
  const groupedMessages = groupMessagesByDate(messages);
  
  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onNewMessage((conversationId, message) => {
      if (conversationId === conversation.id) {
        // If we get a new message, remove typing indicator for that user
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[message.sender.id];
          return updated;
        });
        
        // Update the messages in the cache to avoid duplicates
        const queryKey = [`/api/conversations/${conversation.id}/messages`];
        
        queryClient.setQueryData(queryKey, (oldData: ExtendedMessageWithSender[] | undefined) => {
          // If no data yet, just add the new message
          if (!oldData) return [message as ExtendedMessageWithSender];
          
          // Check if the message already exists
          const messageExists = oldData.some(m => m.id === message.id);
          if (messageExists) return oldData;
          
          // Add new message
          return [...oldData, message as ExtendedMessageWithSender];
        });
      }
    });
    
    return unsubscribe;
  }, [conversation.id]);
  
  // Listen for typing notifications
  useEffect(() => {
    const unsubscribe = onTyping((conversationId, userId) => {
      if (conversationId === conversation.id && userId !== currentUser?.id) {
        // Add typing indicator with timestamp
        setTypingUsers(prev => ({
          ...prev,
          [userId]: Date.now()
        }));
        
        // Remove typing indicator after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const updated = { ...prev };
            if (updated[userId] && Date.now() - updated[userId] >= 3000) {
              delete updated[userId];
            }
            return updated;
          });
        }, 3000);
      }
    });
    
    return unsubscribe;
  }, [conversation.id, currentUser?.id]);
  
  // Listen for message updates
  useEffect(() => {
    const unsubscribe = onMessageUpdated((conversationId, updatedMessage) => {
      if (conversationId === conversation.id) {
        // Update the messages in the cache
        const queryKey = [`/api/conversations/${conversation.id}/messages`];
        
        queryClient.setQueryData(queryKey, (oldData: ExtendedMessageWithSender[] | undefined) => {
          if (!oldData) return [updatedMessage as ExtendedMessageWithSender];
          
          return oldData.map(message => 
            message.id === updatedMessage.id 
              ? { ...message, ...updatedMessage } as ExtendedMessageWithSender
              : message
          );
        });
        
        // If we were editing this message, exit edit mode
        if (editingMessageId === updatedMessage.id) {
          setEditingMessageId(null);
          setEditContent("");
        }
      }
    });
    
    return unsubscribe;
  }, [conversation.id, editingMessageId]);
  
  // Listen for message reactions
  useEffect(() => {
    const unsubscribe = onMessageReacted((conversationId, updatedMessage) => {
      if (conversationId === conversation.id) {
        // Update the messages in the cache
        const queryKey = [`/api/conversations/${conversation.id}/messages`];
        
        queryClient.setQueryData(queryKey, (oldData: ExtendedMessageWithSender[] | undefined) => {
          if (!oldData) return [updatedMessage as ExtendedMessageWithSender];
          
          return oldData.map(message => 
            message.id === updatedMessage.id 
              ? { ...message, ...updatedMessage } as ExtendedMessageWithSender
              : message
          );
        });
      }
    });
    
    return unsubscribe;
  }, [conversation.id]);
  
  // Get users who are currently typing
  const currentlyTypingUsers = Object.keys(typingUsers)
    .map(id => parseInt(id))
    .map(id => conversation.members.find(member => member.id === id))
    .filter(Boolean);
    
  // Edit message handler
  const handleEditMessage = (messageId: number, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };
  
  // Cancel edit handler
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };
  
  // Save edit handler
  const handleSaveEdit = () => {
    if (editingMessageId && editContent.trim()) {
      editMessage(editingMessageId, editContent.trim());
      setEditingMessageId(null);
      setEditContent("");
    }
  };
  
  // Add reaction handler
  const handleAddReaction = (messageId: number, emoji: string) => {
    addReaction(messageId, emoji);
  };
  
  // Remove reaction handler
  const handleRemoveReaction = (messageId: number, emoji: string) => {
    removeReaction(messageId, emoji);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p>No messages yet</p>
          <p className="text-sm mt-1">Be the first to send a message!</p>
        </div>
      ) : (
        <>
          {Object.entries(groupedMessages).map(([date, messagesForDate]) => (
            <div key={date}>
              {/* Day Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="border-t border-surface-light flex-1"></div>
                <span className="px-3 text-xs font-medium text-muted-foreground">
                  {formatDateHeading(date)}
                </span>
                <div className="border-t border-surface-light flex-1"></div>
              </div>

              {/* Messages for this date */}
              {messagesForDate.map((message, index) => {
                const isSentByMe = message.sender.id === currentUser?.id;
                
                // Only show avatar and name if different from previous message
                const showSenderInfo = index === 0 || 
                  messagesForDate[index - 1].sender.id !== message.sender.id;
                
                return (
                  <div 
                    key={message.id} 
                    className={cn(
                      "flex items-start mb-4 group",
                      isSentByMe && "flex-row-reverse"
                    )}
                  >
                    {/* Avatar (only show if needed) */}
                    {showSenderInfo ? (
                      <div 
                        className={cn(
                          "mt-1", 
                          isSentByMe ? "ml-2" : "mr-2"
                        )}
                      >
                        <AvatarWithStatus 
                          user={message.sender}
                          size="sm"
                          showStatus={false}
                        />
                      </div>
                    ) : (
                      <div className={cn("w-8", isSentByMe ? "ml-2" : "mr-2")} />
                    )}
                    
                    <div>
                      {/* Sender name and timestamp (only if needed) */}
                      {showSenderInfo && (
                        <div className={cn(
                          "flex items-end",
                          isSentByMe && "flex-row-reverse"
                        )}>
                          {!isSentByMe && (
                            <span 
                              className="font-medium text-sm mr-2"
                            >
                              {message.sender.displayName || message.sender.username}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt || Date.now()), "h:mm a")}
                          </span>
                        </div>
                      )}
                      
                      {/* Message bubble */}
                      <div>
                        <div 
                          className={cn(
                            "max-w-[80%] py-2 px-3 rounded-md mt-1",
                            isSentByMe 
                              ? "bg-primary text-primary-foreground rounded-br-sm ml-auto" 
                              : "bg-muted text-foreground rounded-bl-sm mr-auto"
                          )}
                        >
                          {/* Editing UI */}
                          {editingMessageId === message.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="bg-background text-foreground"
                                autoFocus
                              />
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={handleSaveEdit}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Text content */}
                              {message.content && (
                                <p className="whitespace-normal break-words">
                                  {renderMessageWithEmojisAndLinks(message.content)}
                                </p>
                              )}
                              
                              {/* Attachments - Type cast as ExtendedMessageWithSender */}
                              {(message as ExtendedMessageWithSender).attachments && 
                               (message as ExtendedMessageWithSender).attachments!.length > 0 && (
                                <div className={cn(
                                  "mt-2 space-y-2",
                                  message.content ? "pt-2 border-t border-surface-light" : ""
                                )}>
                                  {renderAttachments((message as ExtendedMessageWithSender).attachments!)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Message actions */}
                        {!editingMessageId && (
                          <div className={cn(
                            "flex items-center mt-1 space-x-1",
                            isSentByMe ? "justify-end" : "justify-start"
                          )}>
                            {/* Reactions */}
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex items-center bg-muted rounded-full py-0.5 px-2 text-xs">
                                {/* Group reactions by emoji */}
                                {Object.entries(
                                  message.reactions.reduce<Record<string, number>>((acc: Record<string, number>, reaction: MessageReaction) => {
                                    acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                                    return acc;
                                  }, {})
                                ).map(([emoji, count]) => {
                                  // Check if current user has reacted with this emoji
                                  const hasReacted = message.reactions?.some(
                                    (r: MessageReaction) => r.userId === currentUser?.id && r.emoji === emoji
                                  );
                                  
                                  return (
                                    <TooltipProvider key={`${message.id}-${emoji}`}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className={cn(
                                              "inline-flex items-center rounded-full px-1",
                                              hasReacted && "bg-primary/20"
                                            )}
                                            onClick={() => {
                                              if (hasReacted) {
                                                handleRemoveReaction(message.id, emoji);
                                              } else {
                                                handleAddReaction(message.id, emoji);
                                              }
                                            }}
                                          >
                                            <span className="mr-0.5">{emoji}</span>
                                            <span>{count.toString()}</span>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {message.reactions
                                            ?.filter((r: MessageReaction) => r.emoji === emoji)
                                            .map((r: MessageReaction) => {
                                              const user = conversation.members.find(m => m.id === r.userId);
                                              return user?.displayName || user?.username || 'Unknown';
                                            })
                                            .join(', ')}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })}
                              </div>
                            )}
                            
                            {/* Action buttons (edit & react) */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Edit button (only for own messages) */}
                              {isSentByMe && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleEditMessage(message.id, message.content || "")}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit message</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              
                              {/* Reaction button */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                  >
                                    <Smile className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="end">
                                  <div className="p-2">
                                    <Picker 
                                      onEmojiClick={(emojiData) => {
                                        handleAddReaction(message.id, emojiData.emoji);
                                      }}
                                      width="100%"
                                      height="300px"
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          
          {/* Typing indicators */}
          {currentlyTypingUsers.map(user => (
            <div key={`typing-${user!.id}`} className="flex items-start mb-4">
              <div className="mr-2 mt-1">
                <AvatarWithStatus 
                  user={user!}
                  size="sm"
                  showStatus={false}
                />
              </div>
              <div>
                <div className="flex items-end">
                  <span className="font-medium text-sm mr-2">
                    {user!.displayName || user!.username}
                  </span>
                </div>
                <div className="bg-muted text-foreground rounded-md rounded-bl-sm py-3 px-4 mt-1">
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "200ms" }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "400ms" }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
}

// Helper to group messages by date
function groupMessagesByDate(messages: ExtendedMessageWithSender[]) {
  const groups: Record<string, ExtendedMessageWithSender[]> = {};
  
  messages.forEach(message => {
    // Make sure createdAt is a valid date
    const createdAt = message.createdAt instanceof Date ? 
      message.createdAt : 
      new Date(message.createdAt || Date.now());
      
    const date = createdAt.toISOString().split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
  });
  
  return groups;
}

// Helper to format the date heading
function formatDateHeading(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateStr === today.toISOString().split('T')[0]) {
    return "TODAY";
  } else if (dateStr === yesterday.toISOString().split('T')[0]) {
    return "YESTERDAY";
  } else {
    return format(date, "MMMM d, yyyy");
  }
}

// Helper to render file attachments
function renderAttachments(attachments: Attachment[]) {
  return attachments.map((attachment, index) => {
    const isImage = attachment.type.startsWith('image/');
    
    // Format file size
    const formatFileSize = (bytes?: number) => {
      if (!bytes) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    
    // Get file icon based on type
    const getFileIcon = (fileType: string) => {
      if (fileType.startsWith('image/')) {
        return <Image className="h-4 w-4" />;
      } else if (fileType.startsWith('text/')) {
        return <FileText className="h-4 w-4" />;
      } else {
        return <File className="h-4 w-4" />;
      }
    };
    
    if (isImage) {
      // Render image preview
      return (
        <div key={`attachment-${index}`} className="relative">
          <a 
            href={attachment.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block"
          >
            <img 
              src={attachment.url} 
              alt={attachment.name}
              className="max-h-[200px] max-w-full rounded object-contain"
            />
          </a>
          <div className="text-xs mt-1 flex items-center gap-1 text-muted-foreground">
            {getFileIcon(attachment.type)}
            <span className="truncate">{attachment.name}</span>
            {attachment.size && <span>({formatFileSize(attachment.size)})</span>}
          </div>
        </div>
      );
    } else {
      // Render file link
      return (
        <div 
          key={`attachment-${index}`} 
          className="flex items-center gap-2 p-2 bg-surface rounded border border-surface-light"
        >
          {getFileIcon(attachment.type)}
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium text-sm">{attachment.name}</div>
            {attachment.size && (
              <div className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</div>
            )}
          </div>
          <a
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>
      );
    }
  });
}

// Helper to convert URLs to clickable links and preserve emojis
function renderMessageWithEmojisAndLinks(text: string) {
  if (!text) return null;
  
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Split the text by URLs
  const parts = text.split(urlRegex);
  
  // Find all URLs in the text
  const urls = text.match(urlRegex) || [];
  
  // Combine parts and URLs
  const result: React.ReactNode[] = [];
  
  parts.forEach((part, i) => {
    // Add the text part - preserve exactly as typed
    if (part) {
      // Keep original text as is, don't apply any transforms
      result.push(<span key={`text-${i}`}>{part}</span>);
    }
    
    // Add the URL part (if there is one at this position)
    if (urls[i - 1]) {
      result.push(
        <a 
          key={`url-${i-1}`}
          href={urls[i - 1]} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-500 hover:underline"
        >
          {urls[i - 1]}
        </a>
      );
    }
  });
  
  return result;
}
