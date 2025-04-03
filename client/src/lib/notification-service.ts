import { MessageWithSender } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

// Check if the browser supports notifications
const isNotificationSupported = () => {
  return 'Notification' in window;
};

// Request permission for browser notifications
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// Show a notification for a new message
export const showMessageNotification = (
  conversationId: number, 
  message: MessageWithSender, 
  currentConversationId?: number
) => {
  // Don't show notifications for the current conversation if it's in focus
  if (currentConversationId === conversationId) {
    return;
  }
  
  // Show toast notification
  toast({
    title: `New message from ${message.sender.displayName || message.sender.username}`,
    description: message.content.length > 60 ? `${message.content.substring(0, 60)}...` : message.content,
    variant: "default",
  });
  
  // Try to show a browser notification if permissions allow
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const notification = new Notification(`${message.sender.displayName || message.sender.username}`, {
        body: message.content,
        icon: message.sender.avatar || undefined,
      });
      
      // Close the notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
      
      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navigate to the conversation (handled by parent component)
      };
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }
};