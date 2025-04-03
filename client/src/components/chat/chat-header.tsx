import { ConversationWithMembers } from "@shared/schema";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";
import { Phone, Video, Info, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ChatHeaderProps = {
  conversation: ConversationWithMembers;
  onCloseConversation?: () => void;
};

export function ChatHeader({ conversation, onCloseConversation }: ChatHeaderProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // For direct messages, show the other user
  const otherUser = conversation.isGroup 
    ? null 
    : conversation.members.find(member => member.id !== currentUser?.id);
  
  // Get display name for the conversation
  const displayName = conversation.isGroup 
    ? conversation.name || "Group Chat" 
    : otherUser?.displayName || otherUser?.username || "Unknown User";
  
  // Get online status text
  const statusText = conversation.isGroup
    ? `${conversation.members.length} members`
    : otherUser?.isOnline
      ? "Online"
      : "Offline";

  // Mutation to clear chat history
  const clearChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/conversations/${conversation.id}/messages`);
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Chat cleared",
        description: "All messages have been deleted from this conversation",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversation.id}/messages`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to clear chat: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to leave/close conversation
  const closeConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/conversations/${conversation.id}/members`);
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Conversation closed",
        description: "You have left this conversation",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      
      if (onCloseConversation) {
        onCloseConversation();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to leave conversation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleClearChat = () => {
    clearChatMutation.mutate();
  };

  const handleCloseConversation = () => {
    closeConversationMutation.mutate();
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-surface-light bg-surface">
      <div className="flex items-center">
        {conversation.isGroup ? (
          <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        ) : (
          <div>
            <AvatarWithStatus 
              user={otherUser || {}} 
              size="md"
            />
          </div>
        )}
        <div className="ml-3">
          <h3 className="font-semibold">{displayName}</h3>
          <p className="text-xs text-muted-foreground">{statusText}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Phone className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Video className="h-4 w-4" />
        </Button>
        
        {/* Chat Options Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Info className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Clear Chat Option */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear chat history
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all messages in this conversation.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat}>
                    {clearChatMutation.isPending ? "Clearing..." : "Clear History"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {/* Close/Leave Conversation Option */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                  <X className="mr-2 h-4 w-4" />
                  {conversation.isGroup ? "Leave group" : "Close conversation"}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {conversation.isGroup ? "Leave group?" : "Close conversation?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {conversation.isGroup 
                      ? "You will no longer be a member of this group chat."
                      : "This will close the conversation with this user. You can start a new conversation later."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCloseConversation}>
                    {closeConversationMutation.isPending 
                      ? "Processing..." 
                      : conversation.isGroup ? "Leave Group" : "Close Conversation"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
