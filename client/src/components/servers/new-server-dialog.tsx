import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { insertServerSchema } from '@shared/schema';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

// Create a form validation schema based on the server schema
const formSchema = insertServerSchema.extend({
  icon: z.string().optional(),
});

type NewServerFormValues = z.infer<typeof formSchema>;

interface NewServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewServerDialog({ open, onOpenChange }: NewServerDialogProps) {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Form setup
  const form = useForm<NewServerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: '',
    },
  });

  // Server creation mutation
  const createServerMutation = useMutation({
    mutationFn: async (data: NewServerFormValues) => {
      const response = await apiRequest('/api/servers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate servers query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      
      toast({
        title: 'Server created!',
        description: `${data.name} has been created successfully.`,
      });
      
      // Reset form and close dialog
      form.reset();
      onOpenChange(false);
      
      // Navigate to the new server
      setLocation(`/servers/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Failed to create server',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: NewServerFormValues) => {
    createServerMutation.mutate(values);
  };

  // Handle avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 2MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create FormData for the upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload the image
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to upload image');

      const data = await response.json();
      const uploadedFile = Array.isArray(data) ? data[0] : data;
      
      // Set the icon URL in the form data
      form.setValue('icon', uploadedFile.url);
      
      // Show preview
      setAvatarPreview(uploadedFile.url);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload server icon. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a new server</DialogTitle>
          <DialogDescription>
            Create your own server to invite friends and start chatting!
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="text-lg bg-muted">
                    {form.watch('name') ? form.watch('name').substring(0, 2).toUpperCase() : 'S'}
                  </AvatarFallback>
                </Avatar>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0"
                  onClick={() => document.getElementById('server-icon')?.click()}
                >
                  +
                </Button>
                
                <Input
                  id="server-icon"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Server" {...field} />
                  </FormControl>
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
                    <Input placeholder="What's this server about?" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional description of your server
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
                disabled={createServerMutation.isPending}
              >
                {createServerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Server
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}