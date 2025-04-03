import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ServerWithDetails } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle } from 'lucide-react';

import { NewServerDialog } from './new-server-dialog';
import { ServerItem } from './server-item';

export function ServerList() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [showNewServerDialog, setShowNewServerDialog] = useState(false);
  
  const { data: servers, isLoading, error } = useQuery({
    queryKey: ['/api/servers'],
    enabled: !!user,
  });

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="w-20 h-screen flex flex-col items-center py-4 bg-secondary gap-4">
        {Array(5).fill(0).map((_, i) => (
          <Skeleton key={i} className="w-12 h-12 rounded-full bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-20 h-screen flex flex-col items-center py-4 bg-secondary">
        <div className="text-destructive text-xs text-center p-2">
          Error loading servers
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="mt-2"
          onClick={() => setLocation('/')}
        >
          Home
        </Button>
      </div>
    );
  }

  return (
    <div className="w-20 h-screen flex flex-col items-center py-4 bg-secondary">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-12 w-12 mb-4"
        onClick={() => setLocation('/')}
      >
        <img 
          src="/icon.png" 
          alt="Home" 
          className="rounded-full"
          height={48}
          width={48}
        />
      </Button>

      <Separator className="w-10 mb-4" />

      <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto w-full">
        {servers && servers.map((server: ServerWithDetails) => (
          <ServerItem 
            key={server.id} 
            server={server} 
          />
        ))}
      </div>

      <Separator className="w-10 my-4" />

      <Button 
        onClick={() => setShowNewServerDialog(true)}
        variant="ghost" 
        size="icon" 
        className="rounded-full h-12 w-12 text-primary bg-muted hover:bg-muted/80"
      >
        <PlusCircle className="h-6 w-6" />
      </Button>

      <NewServerDialog 
        open={showNewServerDialog} 
        onOpenChange={setShowNewServerDialog} 
      />
    </div>
  );
}