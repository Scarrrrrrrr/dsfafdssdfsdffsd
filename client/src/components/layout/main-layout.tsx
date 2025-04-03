import { useState, useEffect } from "react";
import { NavigationSidebar } from "./navigation-sidebar";
import { ConversationList } from "@/components/conversations/conversation-list";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatMessages } from "@/components/chat/chat-messages";
import { MessageInput } from "@/components/chat/message-input";
import { ConversationWithMembers, User } from "@shared/schema";
import { AtSign, Bell, Menu, MessageSquare, Phone, Reply, UserPlus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { onNewMessage, onUserStatusChange } from "@/lib/socket";
import { showMessageNotification, requestNotificationPermission } from "@/lib/notification-service";

type MainLayoutProps = {
  children?: React.ReactNode;
};

export function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("chats");
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithMembers | null>(null);
  
  const handleSelectConversation = (conversation: ConversationWithMembers) => {
    setSelectedConversation(conversation);
  };
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Clear selected conversation when switching tabs
    setSelectedConversation(null);
  };
  
  // Set up notification listeners
  useEffect(() => {
    if (!user) return;
    
    // Request notification permission
    requestNotificationPermission();
    
    // Listen for new messages
    const unsubscribeMessage = onNewMessage((conversationId, message) => {
      // Show notification only if user's settings allow it
      if ((user.settings as any)?.notifications !== false) {
        showMessageNotification(conversationId, message, selectedConversation?.id);
      }
    });
    
    // Listen for status changes
    const unsubscribeStatus = onUserStatusChange((userId, isOnline) => {
      // Status change notification logic would go here if needed
    });
    
    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }, [user, selectedConversation?.id]);
  
  const renderTabContent = () => {
    switch (activeTab) {
      case "chats":
        return (
          <>
            {/* Conversations List - Desktop */}
            <div className="hidden md:block">
              <ConversationList 
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversation?.id}
              />
            </div>
            
            {/* Main Chat Content Area */}
            {selectedConversation ? (
              <div className="flex flex-col flex-1 bg-background">
                <ChatHeader 
                  conversation={selectedConversation} 
                  onCloseConversation={() => setSelectedConversation(null)}
                />
                <ChatMessages 
                  conversation={selectedConversation} 
                />
                <MessageInput conversation={selectedConversation} />
              </div>
            ) : (
              <div className="flex flex-col flex-1 items-center justify-center bg-background">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-surface-light rounded-full mx-auto flex items-center justify-center mb-4">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Select a Conversation</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Choose a conversation from the list to start chatting
                  </p>
                </div>
              </div>
            )}
          </>
        );
        
      case "calls":
        return (
          <div className="flex flex-col flex-1 bg-background">
            {selectedConversation ? (
              <>
                <ChatHeader 
                  conversation={selectedConversation} 
                  onCloseConversation={() => setSelectedConversation(null)}
                />
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-center p-6">
                    <div className="w-16 h-16 bg-surface-light rounded-full mx-auto flex items-center justify-center mb-4">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Start a Call</h2>
                    <p className="text-muted-foreground text-sm max-w-xs mb-6">
                      Call with {selectedConversation.isGroup 
                        ? selectedConversation.name || "group" 
                        : selectedConversation.members.find(m => m.id !== user?.id)?.displayName || "user"}
                    </p>
                    <div className="flex justify-center space-x-4">
                      <Button size="lg" className="rounded-full h-16 w-16" onClick={() => {
                        window.alert("Voice call feature is coming soon!");
                      }}>
                        <Phone className="h-6 w-6" />
                      </Button>
                      <Button size="lg" className="rounded-full h-16 w-16" onClick={() => {
                        window.alert("Video call feature is coming soon!");
                      }}>
                        <Video className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col flex-1 items-center justify-center">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-surface-light rounded-full mx-auto flex items-center justify-center mb-4">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Calls</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Select a conversation first to start a call
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => setActiveTab("chats")}>
                    Return to chats
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
        
      case "notifications":
        return (
          <div className="flex flex-col flex-1 bg-background">
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-semibold flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Notifications
              </h2>
            </div>
            <div className="flex-1 flex flex-col p-4 space-y-2 overflow-y-auto">
              {/* Sample notifications - these would come from an actual data source */}
              <div className="p-4 rounded-lg border border-border bg-surface-light flex items-start space-x-4 transition-colors hover:bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <AtSign className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">You were mentioned in Group Chat</p>
                  <p className="text-sm text-muted-foreground">"@user can you check this message?"</p>
                  <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-4 rounded-lg border border-border bg-surface-light flex items-start space-x-4 transition-colors hover:bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Reply className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">New Reply in Project Discussion</p>
                  <p className="text-sm text-muted-foreground">"Thanks for the update!"</p>
                  <p className="text-xs text-muted-foreground mt-1">Yesterday</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-4 rounded-lg border border-border bg-surface-light flex items-start space-x-4 transition-colors hover:bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">You were added to a new group</p>
                  <p className="text-sm text-muted-foreground">"Project Team Chat"</p>
                  <p className="text-xs text-muted-foreground mt-1">3 days ago</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Empty state when no notifications */}
              {false && (
                <div className="flex flex-col flex-1 items-center justify-center py-12">
                  <div className="w-16 h-16 bg-surface-light rounded-full mx-auto flex items-center justify-center mb-4">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                  <p className="text-muted-foreground text-sm max-w-xs text-center">
                    You'll see your notifications here when someone mentions you or replies to your messages
                  </p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-border flex justify-center">
              <Button variant="outline" onClick={() => setActiveTab("chats")}>
                Return to chats
              </Button>
            </div>
          </div>
        );
        
      case "group-chat":
        return (
          <div className="flex flex-col flex-1 items-center justify-center bg-background">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-surface-light rounded-full mx-auto flex items-center justify-center mb-4">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Create Group Chat</h2>
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                Create a new group chat to collaborate with multiple people at once
              </p>
              <div className="space-y-4">
                <Button 
                  variant="default" 
                  size="lg" 
                  className="w-full"
                  onClick={() => {
                    setActiveTab("chats");
                    // This would typically open the NewConversationDialog with group=true
                    window.alert("Group chat creation feature is coming soon!");
                  }}
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  New Group Chat
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("chats")}
                >
                  Return to Chats
                </Button>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Navigation Sidebar */}
      <NavigationSidebar 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-surface-light bg-surface w-full">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center mr-3">
            <MessageSquare className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">Dark Chat</span>
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 bg-surface w-3/4 sm:max-w-sm">
            <ConversationList 
              onSelectConversation={handleSelectConversation}
              selectedConversationId={selectedConversation?.id}
            />
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Main Content Area based on active tab */}
      {renderTabContent()}
    </div>
  );
}
