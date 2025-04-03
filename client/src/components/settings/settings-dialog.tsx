import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { UserSettings, UserProfile } from "@shared/schema";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Check, Camera, Upload, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function SettingsDialog() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize settings state from user
  const [settings, setSettings] = useState<UserSettings>({
    theme: (user?.settings as any)?.theme || "dark",
    notifications: (user?.settings as any)?.notifications !== false, // Default to true if not set
    onlineStatus: (user?.settings as any)?.onlineStatus || "online", // Default to online
  });
  
  // Initialize profile state
  const [profile, setProfile] = useState<UserProfile>({
    avatar: user?.avatar || "",
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    pronouns: user?.pronouns || "",
    backgroundImage: user?.backgroundImage || "",
  });

  // User settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: UserSettings) => {
      const response = await apiRequest("PATCH", "/api/user/settings", updatedSettings);
      return await response.json();
    },
    onSuccess: (user) => {
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully",
      });
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // User profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updatedProfile: UserProfile) => {
      const response = await apiRequest("PATCH", "/api/user/profile", updatedProfile);
      return await response.json();
    },
    onSuccess: (user) => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update profile: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleToggleNotifications = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: enabled,
    }));
  };

  const handleStatusChange = (status: string) => {
    setSettings((prev) => ({
      ...prev,
      onlineStatus: status as "online" | "idle" | "offline",
    }));

    toast({
      title: status === "online" ? "Online" : status === "idle" ? "Idle" : "Offline",
      description: `Your status is now set to ${status}`,
    });
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settings);
    updateProfileMutation.mutate(profile);
  };
  
  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    setUploading(true);
    
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload profile picture");
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        // Update profile with new avatar URL
        setProfile(prev => ({
          ...prev,
          avatar: data[0].url
        }));
        
        // Also update the profile in the backend
        updateProfileMutation.mutate({
          ...profile,
          avatar: data[0].url
        });
        
        toast({
          title: "Profile picture updated",
          description: "Your profile picture has been updated successfully"
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-xl hover:bg-surface-light text-muted-foreground"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your messaging experience
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notifications" className="text-base">
              Enable Notifications
            </Label>
            <Switch
              id="notifications"
              checked={settings.notifications}
              onCheckedChange={handleToggleNotifications}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status-select" className="text-base">
              Status
            </Label>
            <Select
              value={settings.onlineStatus}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger id="status-select" className="w-full">
                <SelectValue placeholder="Select your status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Online</span>
                  </div>
                </SelectItem>
                <SelectItem value="idle">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span>Idle</span>
                  </div>
                </SelectItem>
                <SelectItem value="offline">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    <span>Offline</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
            <Label className="text-base mb-2 block">Theme</Label>
            <div className="flex space-x-2">
              <Button
                variant={settings.theme === "light" ? "default" : "outline"}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "light" }))}
                className="flex-1"
              >
                Light
              </Button>
              <Button
                variant={settings.theme === "dark" ? "default" : "outline"}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "dark" }))}
                className="flex-1"
              >
                Dark
              </Button>
              <Button
                variant={settings.theme === "system" ? "default" : "outline"}
                onClick={() => setSettings((prev) => ({ ...prev, theme: "system" }))}
                className="flex-1"
              >
                System
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}