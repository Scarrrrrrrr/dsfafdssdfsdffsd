import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Loader2, 
  RefreshCw, 
  Trash2, 
  UserX, 
  BarChart3, 
  MessageSquare, 
  Users, 
  UserCog, 
  Bell, 
  ShieldAlert, 
  Settings, 
  Database, 
  Activity,
  Lock,
  Eye,
  EyeOff,
  Search,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { User, Conversation, Message } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Check if current user is admin (for this implementation, we'll use user ID 1 as admin)
  const isAdmin = user?.id === 1;

  // Query to get all users
  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  // Mutation to reset users database
  const resetUsersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/reset-users");
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "Database Reset",
        description: "All users have been removed. New registration will be required.",
        variant: "default",
      });
      refetchUsers();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to reset database: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a specific user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return response.ok;
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "The user has been deleted successfully.",
        variant: "default",
      });
      refetchUsers();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to ban a user
  const [banReason, setBanReason] = useState("");
  const banUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number, reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/ban`, { reason });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Banned",
        description: "The user has been banned successfully.",
        variant: "default",
      });
      setBanReason("");
      refetchUsers();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ban user: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to unban a user
  const unbanUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/unban`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Unbanned",
        description: "The user has been unbanned successfully.",
        variant: "default",
      });
      refetchUsers();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to unban user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Admin Access</h1>
          <p className="text-muted-foreground mb-6">You need to log in to access this page.</p>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have permission to access the admin panel.</p>
        </Card>
      </div>
    );
  }

  // Additional state for various features
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Query to get system stats (would need backend endpoints)
  const { data: systemStats = {
    totalUsers: users.length,
    totalMessages: 0,
    totalConversations: 0,
    activeUsers: users.filter(u => u.isOnline).length,
    bannedUsers: users.filter(u => u.isBanned).length
  }} = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    enabled: false, // Disabled until we implement the endpoint
  });

  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate mock statistics for dashboard visualization
  const getRandomStat = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const activityData = Array.from({ length: 7 }, (_, i) => ({
    day: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
    messages: getRandomStat(10, 50),
    users: getRandomStat(5, 15)
  }));

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive control panel for system management</p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Back to App
        </Button>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="dashboard" className="mb-8" onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="dashboard" className="flex items-center">
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center">
            <MessageSquare className="mr-2 h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center">
            <ShieldAlert className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center">
            <Database className="mr-2 h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Users</p>
                  <h3 className="text-3xl font-bold">{systemStats.totalUsers}</h3>
                </div>
                <Users className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <div className="mt-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <Activity className="h-3 w-3 mr-1" />
                  {systemStats.activeUsers} active
                </Badge>
              </div>
            </Card>
            
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Messages</p>
                  <h3 className="text-3xl font-bold">{systemStats.totalMessages}</h3>
                </div>
                <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Last 24 hours: {getRandomStat(5, 30)}</p>
              </div>
            </Card>
            
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Conversations</p>
                  <h3 className="text-3xl font-bold">{systemStats.totalConversations}</h3>
                </div>
                <Users className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Active today: {getRandomStat(1, 10)}</p>
              </div>
            </Card>
            
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Banned Users</p>
                  <h3 className="text-3xl font-bold">{systemStats.bannedUsers}</h3>
                </div>
                <Lock className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {Math.round((systemStats.bannedUsers / (systemStats.totalUsers || 1)) * 100)}% of all users
                </p>
              </div>
            </Card>
          </div>
          
          {/* Activity Chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Activity Overview</h3>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-3 w-3 mr-2" />
                Refresh
              </Button>
            </div>
            
            <div className="h-[350px] border-t pt-4">
              <div className="grid grid-cols-7 h-full gap-2">
                {activityData.map((data, index) => (
                  <div key={index} className="flex flex-col h-full justify-end">
                    <div className="text-center text-xs text-muted-foreground mb-2">{data.day}</div>
                    <div className="flex-1 flex flex-col justify-end space-y-1">
                      <div
                        className="bg-primary/30 w-full rounded-sm"
                        style={{ height: `${data.messages}%` }}
                        title={`${data.messages} messages`}
                      ></div>
                      <div
                        className="bg-primary w-full rounded-sm"
                        style={{ height: `${data.users * 3}%` }}
                        title={`${data.users} users`}
                      ></div>
                    </div>
                    <div className="text-center text-xs font-medium mt-2">
                      {data.messages}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center mt-4 space-x-4">
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-sm bg-primary mr-2"></div>
                  <span className="text-sm">Active Users</span>
                </div>
                <div className="flex items-center">
                  <div className="h-3 w-3 rounded-sm bg-primary/30 mr-2"></div>
                  <span className="text-sm">Messages Sent</span>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Recent Activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Recent Activity</h3>
            </div>
            
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-md bg-muted/50">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    index % 3 === 0 ? 'bg-blue-500/20 text-blue-500' : 
                    index % 3 === 1 ? 'bg-green-500/20 text-green-500' : 
                    'bg-orange-500/20 text-orange-500'
                  }`}>
                    {index % 3 === 0 ? <UserCog className="h-4 w-4" /> : 
                     index % 3 === 1 ? <MessageSquare className="h-4 w-4" /> : 
                     <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {index % 3 === 0 ? 'User logged in' : 
                       index % 3 === 1 ? 'New message sent' : 
                       'New notification'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {index % 3 === 0 ? `User #${index + 1} logged in from new device` : 
                       index % 3 === 1 ? `User #${index + 2} sent a message in conversation #${index + 1}` : 
                       `System notification sent to ${index + 3} users`}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(Date.now() - index * 20 * 60000).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">User Management</h3>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-60"
                  prefix={<Search className="h-4 w-4 text-muted-foreground mr-2" />}
                />
                <Button variant="outline" onClick={() => refetchUsers()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
            
            {isLoadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Profile</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} className="hover:bg-muted/50">
                          <TableCell>{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.displayName}</TableCell>
                          <TableCell>
                            {user.isBanned ? (
                              <Badge variant="destructive" className="font-normal">
                                Banned
                              </Badge>
                            ) : user.isOnline ? (
                              <Badge variant="default" className="font-normal bg-green-500">
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="font-normal">
                                Offline
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-2 py-0 text-xs"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              {/* Ban/Unban User Button */}
                              {user.id !== 1 && (
                                user.isBanned ? (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2 py-0 text-xs"
                                      >
                                        Unban
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Unban User</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to unban this user?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={(e) => {
                                            e.preventDefault();
                                            unbanUserMutation.mutate(user.id);
                                          }}
                                        >
                                          Unban User
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                ) : (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2 py-0 text-xs text-red-500 border-red-500 hover:bg-red-500/10"
                                      >
                                        Ban
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Ban User</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          <p className="mb-4">Enter a reason for banning this user:</p>
                                          <input
                                            type="text"
                                            value={banReason}
                                            onChange={(e) => setBanReason(e.target.value)}
                                            placeholder="Reason for ban"
                                            className="w-full p-2 border rounded-md"
                                          />
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={(e) => {
                                            e.preventDefault();
                                            banUserMutation.mutate({
                                              userId: user.id,
                                              reason: banReason || "No reason provided"
                                            });
                                          }}
                                        >
                                          Ban User
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )
                              )}
                              
                              {/* Delete User Button */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    disabled={user.id === 1} // Don't allow deleting the admin
                                  >
                                    <UserX className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this user? This will remove all their data including conversations and messages.
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        deleteUserMutation.mutate(user.id);
                                      }}
                                    >
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
          
          {/* User Profile Dialog */}
          {selectedUser && (
            <AlertDialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
              <AlertDialogContent className="max-w-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>User Profile</AlertDialogTitle>
                </AlertDialogHeader>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1 flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {selectedUser.avatar ? (
                        <img src={selectedUser.avatar} alt="User avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-4xl font-bold text-muted-foreground">
                          {selectedUser.displayName.charAt(0)}
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-bold mt-4">{selectedUser.displayName}</h3>
                    <p className="text-muted-foreground">@{selectedUser.username}</p>
                    
                    <div className="mt-6 w-full">
                      <Badge className="w-full justify-center py-1" variant={selectedUser.isOnline ? "default" : "secondary"}>
                        {selectedUser.isOnline ? "Online" : "Offline"}
                      </Badge>
                      
                      {selectedUser.isBanned && (
                        <Badge className="w-full justify-center py-1 mt-2" variant="destructive">
                          Banned
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-2 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Bio</h4>
                      <p className="text-sm">{selectedUser.bio || "No bio provided"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Pronouns</h4>
                      <p className="text-sm">{selectedUser.pronouns || "Not specified"}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">User ID</h4>
                      <p className="text-sm">{selectedUser.id}</p>
                    </div>
                    
                    {selectedUser.isBanned && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Ban Reason</h4>
                        <p className="text-sm bg-destructive/10 p-2 rounded">{selectedUser.banReason || "No reason provided"}</p>
                      </div>
                    )}
                    
                    <div className="pt-4">
                      <h4 className="text-sm font-medium mb-2">User Activity</h4>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Messages Sent</span>
                            <span>{getRandomStat(10, 500)}</span>
                          </div>
                          <Progress value={getRandomStat(10, 100)} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Conversations</span>
                            <span>{getRandomStat(1, 20)}</span>
                          </div>
                          <Progress value={getRandomStat(10, 100)} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Last Active</span>
                            <span>{new Date().toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <AlertDialogFooter>
                  <AlertDialogCancel>Close</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Message Management</h3>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search messages..."
                  className="w-60"
                  prefix={<Search className="h-4 w-4 text-muted-foreground mr-2" />}
                />
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Total Messages</h4>
                  </div>
                  <p className="text-2xl font-bold">{getRandomStat(100, 2000)}</p>
                </Card>
                
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">With Attachments</h4>
                  </div>
                  <p className="text-2xl font-bold">{getRandomStat(10, 200)}</p>
                </Card>
                
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Today</h4>
                  </div>
                  <p className="text-2xl font-bold">{getRandomStat(5, 50)}</p>
                </Card>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span>User {index + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        This is a sample message content that might be pretty long and needs to be truncated...
                      </TableCell>
                      <TableCell>{new Date().toLocaleTimeString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Security Dashboard</h3>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Active Bans</h4>
                  </div>
                  <p className="text-2xl font-bold">{systemStats.bannedUsers}</p>
                </Card>
                
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <Lock className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Failed Logins (24h)</h4>
                  </div>
                  <p className="text-2xl font-bold">{getRandomStat(0, 15)}</p>
                </Card>
                
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <EyeOff className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Hidden Messages</h4>
                  </div>
                  <p className="text-2xl font-bold">{getRandomStat(0, 10)}</p>
                </Card>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Banned Users</h4>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter(u => u.isBanned).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                          No banned users
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.filter(u => u.isBanned).map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                {user.displayName.charAt(0)}
                              </div>
                              <div>
                                <div>{user.displayName}</div>
                                <div className="text-xs text-muted-foreground">@{user.username}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.banReason || "No reason provided"}</TableCell>
                          <TableCell>Unknown</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 py-0 text-xs"
                              onClick={() => unbanUserMutation.mutate(user.id)}
                            >
                              Unban
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">System Management</h3>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-4">Database Operations</h4>
                  <div className="space-y-4">
                    <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Reset User Database
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset User Database</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete ALL users from the database. Users will need to create new accounts.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={(e) => {
                              e.preventDefault();
                              resetUsersMutation.mutate();
                              setIsResetConfirmOpen(false);
                            }}
                          >
                            {resetUsersMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Resetting...
                              </>
                            ) : (
                              "Reset Database"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <Button variant="outline" className="w-full">
                      <Database className="h-4 w-4 mr-2" />
                      Backup Database
                    </Button>
                    
                    <Button variant="outline" className="w-full">
                      <Settings className="h-4 w-4 mr-2" />
                      Clear Message Cache
                    </Button>
                  </div>
                </Card>
                
                <Card className="p-4">
                  <h4 className="font-medium mb-4">System Status</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU Usage</span>
                        <span>{getRandomStat(10, 80)}%</span>
                      </div>
                      <Progress value={getRandomStat(10, 80)} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory Usage</span>
                        <span>{getRandomStat(20, 90)}%</span>
                      </div>
                      <Progress value={getRandomStat(20, 90)} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Storage Usage</span>
                        <span>{getRandomStat(5, 60)}%</span>
                      </div>
                      <Progress value={getRandomStat(5, 60)} className="h-2" />
                    </div>
                    
                    <div className="pt-2">
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                        <Activity className="h-3 w-3 mr-1" />
                        System Healthy
                      </Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}