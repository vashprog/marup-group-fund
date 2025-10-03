import { useEffect, useState } from "react";
import { Bell, X, Check, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface NotificationBarProps {
  onJoinRequestAction?: () => void;
}

const NotificationBar = ({ onJoinRequestAction }: NotificationBarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAll, setShowAll] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(showAll ? 50 : 5);

    if (error) {
      console.error("Error fetching notifications:", error);
      return;
    }

    setNotifications(data || []);
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, showAll]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Error marking notification as read:", error);
      return;
    }

    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const handleJoinRequest = async (notification: Notification, action: 'approve' | 'reject') => {
    const requestId = notification.data?.request_id;
    const requesterId = notification.data?.requester_id;
    const groupId = notification.data?.group_id;

    if (!requestId) return;

    try {
      // Update join request status
      const { error: requestError } = await supabase
        .from("join_requests")
        .update({ status: action === 'approve' ? 'approved' : 'rejected' })
        .eq("id", requestId);

      if (requestError) throw requestError;

      // If approved, add user to group
      if (action === 'approve') {
        const { error: memberError } = await supabase
          .from("group_members")
          .insert({ group_id: groupId, user_id: requesterId });

        if (memberError) throw memberError;
      }

      // Mark notification as read
      await markAsRead(notification.id);
      
      toast({
        title: `Join request ${action}d`,
        description: `You have ${action}d the join request.`,
      });

      onJoinRequestAction?.();
    } catch (error) {
      console.error(`Error ${action}ing join request:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} join request.`,
        variant: "destructive",
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'join_request':
        return <Users className="h-4 w-4" />;
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle className="text-lg">Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : 'Show All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-3 rounded-lg border ${
              notification.read ? 'bg-muted/30' : 'bg-primary/5 border-primary/20'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-2">
                {notification.type === 'join_request' && !notification.read && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleJoinRequest(notification, 'approve')}
                      className="h-8 px-3"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleJoinRequest(notification, 'reject')}
                      className="h-8 px-3"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                {!notification.read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markAsRead(notification.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default NotificationBar;