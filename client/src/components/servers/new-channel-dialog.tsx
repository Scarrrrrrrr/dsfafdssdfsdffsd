import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertChannelSchema } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

// Create a form validation schema based on the channel schema
const formSchema = insertChannelSchema
  .omit({ serverId: true, position: true })
  .extend({
    type: z.enum(['text', 'voice', 'announcement']),
  });

type NewChannelFormValues = z.infer<typeof formSchema>;

interface NewChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
}

export function NewChannelDialog({ open, onOpenChange, serverId }: NewChannelDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<NewChannelFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'text',
    },
  });

  // Channel creation mutation
  const createChannelMutation = useMutation({
    mutationFn: async (data: NewChannelFormValues) => {
      const response = await apiRequest(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate server query to refresh the channel list
      queryClient.invalidateQueries({ queryKey: ['/api/servers', serverId.toString()] });
      
      toast({
        title: 'Channel created!',
        description: `${data.name} has been created successfully.`,
      });
      
      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Failed to create channel',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: NewChannelFormValues) => {
    createChannelMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a new channel</DialogTitle>
          <DialogDescription>
            Add a new channel to your server for specific topics or discussions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="text">Text Channel</SelectItem>
                      <SelectItem value="voice">Voice Channel</SelectItem>
                      <SelectItem value="announcement">Announcement Channel</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the type of channel you want to create
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={
                        form.watch('type') === 'text' ? 'general-discussion' : 
                        form.watch('type') === 'voice' ? 'voice-chat' : 
                        'announcements'
                      } 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Channel names cannot contain spaces (use hyphens instead)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="What's this channel about?" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional description of your channel
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createChannelMutation.isPending}
              >
                {createChannelMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}