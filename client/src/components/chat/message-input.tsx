import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile, Paperclip, Send, X, Loader2, File, Image, FileText } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { sendMessage, sendTypingNotification } from "@/lib/socket";
import { ConversationWithMembers } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";

type MessageInputProps = {
  conversation: ConversationWithMembers;
};

export function MessageInput({ conversation }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<Array<{
    name: string;
    type: string;
    url: string;
    size?: number;
  }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Focus the input when the component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);
  
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest(
        "POST", 
        `/api/conversations/${conversation.id}/messages`,
        { content }
      );
      return await res.json();
    },
    onSuccess: () => {
      // Refresh messages
      queryClient.invalidateQueries({ 
        queryKey: [`/api/conversations/${conversation.id}/messages`] 
      });
      // Refresh conversations list to update last message
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSendMessage = async () => {
    // Allow sending message with just attachments, or with text
    if ((!message.trim() && attachments.length === 0) || sendMessageMutation.isPending || isUploading) return;
    
    // Keep the original message formatting intact, only trim leading/trailing whitespace
    const content = message.trim();
    setMessage("");
    
    // Send via WebSocket with any attachments
    const success = sendMessage(conversation.id, content, attachments.length > 0 ? attachments : undefined);
    
    if (success && attachments.length > 0) {
      // Clear attachments after sending
      setAttachments([]);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    // Send typing notification
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    sendTypingNotification(conversation.id);
    
    // Set a timeout to prevent spamming typing notifications
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };
  
  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append("file", file);
      });
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to upload files");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setAttachments(prev => [...prev, ...data]);
      setIsUploading(false);
      toast({
        title: "Files uploaded",
        description: `${data.length} file(s) uploaded successfully`,
      });
    },
    onError: (error) => {
      setIsUploading(false);
      toast({
        title: "Failed to upload files",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      uploadFileMutation.mutate(e.target.files);
    }
  };
  
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Helper function to get icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType.startsWith('text/')) {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="px-4 py-3 border-t border-surface-light bg-surface">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        multiple 
      />
      
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div 
              key={index} 
              className="relative bg-muted rounded-md p-2 pr-8 flex items-center gap-2 text-sm"
            >
              {getFileIcon(file.type)}
              <span className="truncate max-w-[150px]">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 absolute right-1 top-1 text-muted-foreground hover:text-foreground"
                onClick={() => handleRemoveAttachment(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {/* Upload progress indicator */}
      {isUploading && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Uploading files...</span>
        </div>
      )}
      
      <div className="flex items-center">
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              {showEmojiPicker ? (
                <X className="h-5 w-5" />
              ) : (
                <Smile className="h-5 w-5" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            side="top" 
            align="start" 
            className="w-auto p-0 border-none shadow-lg"
          >
            <EmojiPicker
              theme={Theme.DARK}
              onEmojiClick={handleEmojiClick}
              lazyLoadEmojis={true}
              width={320}
              height={400}
            />
          </PopoverContent>
        </Popover>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleFileSelect}
          disabled={isUploading}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 bg-muted rounded-full px-4 py-2 mx-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-0 h-6"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            autoCapitalize="off" 
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
        
        <Button 
          size="icon" 
          className="rounded-full" 
          onClick={handleSendMessage}
          disabled={((!message.trim() && attachments.length === 0) || sendMessageMutation.isPending || isUploading)}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
