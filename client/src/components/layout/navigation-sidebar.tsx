import { Button } from "@/components/ui/button";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";
import { useAuth } from "@/hooks/use-auth";
import { 
  MessageSquare, 
  Users, 
  Bell, 
  Phone, 
  LogOut,
  UserPlus
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { SettingsDialog } from "@/components/settings/settings-dialog";

type NavigationSidebarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
};

type NavigationItem = {
  icon: React.ReactNode;
  label: string;
  id: string;
  active?: boolean;
  onClick: () => void;
};

export function NavigationSidebar({ activeTab, onTabChange }: NavigationSidebarProps) {
  const { user, logoutMutation } = useAuth();
  
  // Navigation items
  const navigationItems: NavigationItem[] = [
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Chats",
      id: "chats",
      active: activeTab === "chats",
      onClick: () => onTabChange("chats"),
    },
    {
      icon: <Phone className="h-5 w-5" />,
      label: "Calls",
      id: "calls",
      active: activeTab === "calls",
      onClick: () => onTabChange("calls"),
    },
    {
      icon: <Bell className="h-5 w-5" />,
      label: "Notifications",
      id: "notifications",
      active: activeTab === "notifications",
      onClick: () => onTabChange("notifications"),
    },
    {
      icon: <UserPlus className="h-5 w-5" />,
      label: "Group Chat",
      id: "group-chat",
      active: activeTab === "group-chat",
      onClick: () => onTabChange("group-chat"),
    },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="hidden md:flex flex-col w-16 bg-surface h-full border-r border-surface-light">
      <div className="flex flex-col items-center py-6 space-y-8">
        {/* App Logo */}
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary-foreground" />
        </div>
        
        {/* Navigation Icons */}
        <div className="flex flex-col space-y-4">
          <TooltipProvider>
            {navigationItems.map((item) => (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-10 h-10 rounded-xl ${
                      item.active 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-surface-light text-muted-foreground"
                    }`}
                    onClick={item.onClick}
                  >
                    {item.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>
      
      {/* User Profile and Settings */}
      <div className="mt-auto flex flex-col items-center pb-6 space-y-4">
        <TooltipProvider>
          {/* Settings Dialog */}
          <Tooltip>
            <TooltipTrigger asChild>
              <SettingsDialog />
            </TooltipTrigger>
            <TooltipContent side="right">
              Settings
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-xl hover:bg-surface-light text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Logout
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* User Avatar */}
        {user && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative cursor-pointer">
                  <AvatarWithStatus user={user} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                {user.displayName || user.username}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
