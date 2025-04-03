import { useLocation } from 'wouter';
import { ServerWithDetails } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ServerItemProps {
  server: ServerWithDetails;
}

export function ServerItem({ server }: ServerItemProps) {
  const [location, setLocation] = useLocation();
  const isActive = location.startsWith(`/servers/${server.id}`);

  const handleServerClick = () => {
    setLocation(`/servers/${server.id}`);
  };

  // Get initials for the avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? "default" : "ghost"}
            size="icon"
            className={cn(
              "rounded-full h-12 w-12 relative",
              isActive && "bg-primary text-primary-foreground",
              !isActive && "hover:bg-muted"
            )}
            onClick={handleServerClick}
          >
            <Avatar className="h-full w-full">
              <AvatarImage src={server.icon || undefined} alt={server.name} />
              <AvatarFallback className={cn(
                isActive ? "bg-primary-foreground text-primary" : "bg-muted-foreground text-background"
              )}>
                {getInitials(server.name)}
              </AvatarFallback>
            </Avatar>
            
            {/* Indicator for unread messages - could be implemented later */}
            {/* {hasUnreadMessages && (
              <div className="absolute -right-1 -top-1 w-3 h-3 bg-destructive rounded-full" />
            )} */}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{server.name}</p>
          <p className="text-xs text-muted-foreground">{server.memberCount} {server.memberCount === 1 ? 'member' : 'members'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}