import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationWithMembers, User } from "@shared/schema";
import { Search, Plus, UserPlus } from "lucide-react";
import { ConversationItem } from "./conversation-item";
import { onNewMessage, onUserStatusChange } from "@/lib/socket";
import { queryClient } from "@/lib/queryClient";
import { NewConversationDialog } from "./new-conversation-dialog";
import { UserSearchDialog } from "@/components/users/user-search-dialog";

type ConversationListProps = {
  onSelectConversation: (conversation: ConversationWithMembers) => void;
  selectedConversationId?: number;
};

export function ConversationList({
  onSelectConversation,
  selectedConversationId,
}: ConversationListProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: conversations = [], isLoading } = useQuery<ConversationWithMembers[]>({
    queryKey: ["/api/conversations"],
    staleTime: 60000, // 1 minute
  });

  // Real-time updates for new messages
  useEffect(() => {
    const unsubscribe = onNewMessage((conversationId, message) => {
      // Update conversation list to reflect new message
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    });

    return unsubscribe;
  }, []);

  // Real-time updates for user status changes
  useEffect(() => {
    const unsubscribe = onUserStatusChange((userId, isOnline) => {
      // Update the user's status in the conversation list
      const updatedConversations = conversations.map((conversation) => {
        const updatedMembers = conversation.members.map((member) => {
          if (member.id === userId) {
            return { ...member, isOnline };
          }
          return member;
        });
        
        return { ...conversation, members: updatedMembers };
      });
      
      queryClient.setQueryData(["/api/conversations"], updatedConversations);
    });

    return unsubscribe;
  }, [conversations]);

  // Filter conversations based on search term
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchTerm) return true;
    
    // For group chats, search by group name
    if (conversation.isGroup && conversation.name) {
      return conversation.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    // For direct messages, search by the other person's name/username
    return conversation.members.some((member) => {
      return (
        member.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  });

  const handleSelectConversation = useCallback(
    (conversation: ConversationWithMembers) => {
      onSelectConversation(conversation);
    },
    [onSelectConversation]
  );

  const handleConversationCreated = (conversationId: number) => {
    // Find the newly created conversation from the updated data
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] }).then(() => {
      const allConversations = queryClient.getQueryData<ConversationWithMembers[]>(["/api/conversations"]) || [];
      const newConversation = allConversations.find(conv => conv.id === conversationId);
      
      if (newConversation) {
        onSelectConversation(newConversation);
      }
    });
  };

  return (
    <div className="w-full md:w-80 bg-surface border-r border-surface-light flex flex-col h-full">
      {/* Conversations Header */}
      <div className="px-5 py-4 border-b border-surface-light">
        <h2 className="text-xl font-semibold">Messages</h2>
        <div className="flex items-center mt-3 bg-surface-light rounded-full px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            type="text"
            placeholder="Search conversations"
            className="bg-transparent border-none h-6 p-0 placeholder:text-muted-foreground text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="py-4 text-center text-muted-foreground">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">
            {searchTerm ? "No conversations found" : "No conversations yet"}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selectedConversationId === conversation.id}
              onClick={() => handleSelectConversation(conversation)}
            />
          ))
        )}
      </div>
      
      {/* Create New Chat and Add User */}
      <div className="p-4 border-t border-surface-light space-y-2">
        <NewConversationDialog onSuccess={handleConversationCreated} />
        
        <UserSearchDialog 
          onSuccess={handleConversationCreated}
          trigger={
            <Button className="w-full" size="sm" variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          }
        />
      </div>
    </div>
  );
}
