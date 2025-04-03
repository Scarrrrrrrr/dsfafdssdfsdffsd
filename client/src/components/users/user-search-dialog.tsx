import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogDescription, 
  DialogHeader,
  DialogTitle, 
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Plus, 
  MessageSquare,
  Loader2,
  UserPlus
} from "lucide-react";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";

type UserSearchDialogProps = {
  trigger?: React.ReactNode;
  onSuccess?: (conversationId: number) => void;
};

export function UserSearchDialog({ 
  trigger, 
  onSuccess 
}: UserSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Get all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Mutation to create a conversation
  const createConversationMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", "/api/conversations", {
        isGroup: false,
        name: null, // Private conversations don't need names
        userIds: [userId]
      });
      return await response.json();
    },
    onSuccess: (conversation) => {
      // Invalidate conversations query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      
      // Close the dialog
      setIsOpen(false);
      
      // Notify
      toast({
        title: "Conversation created",
        description: "You can now start chatting",
      });
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(conversation.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to create conversation",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    // Don't include the current user
    if (user.id === currentUser?.id) return false;
    
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchLower) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchLower))
    );
  });

  const handleStartConversation = (userId: number) => {
    createConversationMutation.mutate(userId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full" size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            Search for users by name or username and start a conversation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center bg-surface-light rounded-md px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground mr-2" />
            <Input
              placeholder="Search users..."
              className="bg-transparent border-none h-8 p-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No users found" : "No users available"}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredUsers.map((user) => (
                  <li 
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-surface-light transition-colors"
                  >
                    <div className="flex items-center">
                      <AvatarWithStatus user={user} size="sm" />
                      <div className="ml-3">
                        <h3 className="font-medium">{user.displayName || user.username}</h3>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleStartConversation(user.id)}
                      disabled={createConversationMutation.isPending}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}