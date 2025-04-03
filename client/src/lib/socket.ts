import { MessageWithSender, MessageReaction } from "@shared/schema";

type MessageCallback = (conversationId: number, message: MessageWithSender) => void;
type TypingCallback = (conversationId: number, userId: number) => void;
type StatusCallback = (userId: number, isOnline: boolean) => void;
type MessageUpdatedCallback = (conversationId: number, message: MessageWithSender) => void;
type MessageReactedCallback = (conversationId: number, message: MessageWithSender) => void;

let socket: WebSocket | null = null;
let messageCallbacks: MessageCallback[] = [];
let typingCallbacks: TypingCallback[] = [];
let statusCallbacks: StatusCallback[] = [];
let messageUpdatedCallbacks: MessageUpdatedCallback[] = [];
let messageReactedCallbacks: MessageReactedCallback[] = [];
let socketReconnectTimer: NodeJS.Timeout | null = null;
let currentUserId: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;

// Function to reconnect the socket
function reconnectSocket() {
  if (socketReconnectTimer || !currentUserId) return;
  
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    console.log(`Scheduling socket reconnection (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    socketReconnectTimer = setTimeout(() => {
      console.log("Attempting to reconnect WebSocket...");
      connectSocket(currentUserId!);
      reconnectAttempts++;
      socketReconnectTimer = null;
    }, RECONNECT_DELAY_MS);
  } else {
    console.error("Reached maximum reconnection attempts. Please reload the page.");
  }
}

export function connectSocket(userId: number) {
  currentUserId = userId;
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    // If we're already connected, just authenticate
    sendAuthMessage(userId);
    processMessageQueue(); // Process any pending messages
    return;
  }
  
  // Close any existing socket
  if (socket) {
    socket.close();
  }
  
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log("WebSocket connection established");
    reconnectAttempts = 0; // Reset reconnection counter on successful connection
    sendAuthMessage(userId);
    
    // Process any queued messages
    processMessageQueue();
    
    // Clear any reconnect timers
    if (socketReconnectTimer) {
      clearTimeout(socketReconnectTimer);
      socketReconnectTimer = null;
    }
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'new_message':
          messageCallbacks.forEach(cb => cb(data.conversationId, data.message));
          break;
          
        case 'typing':
          typingCallbacks.forEach(cb => cb(data.conversationId, data.userId));
          break;
          
        case 'user_status':
          statusCallbacks.forEach(cb => cb(data.userId, data.isOnline));
          break;
          
        case 'message_updated':
          messageUpdatedCallbacks.forEach(cb => cb(data.conversationId, data.message));
          break;
          
        case 'message_reacted':
        case 'message_reaction_removed':
          messageReactedCallbacks.forEach(cb => cb(data.conversationId, data.message));
          break;
      }
    } catch (error) {
      console.error("Error processing websocket message:", error);
    }
  };
  
  socket.onclose = () => {
    console.log("WebSocket connection closed");
    
    // Attempt to reconnect using our reconnection strategy
    reconnectSocket();
  };
  
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
  
  // Clear any reconnect timers
  if (socketReconnectTimer) {
    clearTimeout(socketReconnectTimer);
    socketReconnectTimer = null;
  }
}

function sendAuthMessage(userId: number) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'authenticate',
      message: userId
    }));
  }
}

// Queue for messages to be sent when connection is restablished
type QueuedMessage = 
  | { type: 'message', conversationId: number, message: string, attachments?: Array<{name: string, type: string, url: string, size?: number}> }
  | { type: 'edit_message', messageId: number, content: string }
  | { type: 'add_reaction', messageId: number, emoji: string }
  | { type: 'remove_reaction', messageId: number, emoji: string }
  | { type: 'typing', conversationId: number };

const messageQueue: QueuedMessage[] = [];

// Process queue when connection is established
function processMessageQueue() {
  if (socket && socket.readyState === WebSocket.OPEN && messageQueue.length > 0) {
    console.log(`Processing queued messages: ${messageQueue.length}`);
    
    while (messageQueue.length > 0) {
      const queuedMessage = messageQueue.shift();
      if (queuedMessage) {
        try {
          socket.send(JSON.stringify(queuedMessage));
          console.log("Sent queued message:", queuedMessage.type);
        } catch (error) {
          console.error("Error sending queued message:", error);
          // Put the message back at the front of the queue
          messageQueue.unshift(queuedMessage);
          break;
        }
      }
    }
  }
}

export function sendMessage(
  conversationId: number, 
  message: string, 
  attachments?: Array<{name: string, type: string, url: string, size?: number}>
) {
  const messagePayload = {
    type: 'message' as const,
    conversationId,
    message,
    attachments
  };
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(messagePayload));
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      // Queue the message if sending fails
      messageQueue.push(messagePayload);
      // Try to reconnect if there was an error
      if (socket && socket.readyState === WebSocket.CLOSED) {
        reconnectSocket();
      }
      return false;
    }
  } else {
    // Socket not ready, queue the message
    messageQueue.push(messagePayload);
    // Try to ensure connection
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      reconnectSocket();
    }
    return false;
  }
}

export function sendTypingNotification(conversationId: number) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'typing',
      conversationId
    }));
  }
}

export function onNewMessage(callback: MessageCallback) {
  messageCallbacks.push(callback);
  return () => {
    messageCallbacks = messageCallbacks.filter(cb => cb !== callback);
  };
}

export function onTyping(callback: TypingCallback) {
  typingCallbacks.push(callback);
  return () => {
    typingCallbacks = typingCallbacks.filter(cb => cb !== callback);
  };
}

export function onUserStatusChange(callback: StatusCallback) {
  statusCallbacks.push(callback);
  return () => {
    statusCallbacks = statusCallbacks.filter(cb => cb !== callback);
  };
}

export function onMessageUpdated(callback: MessageUpdatedCallback) {
  messageUpdatedCallbacks.push(callback);
  return () => {
    messageUpdatedCallbacks = messageUpdatedCallbacks.filter(cb => cb !== callback);
  };
}

export function onMessageReacted(callback: MessageReactedCallback) {
  messageReactedCallbacks.push(callback);
  return () => {
    messageReactedCallbacks = messageReactedCallbacks.filter(cb => cb !== callback);
  };
}

export function editMessage(messageId: number, content: string) {
  const messagePayload = {
    type: 'edit_message' as const,
    messageId,
    content
  };
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(messagePayload));
      return true;
    } catch (error) {
      console.error("Error sending edit:", error);
      messageQueue.push(messagePayload);
      if (socket && socket.readyState === WebSocket.CLOSED) {
        reconnectSocket();
      }
      return false;
    }
  } else {
    messageQueue.push(messagePayload);
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      reconnectSocket();
    }
    return false;
  }
}

export function addReaction(messageId: number, emoji: string) {
  const messagePayload = {
    type: 'add_reaction',
    messageId,
    emoji
  };
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(messagePayload));
      return true;
    } catch (error) {
      console.error("Error sending reaction:", error);
      messageQueue.push(messagePayload);
      if (socket.readyState !== WebSocket.CONNECTING) {
        reconnectSocket();
      }
      return false;
    }
  } else {
    messageQueue.push(messagePayload);
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      reconnectSocket();
    }
    return false;
  }
}

export function removeReaction(messageId: number, emoji: string) {
  const messagePayload = {
    type: 'remove_reaction',
    messageId,
    emoji
  };
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(messagePayload));
      return true;
    } catch (error) {
      console.error("Error removing reaction:", error);
      messageQueue.push(messagePayload);
      if (socket.readyState !== WebSocket.CONNECTING) {
        reconnectSocket();
      }
      return false;
    }
  } else {
    messageQueue.push(messagePayload);
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      reconnectSocket();
    }
    return false;
  }
}
