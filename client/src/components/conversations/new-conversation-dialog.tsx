import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, ConversationWithMembers } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogDescription, 
  DialogHeader,
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Plus, 
  UsersRound,
  Loader2,
  UserPlus,
  UserRound
} from "lucide-react";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserSearchDialog } from "@/components/users/user-search-dialog";

type NewConversationDialogProps = {
  onSuccess?: (conversationId: number) => void;
};

export function NewConversationDialog({ onSuccess }: NewConversationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("dm");
  const [searchTerm, setSearchTerm] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Get all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Mutation to create a direct message conversation
  const createDMConversationMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", "/api/conversations", {
        isGroup: false,
        name: null, // Private conversations don't need names
        userIds: [userId]
      });
      return await response.json();
    },
    onSuccess: (conversation) => {
      handleSuccess(conversation);
    },
    onError: (error) => {
      handleError(error);
    }
  });

  // Mutation to create a group conversation
  const createGroupConversationMutation = useMutation({
    mutationFn: async () => {
      if (selectedUsers.length === 0) {
        throw new Error("Please select at least one user");
      }
      
      if (!groupName.trim()) {
        throw new Error("Please enter a group name");
      }
      
      const response = await apiRequest("POST", "/api/conversations", {
        isGroup: true,
        name: groupName.trim(),
        userIds: selectedUsers
      });
      return await response.json();
    },
    onSuccess: (conversation) => {
      handleSuccess(conversation);
    },
    onError: (error) => {
      handleError(error);
    }
  });

  const handleSuccess = (conversation: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    
    // Reset form and close dialog
    setSearchTerm("");
    setGroupName("");
    setSelectedUsers([]);
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
  };

  const handleError = (error: Error) => {
    toast({
      title: "Failed to create conversation",
      description: error.message,
      variant: "destructive",
    });
  };

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

  const handleStartDM = (userId: number) => {
    createDMConversationMutation.mutate(userId);
  };

  const handleCreateGroup = () => {
    createGroupConversationMutation.mutate();
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers(prevSelected => {
      if (prevSelected.includes(userId)) {
        return prevSelected.filter(id => id !== userId);
      } else {
        return [...prevSelected, userId];
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Conversation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a direct message or create a group chat.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="dm">
              <UserRound className="mr-2 h-4 w-4" />
              Direct Message
            </TabsTrigger>
            <TabsTrigger value="group">
              <UsersRound className="mr-2 h-4 w-4" />
              Group Chat
            </TabsTrigger>
          </TabsList>
          
          {/* Direct Message Tab */}
          <TabsContent value="dm">
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
                          onClick={() => handleStartDM(user.id)}
                          disabled={createDMConversationMutation.isPending}
                        >
                          Message
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Group Chat Tab */}
          <TabsContent value="group">
            <div className="space-y-4">
              <div>
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Select Members</Label>
                <div className="flex items-center bg-surface-light rounded-md px-3 py-2 mt-1">
                  <Search className="h-4 w-4 text-muted-foreground mr-2" />
                  <Input
                    placeholder="Search users to add..."
                    className="bg-transparent border-none h-8 p-0 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="max-h-[200px] overflow-y-auto">
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
                        <Checkbox 
                          checked={selectedUsers.includes(user.id)} 
                          onCheckedChange={() => toggleUserSelection(user.id)}
                          id={`user-${user.id}`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {selectedUsers.length > 0 && (
                <div className="bg-surface-light p-2 rounded-md">
                  <p className="text-sm font-medium mb-1">Selected users ({selectedUsers.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(userId => {
                      const user = users.find(u => u.id === userId);
                      if (!user) return null;
                      
                      return (
                        <div 
                          key={userId}
                          className="bg-background text-foreground px-2 py-1 rounded-md text-xs flex items-center"
                        >
                          {user.displayName || user.username}
                          <button 
                            className="ml-1 text-muted-foreground hover:text-foreground"
                            onClick={() => toggleUserSelection(userId)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="mt-4">
              <Button 
                onClick={handleCreateGroup}
                disabled={createGroupConversationMutation.isPending || selectedUsers.length === 0 || !groupName.trim()}
              >
                {createGroupConversationMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Group
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}