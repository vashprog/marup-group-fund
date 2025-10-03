import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, MessageSquare, Phone, Mail } from "lucide-react";
import ChatDialog from "@/components/ChatDialog";

interface ProfileData {
  id: string;
  full_name: string;
  user_id: string;
  phone?: string;
  created_at: string;
}

interface GroupMembership {
  id: string;
  group_id: string;
  group_name: string;
  is_owner: boolean;
}

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = profile?.id === user?.id;

  const fetchProfile = async () => {
    if (!userId) return;

    try {
      // Fetch profile by user_id
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          toast({
            title: "Profile not found",
            description: "No user found with this ID.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }
        throw profileError;
      }

      setProfile(profileData);

      // Fetch groups this user is part of
      const { data: membershipData, error: membershipError } = await supabase
        .from("group_members")
        .select(`
          id,
          group_id,
          marup_groups!inner(name, owner_id)
        `)
        .eq("user_id", profileData.id);

      if (membershipError) throw membershipError;

      const groupsWithOwnership = membershipData?.map(membership => ({
        id: membership.id,
        group_id: membership.group_id,
        group_name: membership.marup_groups.name,
        is_owner: membership.marup_groups.owner_id === profileData.id
      })) || [];

      setGroups(groupsWithOwnership);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile not found</h1>
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
              Back
            </Button>
            {!isOwnProfile && user && (
              <ChatDialog
                chatType="private"
                targetId={profile.id}
                targetName={profile.full_name}
                trigger={
                  <Button>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                }
              />
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{profile.full_name}</h1>
              <p className="text-muted-foreground">ID: {profile.user_id}</p>
              {isOwnProfile && <Badge variant="outline" className="mt-2">Your Profile</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{profile.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-medium font-mono">{profile.user_id}</p>
              </div>
              {profile.phone && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone
                  </p>
                  <p className="font-medium">{profile.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Group Memberships */}
          <Card>
            <CardHeader>
              <CardTitle>Group Memberships</CardTitle>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-muted-foreground">Not a member of any groups yet.</p>
              ) : (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{group.group_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={group.is_owner ? "default" : "secondary"}>
                            {group.is_owner ? "Owner" : "Member"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/group/${group.group_id}`)}
                      >
                        View Group
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;