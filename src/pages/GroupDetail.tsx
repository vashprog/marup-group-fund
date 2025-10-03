import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, DollarSign, Calendar, Trophy, Plus, MessageSquare, User } from "lucide-react";
import ChatDialog from "@/components/ChatDialog";
import { PaymentDialog } from "@/components/PaymentDialog";

interface GroupData {
  id: string;
  name: string;
  description?: string;
  contribution_amount: number;
  max_members: number;
  owner_id: string;
  active: boolean;
}

interface Member {
  id: string;
  user_id: string;
  has_won: boolean;
  profiles: {
    full_name: string;
    user_id: string;
  };
}

interface Round {
  id: string;
  round_number: number;
  due_date: string;
  completed: boolean;
  total_amount?: number;
  winner_user_id?: string;
  winner_profile?: {
    full_name: string;
  };
}

interface Contribution {
  id: string;
  amount: number;
  contributed_at: string;
  user_id: string;
  profiles: {
    full_name: string;
  };
}

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [contributionAmount, setContributionAmount] = useState("");
  const [submittingContribution, setSubmittingContribution] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);

  const isMember = members.some(member => member.user_id === user?.id);
  const isOwner = group?.owner_id === user?.id;
  const hasContributed = currentRound && contributions.some(
    contrib => contrib.user_id === user?.id
  );

  const fetchGroupData = async () => {
    if (!id || !user) return;

    try {
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from("marup_groups")
        .select("*")
        .eq("id", id)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", id);

      if (membersError) throw membersError;

      // Fetch profiles for members
      const userIds = membersData?.map(member => member.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .in("id", userIds);

      // Combine members with profiles
      const membersWithProfiles = membersData?.map(member => ({
        ...member,
        profiles: profilesData?.find(profile => profile.id === member.user_id) || { full_name: "Unknown", user_id: "" }
      })) || [];

      setMembers(membersWithProfiles);

      // Fetch rounds
      const { data: roundsData, error: roundsError } = await supabase
        .from("group_rounds")
        .select("*")
        .eq("group_id", id)
        .order("round_number", { ascending: false });

      if (roundsError) throw roundsError;

      // Fetch winner profiles for completed rounds
      const winnerIds = roundsData?.filter(round => round.winner_user_id).map(round => round.winner_user_id) || [];
      const { data: winnerProfilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", winnerIds);

      // Combine rounds with winner profiles
      const roundsWithProfiles = roundsData?.map(round => ({
        ...round,
        winner_profile: round.winner_user_id 
          ? winnerProfilesData?.find(profile => profile.id === round.winner_user_id) 
          : null
      })) || [];

      setRounds(roundsWithProfiles);

      // Find current active round
      const activeRound = roundsWithProfiles?.find(round => !round.completed);
      setCurrentRound(activeRound || null);

      // Fetch contributions for current round
      if (activeRound) {
        const { data: contributionsData, error: contributionsError } = await supabase
          .from("contributions")
          .select("*")
          .eq("round_id", activeRound.id);

        if (contributionsError) throw contributionsError;

        // Fetch profiles for contributors
        const contributorIds = contributionsData?.map(contrib => contrib.user_id) || [];
        const { data: contributorProfilesData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", contributorIds);

        // Combine contributions with profiles
        const contributionsWithProfiles = contributionsData?.map(contrib => ({
          ...contrib,
          profiles: contributorProfilesData?.find(profile => profile.id === contrib.user_id) || { full_name: "Unknown" }
        })) || [];

        setContributions(contributionsWithProfiles);
      }

      // Set default contribution amount
      setContributionAmount(groupData.contribution_amount.toString());
    } catch (error: any) {
      toast({
        title: "Error loading group",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [id, user]);

  const handleJoinGroup = async () => {
    if (!group || !user) return;

    setJoiningGroup(true);
    try {
      const { error } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Joined group successfully!",
        description: "Welcome to the group!",
      });

      fetchGroupData();
    } catch (error: any) {
      toast({
        title: "Error joining group",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setJoiningGroup(false);
    }
  };

  const handleContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRound || !user || !group) return;

    setSubmittingContribution(true);
    try {
      const { error } = await supabase
        .from("contributions")
        .insert({
          group_id: group.id,
          round_id: currentRound.id,
          user_id: user.id,
          amount: parseFloat(contributionAmount),
        });

      if (error) throw error;

      toast({
        title: "Contribution submitted!",
        description: `You've contributed Rs ${contributionAmount} for this round.`,
      });

      fetchGroupData();
    } catch (error: any) {
      toast({
        title: "Error submitting contribution",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingContribution(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Group not found</h1>
          <Button onClick={() => navigate("/")}>Go Back Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/10">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Groups
            </Button>
            {isMember && (
              <ChatDialog
                chatType="group"
                targetId={id!}
                targetName={group?.name || "Group Chat"}
              />
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{group.name}</h1>
              {group.description && (
                <p className="text-muted-foreground mt-2">{group.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              {isOwner && <Badge variant="default">Owner</Badge>}
              {isMember && !isOwner && <Badge variant="secondary">Member</Badge>}
              {!group.active && <Badge variant="destructive">Inactive</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Group Info & Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Group Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                  <p className="text-2xl font-bold text-primary">Rs {group.contribution_amount}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Members</p>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{members.length}/{group.max_members}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={group.active ? "default" : "destructive"}>
                      {group.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                {isMember && (
                  <PaymentDialog 
                    groupId={group.id} 
                    contributionAmount={group.contribution_amount} 
                    groupName={group.name} 
                  />
                )}
              </CardContent>
            </Card>

            {/* Join Group Button */}
            {!isMember && members.length < group.max_members && (
              <Card>
                <CardHeader>
                  <CardTitle>Join Group</CardTitle>
                  <CardDescription>
                    Join this group to participate in the rotating savings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleJoinGroup} disabled={joiningGroup} className="w-full">
                    {joiningGroup ? "Joining..." : "Join Group"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Contribution Form */}
            {isMember && currentRound && !hasContributed && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Make Contribution
                  </CardTitle>
                  <CardDescription>
                    Contribute for Round #{currentRound.round_number}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleContribution} className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount (Rs)</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={submittingContribution} className="w-full">
                      {submittingContribution ? "Contributing..." : "Contribute"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Current Round Status */}
            {currentRound && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Current Round
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Round Number</p>
                    <p className="font-semibold">#{currentRound.round_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-semibold">
                      {new Date(currentRound.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contributors</p>
                    <p className="font-semibold">{contributions.length}/{members.length}</p>
                  </div>
                  {hasContributed && (
                    <Badge variant="default" className="w-full justify-center">
                      You've contributed!
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Members & Contributions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Members List */}
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>All group members and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Has Won This Cycle</TableHead>
                      {isMember && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.profiles.full_name}
                          {member.user_id === group.owner_id && (
                            <Badge variant="outline" className="ml-2">Owner</Badge>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            ID: {member.profiles.user_id}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
                        </TableCell>
                        <TableCell>
                          {member.has_won ? (
                            <Badge variant="secondary">
                              <Trophy className="h-3 w-3 mr-1" />
                              Won
                            </Badge>
                          ) : (
                            <Badge variant="outline">Eligible</Badge>
                          )}
                        </TableCell>
                        {isMember && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/profile/${member.profiles.user_id}`)}
                              >
                                <User className="h-3 w-3 mr-1" />
                                Profile
                              </Button>
                              {member.user_id !== user?.id && (
                                <ChatDialog
                                  chatType="private"
                                  targetId={member.user_id}
                                  targetName={member.profiles.full_name}
                                  trigger={
                                    <Button variant="outline" size="sm">
                                      <MessageSquare className="h-3 w-3 mr-1" />
                                      Message
                                    </Button>
                                  }
                                />
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Current Round Contributions */}
            {currentRound && contributions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Current Round Contributions</CardTitle>
                  <CardDescription>
                    Contributions for Round #{currentRound.round_number}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contributions.map((contribution) => (
                        <TableRow key={contribution.id}>
                          <TableCell className="font-medium">
                            {contribution.profiles.full_name}
                          </TableCell>
                          <TableCell>Rs {contribution.amount}</TableCell>
                          <TableCell>
                            {new Date(contribution.contributed_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Past Rounds */}
            {rounds.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Round History</CardTitle>
                  <CardDescription>Previous rounds and winners</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Round</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Winner</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rounds.map((round) => (
                        <TableRow key={round.id}>
                          <TableCell>#{round.round_number}</TableCell>
                          <TableCell>
                            {new Date(round.due_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {round.winner_profile?.full_name || "-"}
                          </TableCell>
                          <TableCell>
                            {round.total_amount ? `Rs ${round.total_amount}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={round.completed ? "default" : "secondary"}>
                              {round.completed ? "Completed" : "Active"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;