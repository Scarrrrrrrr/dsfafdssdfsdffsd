import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Channel, MessageWithSender } from '@shared/schema';
import { format } from 'date-fns';
import { Loader2, Send, PaperclipIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface ChannelChatProps {
  channelId: number;
  serverId: number;
}

export function ChannelChat({ channelId, serverId }: ChannelChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Fetch channel details
  const { data: channel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['/api/channels', channelId.toString()],
    enabled: !!channelId && !!user,
  });
  
  // Fetch server details to get all channels
  const { data: server } = useQuery({
    queryKey: ['/api/servers', serverId.toString()],
    enabled: !!serverId && !!user,
  });
  
  // Fetch channel messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/channels', channelId.toString(), 'messages'],
    // For now, let's assume our API follows a similar pattern to conversations
    queryFn: async () => {
      const response = await apiRequest(`/api/servers/${serverId}/channels/${channelId}/messages`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      return response.json();
    },
    enabled: !!channelId && !!user,
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/servers/${serverId}/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      return response.json();
    },
    onSuccess: () => {
      // Clear input and refresh messages
      setMessage('');
      queryClient.invalidateQueries({ 
        queryKey: ['/api/channels', channelId.toString(), 'messages'] 
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to send message',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message);
    }
  };
  
  // Loading state
  if (isLoadingChannel) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center pb-4 border-b">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 py-4 space-y-4 overflow-y-auto">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="flex items-start space-x-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Channel not found state
  if (!channel) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Channel not found</h3>
          <p className="text-muted-foreground">This channel may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Channel header */}
      <div className="flex items-center px-6 py-3 border-b bg-background">
        <div>
          <h3 className="font-semibold text-lg"># {channel.name}</h3>
          {channel.description && (
            <p className="text-sm text-muted-foreground">{channel.description}</p>
          )}
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg: MessageWithSender) => (
            <MessageItem key={msg.id} message={msg} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <h3 className="text-lg font-medium mb-2">No messages yet</h3>
            <p className="text-muted-foreground">Be the first to send a message in this channel!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon"
          >
            <PaperclipIcon className="h-5 w-5" />
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message #${channel.name}`}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!message.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: MessageWithSender;
}

function MessageItem({ message }: MessageItemProps) {
  const formattedDate = message.createdAt
    ? format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')
    : '';
  
  return (
    <div className="flex items-start space-x-3 group hover:bg-muted/50 -mx-2 px-2 py-1 rounded">
      <Avatar>
        <AvatarImage src={message.sender.avatar || undefined} alt={message.sender.username} />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {message.sender.username.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline">
          <h4 className="font-semibold text-sm">
            {message.sender.displayName || message.sender.username}
          </h4>
          <span className="ml-2 text-xs text-muted-foreground">{formattedDate}</span>
        </div>
        
        <div className="mt-1">
          {message.content}
        </div>
        
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment, index) => {
              const isImage = attachment.type.startsWith('image/');
              
              return (
                <div key={index} className="max-w-xs">
                  {isImage ? (
                    <a 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={attachment.url} 
                        alt={attachment.name} 
                        className="max-h-60 object-contain rounded"
                      />
                    </a>
                  ) : (
                    <a 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center p-2 border rounded bg-muted/50 hover:bg-muted"
                    >
                      <PaperclipIcon className="h-4 w-4 mr-2" />
                      <span className="truncate text-sm">{attachment.name}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}