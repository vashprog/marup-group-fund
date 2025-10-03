import { useState } from "react";
import { Search, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ChatDialog from "@/components/ChatDialog";

interface UserProfile {
  id: string;
  full_name: string;
  user_id: string;
}

interface UserSearchDialogProps {
  onUserSelected?: (user: UserProfile) => void;
  mode?: 'profile' | 'message';
}

const UserSearchDialog = ({ onUserSelected, mode = 'profile' }: UserSearchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_profile_by_user_id', { target_user_id: searchQuery.trim().toUpperCase() });

      if (error) throw error;

      if (data && data.length > 0) {
        setSearchResult(data[0]);
      } else {
        setSearchResult(null);
        toast({
          title: "User not found",
          description: "No user found with this ID.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching user:", error);
      toast({
        title: "Search failed",
        description: "Failed to search for user.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = () => {
    if (searchResult) {
      if (mode === 'profile') {
        navigate(`/profile/${searchResult.user_id}`);
      } else {
        onUserSelected?.(searchResult);
      }
      setOpen(false);
      setSearchQuery("");
      setSearchResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Search className="h-4 w-4 mr-2" />
          Find User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search User by ID</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter user ID (e.g., A1B2C3D4)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
          
          {searchResult && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{searchResult.full_name}</h3>
                    <p className="text-sm text-muted-foreground">ID: {searchResult.user_id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUserSelect} variant="outline" size="sm">
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Button>
                    <ChatDialog
                      chatType="private"
                      targetId={searchResult.id}
                      targetName={searchResult.full_name}
                      trigger={
                        <Button size="sm">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSearchDialog;