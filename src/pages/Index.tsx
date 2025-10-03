import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GroupCard from "@/components/GroupCard";
import CreateGroupDialog from "@/components/CreateGroupDialog";
import SearchGroupDialog from "@/components/SearchGroupDialog";
import NotificationBar from "@/components/NotificationBar";
import UserSearchDialog from "@/components/UserSearchDialog";
import ChatDialog from "@/components/ChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Wallet, MessageSquare } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description?: string;
  contribution_amount: number;
  max_members: number;
  owner_id: string;
  active: boolean;
  member_count: number;
  is_member: boolean;
  next_due_date?: string;
  group_code?: string;
  duration_months?: number;
}

const Index = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const navigate = useNavigate();

  const fetchUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }

    setUserProfile(data);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchGroups = async () => {
    if (!user) return;

    try {
      // Fetch groups with member counts
      const { data: groupsData, error } = await supabase
        .from("marup_groups")
        .select(`
          *,
          group_members(user_id),
          group_rounds(due_date, completed)
        `)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Process groups to add member count and membership status
      const processedGroups = groupsData?.map(group => {
        const memberCount = group.group_members?.length || 0;
        const isMember = group.group_members?.some((member: any) => member.user_id === user.id) || false;
        
        // Find next due date from active rounds
        const nextRound = group.group_rounds?.find((round: any) => !round.completed);
        const nextDueDate = nextRound?.due_date 
          ? new Date(nextRound.due_date).toLocaleDateString()
          : undefined;

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          contribution_amount: group.contribution_amount,
          max_members: group.max_members,
          owner_id: group.owner_id,
          active: group.active,
          member_count: memberCount,
          is_member: isMember,
          next_due_date: nextDueDate,
          group_code: group.group_code,
          duration_months: group.duration_months
        };
      }) || [];

      setGroups(processedGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroups();
      fetchUserProfile();
    }
  }, [user]);

  const handleUserSelected = (selectedUser: any) => {
    // This will be handled by the ChatDialog
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const myGroups = groups.filter(group => group.is_member);
  const availableGroups = groups.filter(group => !group.is_member && group.member_count < group.max_members);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/10">
      <header className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">Marup</h1>
                <p className="text-sm text-muted-foreground">Rotating Savings Groups</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{user.user_metadata?.full_name || user.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Member</Badge>
                  {userProfile?.user_id && (
                    <Badge variant="secondary">ID: {userProfile.user_id}</Badge>
                  )}
                </div>
              </div>
              <UserSearchDialog onUserSelected={handleUserSelected} />
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <NotificationBar onJoinRequestAction={fetchGroups} />
        <div className="space-y-8">
          {/* My Groups Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">My Groups</h2>
                <p className="text-muted-foreground">Groups you're a member of</p>
              </div>
              <div className="flex gap-2">
                <SearchGroupDialog onGroupFound={fetchGroups} />
                <CreateGroupDialog onGroupCreated={fetchGroups} />
              </div>
            </div>
            
            {myGroups.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No Groups Yet</CardTitle>
                  <CardDescription>
                    Create your first group or join an existing one to get started!
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    id={group.id}
                    name={group.name}
                    description={group.description}
                    contributionAmount={group.contribution_amount}
                    maxMembers={group.max_members}
                    currentMembers={group.member_count}
                    isOwner={group.owner_id === user.id}
                    isMember={true}
                    active={group.active}
                    nextDueDate={group.next_due_date}
                    groupCode={group.group_code}
                    durationMonths={group.duration_months}
                    onGroupDeleted={fetchGroups}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Available Groups Section */}
          {availableGroups.length > 0 && (
            <section>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">Available Groups</h2>
                <p className="text-muted-foreground">Groups you can join</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    id={group.id}
                    name={group.name}
                    description={group.description}
                    contributionAmount={group.contribution_amount}
                    maxMembers={group.max_members}
                    currentMembers={group.member_count}
                    isOwner={false}
                    isMember={false}
                    active={group.active}
                    groupCode={group.group_code}
                    durationMonths={group.duration_months}
                    onGroupDeleted={fetchGroups}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
