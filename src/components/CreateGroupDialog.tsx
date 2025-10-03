import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateGroupDialogProps {
  onGroupCreated: () => void;
}

const CreateGroupDialog = ({ onGroupCreated }: CreateGroupDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    contributionAmount: "",
    maxMembers: "",
    durationMonths: "12"
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("marup_groups")
        .insert({
          name: formData.name,
          description: formData.description || null,
          contribution_amount: parseFloat(formData.contributionAmount),
          max_members: parseInt(formData.maxMembers),
          duration_months: parseInt(formData.durationMonths),
          owner_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Group created successfully!",
        description: "You can now invite friends to join your group.",
      });

      setOpen(false);
      setFormData({
        name: "",
        description: "",
        contributionAmount: "",
        maxMembers: "",
        durationMonths: "12"
      });
      onGroupCreated();
    } catch (error: any) {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Marup Group</DialogTitle>
          <DialogDescription>
            Set up a new rotating savings group with your friends.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Friends Savings Circle"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of the group purpose"
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contributionAmount">Monthly Amount (Rs) *</Label>
              <Input
                id="contributionAmount"
                type="number"
                min="1"
                step="0.01"
                value={formData.contributionAmount}
                onChange={(e) => setFormData({ ...formData, contributionAmount: e.target.value })}
                placeholder="1000"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxMembers">Max Members *</Label>
              <Input
                id="maxMembers"
                type="number"
                min="2"
                max="20"
                value={formData.maxMembers}
                onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
                placeholder="5"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="durationMonths">Duration (Months) *</Label>
            <Input
              id="durationMonths"
              type="number"
              min="1"
              max="60"
              value={formData.durationMonths}
              onChange={(e) => setFormData({ ...formData, durationMonths: e.target.value })}
              placeholder="12"
              required
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;