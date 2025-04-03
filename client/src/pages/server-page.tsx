import { useEffect } from 'react';
import { useParams, Redirect } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { ServerView } from '@/components/servers/server-view';
import { ServerList } from '@/components/servers/server-list';
import { ChannelChat } from '@/components/servers/channel-chat';

export default function ServerPage() {
  const { serverId, channelId } = useParams();
  const { user, isLoading } = useAuth();
  
  // If not logged in and not loading, redirect to auth page
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="flex h-screen">
      {/* Server list sidebar */}
      <ServerList />
      
      {/* Server channels sidebar */}
      <ServerView />
      
      {/* Main content area - channel messages */}
      <div className="flex-1 bg-background">
        {channelId ? (
          <ChannelChat channelId={parseInt(channelId)} serverId={parseInt(serverId || '0')} />
        ) : (
          <ServerHome serverId={parseInt(serverId || '0')} />
        )}
      </div>
    </div>
  );
}

interface ServerHomeProps {
  serverId: number;
}

function ServerHome({ serverId }: ServerHomeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <h2 className="text-xl font-semibold mb-2">Welcome to the server</h2>
      <p>Select a channel to start chatting</p>
    </div>
  );
}