import { useState, useEffect, useRef } from "react";
import { Send, MessageSquare, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_profile?: {
    full_name: string;
    user_id: string;
  };
}

interface ChatDialogProps {
  chatType: 'group' | 'private';
  targetId: string; // group_id for group chat, user_id for private chat
  targetName: string;
  trigger?: React.ReactNode;
}

const ChatDialog = ({ chatType, targetId, targetName, trigger }: ChatDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!user) return;

    let query = supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (chatType === 'group') {
      query = query.eq('group_id', targetId);
    } else {
      query = query.or(`and(sender_id.eq.${user.id},recipient_id.eq.${targetId}),and(sender_id.eq.${targetId},recipient_id.eq.${user.id})`);
    }

    const { data: messagesData, error } = await query;

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    // Fetch sender profiles separately
    const senderIds = messagesData?.map(msg => msg.sender_id).filter((id, index, arr) => arr.indexOf(id) === index) || [];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, user_id")
      .in("id", senderIds);

    // Combine messages with profiles
    const messagesWithProfiles = messagesData?.map(message => ({
      ...message,
      sender_profile: profilesData?.find(profile => profile.id === message.sender_id) || null
    })) || [];

    setMessages(messagesWithProfiles);
  };

  useEffect(() => {
    if (open && user) {
      fetchMessages();
    }
  }, [open, user, targetId, chatType]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return;

    setLoading(true);
    try {
      const messageData = {
        sender_id: user.id,
        content: newMessage.trim(),
        ...(chatType === 'group' 
          ? { group_id: targetId }
          : { recipient_id: targetId }
        )
      };

      const { error } = await supabase
        .from("messages")
        .insert(messageData);

      if (error) throw error;

      setNewMessage("");
      await fetchMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAllMessages = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to delete all messages in this conversation? This action cannot be undone.")) return;

    try {
      let deleteQuery = supabase.from("messages").delete();
      
      if (chatType === 'group') {
        deleteQuery = deleteQuery.eq('group_id', targetId);
      } else {
        deleteQuery = deleteQuery.or(`and(sender_id.eq.${user.id},recipient_id.eq.${targetId}),and(sender_id.eq.${targetId},recipient_id.eq.${user.id})`);
      }

      const { error } = await deleteQuery;
      
      if (error) throw error;

      toast({
        title: "Messages deleted",
        description: "All messages have been removed from this conversation.",
      });
      
      await fetchMessages();
    } catch (error) {
      console.error("Error deleting messages:", error);
      toast({
        title: "Failed to delete messages",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      {chatType === 'group' ? (
        <Users className="h-4 w-4 mr-2" />
      ) : (
        <MessageSquare className="h-4 w-4 mr-2" />
      )}
      {chatType === 'group' ? 'Group Chat' : 'Message'}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md h-[500px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {chatType === 'group' ? (
                <Users className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
              {targetName}
              <Badge variant="outline">
                {chatType === 'group' ? 'Group' : 'Private'}
              </Badge>
            </div>
            {chatType === 'private' && messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteAllMessages}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {chatType === 'group' && message.sender_id !== user?.id && (
                      <p className="text-xs opacity-70 mb-1">
                        {message.sender_profile?.full_name}
                      </p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatDialog;