import { useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Channel } from '@shared/schema';
import { NewChannelDialog } from './new-channel-dialog';
import { 
  Hash, 
  Plus, 
  Users, 
  Settings, 
  Volume2, 
  Radio, 
  ChevronDown, 
  ChevronRight 
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ServerView() {
  const { serverId } = useParams();
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [newChannelDialogOpen, setNewChannelDialogOpen] = useState(false);
  const [textChannelsOpen, setTextChannelsOpen] = useState(true);
  const [voiceChannelsOpen, setVoiceChannelsOpen] = useState(true);
  const [announcementsOpen, setAnnouncementsOpen] = useState(true);
  
  // Fetch server details to get channels
  const { data: server, isLoading } = useQuery({
    queryKey: ['/api/servers', serverId],
    enabled: !!serverId && !!user,
  });
  
  // Check if user is a server admin/owner
  const isOwnerOrAdmin = server?.owner?.id === user?.id || 
    server?.members?.some(member => member.userId === user?.id && ['owner', 'admin'].includes(member.role));
  
  if (isLoading) {
    return (
      <div className="w-60 h-screen bg-muted/30 border-r p-3 flex flex-col">
        <div className="py-2 px-3">
          <Skeleton className="h-6 w-36" />
        </div>
        <Separator className="my-2" />
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full mt-2" />
        ))}
      </div>
    );
  }
  
  if (!server || !serverId) {
    return (
      <div className="w-60 h-screen bg-muted/30 border-r p-3 flex flex-col">
        <div className="py-2 px-3 text-center text-muted-foreground">
          Server not found
        </div>
      </div>
    );
  }
  
  // Get channel icon based on type
  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice':
        return <Volume2 className="h-4 w-4 mr-2 text-muted-foreground" />;
      case 'announcement':
        return <Radio className="h-4 w-4 mr-2 text-muted-foreground" />;
      case 'text':
      default:
        return <Hash className="h-4 w-4 mr-2 text-muted-foreground" />;
    }
  };
  
  // Filter channels by type
  const textChannels = server.channels
    ? server.channels
        .filter(channel => channel.type === 'text')
        .sort((a, b) => {
          // Sort by position, then by name
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name);
        })
    : [];
    
  const voiceChannels = server.channels
    ? server.channels
        .filter(channel => channel.type === 'voice')
        .sort((a, b) => {
          // Sort by position, then by name
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name);
        })
    : [];
    
  const announcementChannels = server.channels
    ? server.channels
        .filter(channel => channel.type === 'announcement')
        .sort((a, b) => {
          // Sort by position, then by name
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name);
        })
    : [];
    
  return (
    <div className="w-60 h-screen bg-muted/30 border-r flex flex-col">
      {/* Server header */}
      <div className="py-3 px-4 border-b shadow-sm flex justify-between items-center">
        <h2 className="font-semibold truncate">{server.name}</h2>
        {isOwnerOrAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setNewChannelDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Create Channel
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      {/* Channels area */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Text channels section */}
          {textChannels.length > 0 && (
            <Collapsible 
              open={textChannelsOpen} 
              onOpenChange={setTextChannelsOpen}
              className="space-y-1"
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <div className="flex items-center">
                    {textChannelsOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                    TEXT CHANNELS
                  </div>
                  <span>{textChannels.length}</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                {textChannels.map((channel: Channel) => (
                  <Link 
                    key={channel.id} 
                    href={`/servers/${serverId}/channels/${channel.id}`}
                  >
                    <a className={cn(
                      "flex items-center px-2 py-1.5 rounded text-sm group",
                      location === `/servers/${serverId}/channels/${channel.id}` 
                        ? "bg-accent text-accent-foreground" 
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}>
                      {getChannelIcon('text')}
                      <span className="truncate">{channel.name}</span>
                    </a>
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Voice channels section */}
          {voiceChannels.length > 0 && (
            <Collapsible 
              open={voiceChannelsOpen} 
              onOpenChange={setVoiceChannelsOpen}
              className="space-y-1 mt-2"
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <div className="flex items-center">
                    {voiceChannelsOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                    VOICE CHANNELS
                  </div>
                  <span>{voiceChannels.length}</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                {voiceChannels.map((channel: Channel) => (
                  <Link 
                    key={channel.id} 
                    href={`/servers/${serverId}/channels/${channel.id}`}
                  >
                    <a className={cn(
                      "flex items-center px-2 py-1.5 rounded text-sm group",
                      location === `/servers/${serverId}/channels/${channel.id}` 
                        ? "bg-accent text-accent-foreground" 
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}>
                      {getChannelIcon('voice')}
                      <span className="truncate">{channel.name}</span>
                    </a>
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Announcement channels section */}
          {announcementChannels.length > 0 && (
            <Collapsible 
              open={announcementsOpen} 
              onOpenChange={setAnnouncementsOpen}
              className="space-y-1 mt-2"
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <div className="flex items-center">
                    {announcementsOpen ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                    ANNOUNCEMENTS
                  </div>
                  <span>{announcementChannels.length}</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                {announcementChannels.map((channel: Channel) => (
                  <Link 
                    key={channel.id} 
                    href={`/servers/${serverId}/channels/${channel.id}`}
                  >
                    <a className={cn(
                      "flex items-center px-2 py-1.5 rounded text-sm group",
                      location === `/servers/${serverId}/channels/${channel.id}` 
                        ? "bg-accent text-accent-foreground" 
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}>
                      {getChannelIcon('announcement')}
                      <span className="truncate">{channel.name}</span>
                    </a>
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {/* Empty state when no channels exist */}
          {server.channels && server.channels.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <p>No channels yet</p>
              {isOwnerOrAdmin && (
                <Button 
                  variant="outline"
                  size="sm" 
                  className="mt-2"
                  onClick={() => setNewChannelDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Channel
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Server footer with member count */}
      <div className="p-2 border-t">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
          <Users className="h-4 w-4 mr-2" />
          <span>{server.memberCount || 0} Members</span>
        </Button>
      </div>
      
      {/* New channel dialog */}
      <NewChannelDialog 
        open={newChannelDialogOpen}
        onOpenChange={setNewChannelDialogOpen}
        serverId={parseInt(serverId)}
      />
    </div>
  );
}