import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import GroupCard from "./GroupCard";

interface SearchGroupDialogProps {
  onGroupFound?: () => void;
}

const SearchGroupDialog = ({ onGroupFound }: SearchGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [foundGroup, setFoundGroup] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchCode.trim()) return;

    setLoading(true);
    try {
      // First, get the group basic information
      const { data: group, error } = await supabase
        .from("marup_groups")
        .select(`
          id,
          name,
          description,
          contribution_amount,
          max_members,
          group_code,
          active,
          owner_id
        `)
        .eq("group_code", searchCode.trim())
        .eq("active", true)
        .maybeSingle();

      if (error) throw error;

      if (group) {
        // Get member count
        const { count: memberCount } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        // Check if current user is a member
        const { data: membershipData } = await supabase
          .from("group_members")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        const enrichedGroup = {
          ...group,
          member_count: memberCount || 0,
          is_member: !!membershipData
        };

        setFoundGroup(enrichedGroup);
      } else {
        toast({
          title: "Group not found",
          description: "No active group found with that code",
          variant: "destructive",
        });
        setFoundGroup(null);
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewGroup = () => {
    if (!foundGroup) return;
    navigate(`/group/${foundGroup.id}`);
    setOpen(false);
    setFoundGroup(null);
    setSearchCode("");
  };

  const handleJoinRequest = async () => {
    if (!foundGroup) return;

    setRequestLoading(true);
    try {
      // Check if user already has a pending request
      const { data: existingRequest } = await supabase
        .from("join_requests")
        .select("id, status")
        .eq("group_id", foundGroup.id)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (existingRequest) {
        toast({
          title: "Request already exists",
          description: `You already have a ${existingRequest.status} request for this group`,
        });
        return;
      }

      // Create join request
      const { error } = await supabase
        .from("join_requests")
        .insert({
          group_id: foundGroup.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;

      toast({
        title: "Join request sent!",
        description: "The group owner will review your request",
      });

      setOpen(false);
      setFoundGroup(null);
      setSearchCode("");
      onGroupFound?.();
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Search className="h-4 w-4 mr-2" />
          Search Groups
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search for a Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupCode">Group Code</Label>
            <div className="flex gap-2">
              <Input
                id="groupCode"
                placeholder="Enter 6-digit group code"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                maxLength={6}
              />
              <Button 
                onClick={handleSearch} 
                disabled={loading || !searchCode.trim()}
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>

          {foundGroup && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold">{foundGroup.name}</h3>
                {foundGroup.description && (
                  <p className="text-sm text-muted-foreground">{foundGroup.description}</p>
                )}
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span>Rs {foundGroup.contribution_amount}/month</span>
                  <span>{foundGroup.member_count}/{foundGroup.max_members} members</span>
                </div>
              </div>
              
              {foundGroup.is_member ? (
                <Button 
                  onClick={handleViewGroup} 
                  className="w-full"
                >
                  View Group
                </Button>
              ) : (
                <Button 
                  onClick={handleJoinRequest} 
                  disabled={requestLoading}
                  className="w-full"
                >
                  {requestLoading ? "Sending Request..." : "Request to Join"}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchGroupDialog;