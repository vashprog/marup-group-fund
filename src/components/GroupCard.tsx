import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ChatDialog from "./ChatDialog";
import { PaymentDialog } from "./PaymentDialog";
import { Copy, Eye, Users, Trash2, DollarSign, Calendar, Share2 } from "lucide-react";

interface GroupCardProps {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  maxMembers: number;
  currentMembers: number;
  isOwner: boolean;
  isMember: boolean;
  active: boolean;
  nextDueDate?: string;
  groupCode?: string;
  durationMonths?: number;
  onGroupDeleted?: () => void;
}

const GroupCard = ({
  id,
  name,
  description,
  contributionAmount,
  maxMembers,
  currentMembers,
  isOwner,
  isMember,
  active,
  nextDueDate,
  groupCode,
  durationMonths,
  onGroupDeleted
}: GroupCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleViewGroup = () => {
    navigate(`/group/${id}`);
  };

  const handleShareGroup = () => {
    if (groupCode) {
      navigator.clipboard.writeText(groupCode);
      toast({
        title: "Group code copied!",
        description: "Share this code with others to let them join your group.",
      });
    }
  };

  const handleJoinGroup = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('create_join_request', { target_group_id: id });

      if (error) throw error;

      if (data && typeof data === 'object' && 'success' in data && data.success) {
        toast({
          title: "Join request sent!",
          description: "The group owner will be notified of your request.",
        });
      } else {
        const errorMsg = (data && typeof data === 'object' && 'error' in data) ? data.error as string : "Please try again.";
        toast({
          title: "Failed to send request",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sending join request:", error);
      toast({
        title: "Error",
        description: "Failed to send join request.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!user || !isOwner) return;
    
    if (!confirm("Are you sure you want to delete this group? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("marup_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Group deleted",
        description: "The group has been successfully deleted.",
      });

      onGroupDeleted?.();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast({
        title: "Error",
        description: "Failed to delete group.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow w-full max-w-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{name}</CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {isOwner && <Badge variant="secondary">Owner</Badge>}
            {isMember && !isOwner && <Badge variant="outline">Member</Badge>}
            {!active && <Badge variant="destructive">Inactive</Badge>}
            {groupCode && <Badge variant="outline" className="font-mono">#{groupCode}</Badge>}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Monthly Contribution</span>
          <span className="font-bold text-primary">Rs {contributionAmount}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Members</span>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currentMembers}/{maxMembers}</span>
          </div>
        </div>

        {durationMonths && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Duration</span>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{durationMonths} months</span>
            </div>
          </div>
        )}

        {nextDueDate && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Next Due Date</span>
            <span className="font-medium">{nextDueDate}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2 flex-wrap">
          {isMember ? (
            <>
              <Button onClick={handleViewGroup} className="flex-1 min-w-32">
                <Eye className="h-4 w-4 mr-2" />
                View Group
              </Button>
              <PaymentDialog 
                groupId={id} 
                contributionAmount={contributionAmount} 
                groupName={name} 
              />
              <ChatDialog
                chatType="group"
                targetId={id}
                targetName={name}
              />
            </>
          ) : (
            <Button onClick={handleJoinGroup} className="flex-1 min-w-48">
              Send Join Request
            </Button>
          )}
          
          {isOwner && groupCode && (
            <Button 
              variant="outline" 
              onClick={handleShareGroup}
              size="icon"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}

          {isOwner && (
            <Button 
              variant="outline" 
              onClick={handleDeleteGroup}
              size="icon"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupCard;