import { format } from "date-fns";
import { ConversationWithMembers } from "@shared/schema";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type ConversationItemProps = {
  conversation: ConversationWithMembers;
  isSelected: boolean;
  onClick: () => void;
};

export function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const { user: currentUser } = useAuth();
  
  // For direct messages, show the other user
  const otherUser = conversation.isGroup 
    ? null 
    : conversation.members.find(member => member.id !== currentUser?.id);
  
  // Format the timestamp
  const timestamp = conversation.lastMessage?.createdAt 
    ? format(new Date(conversation.lastMessage.createdAt), "h:mm a")
    : format(new Date(conversation.createdAt), "MMM d");
  
  // Get display name for the conversation
  const displayName = conversation.isGroup 
    ? conversation.name || "Group Chat" 
    : otherUser?.displayName || otherUser?.username || "Unknown User";
  
  // Get the last message preview text
  const lastMessageText = conversation.lastMessage 
    ? truncateText(conversation.lastMessage.content, 40)
    : "No messages yet";
  
  // If it's a group, show who sent the last message
  const groupSenderPrefix = conversation.isGroup && conversation.lastMessage 
    ? `${getShortName(conversation.lastMessage.sender.displayName || conversation.lastMessage.sender.username)}: `
    : "";
  
  return (
    <div 
      className={cn(
        "px-3 py-3 hover:bg-surface-light cursor-pointer", 
        isSelected && "border-l-4 border-primary"
      )}
      onClick={onClick}
    >
      <div className="flex items-center">
        {conversation.isGroup ? (
          <div className="w-12 h-12 rounded-full bg-surface-light flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        ) : (
          <AvatarWithStatus 
            user={otherUser || {}} 
            size="lg"
          />
        )}
        <div className="ml-3 flex-1 overflow-hidden">
          <div className="flex justify-between items-center">
            <h3 className="font-medium truncate">{displayName}</h3>
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-1">
            {groupSenderPrefix}{lastMessageText}
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper to truncate text with ellipsis
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

// Helper to get first name or short username
function getShortName(fullName: string): string {
  // If it has spaces, get first word
  if (fullName.includes(" ")) {
    return fullName.split(" ")[0];
  }
  // Otherwise, if it's long, truncate
  if (fullName.length > 10) {
    return fullName.substring(0, 10);
  }
  return fullName;
}
