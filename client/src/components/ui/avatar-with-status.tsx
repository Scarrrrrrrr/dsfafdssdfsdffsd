import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@shared/schema";
import { cn } from "@/lib/utils";

type AvatarWithStatusProps = {
  user: Partial<User>;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  className?: string;
};

export function AvatarWithStatus({ 
  user, 
  size = "md", 
  showStatus = true, 
  className 
}: AvatarWithStatusProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const statusSizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-3.5 h-3.5",
  };

  const getFallbackInitials = () => {
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    if (user.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Determine the status color based on user settings and online status
  const getStatusColor = () => {
    // If user is offline by isOnline flag, show gray
    if (!user.isOnline) {
      return "bg-muted";
    }
    
    // Check user settings for status preference
    const onlineStatus = (user.settings as any)?.onlineStatus;
    
    if (onlineStatus === "idle") {
      return "bg-yellow-500"; // Idle status color
    } else if (onlineStatus === "offline") {
      return "bg-muted"; // Offline status color
    } else {
      return "bg-green-500"; // Online status color (default)
    }
  };

  return (
    <div className="relative">
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarImage src={user.avatar || ""} alt={user.displayName || user.username || "User"} />
        <AvatarFallback className="bg-surface-light">
          {getFallbackInitials()}
        </AvatarFallback>
      </Avatar>
      
      {showStatus && (
        <div 
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-background",
            statusSizeClasses[size],
            getStatusColor()
          )}
        />
      )}
    </div>
  );
}
