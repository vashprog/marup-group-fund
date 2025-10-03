import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, DollarSign, Calendar, History, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface PaymentDialogProps {
  groupId: string;
  contributionAmount: number;
  groupName: string;
}

export const PaymentDialog = ({ groupId, contributionAmount, groupName }: PaymentDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Fetch payment history
  const { data: payments, isLoading } = useQuery({
    queryKey: ["group-payments", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          group_id,
          user_id,
          stripe_session_id,
          stripe_subscription_id,
          amount,
          payment_month,
          payment_year,
          status,
          payment_date,
          created_at,
          updated_at
        `)
        .eq("group_id", groupId)
        .order("payment_year", { ascending: false })
        .order("payment_month", { ascending: false });

      if (error) throw error;

      // Get user profiles separately
      const userIds = [...new Set(data?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      // Merge profile data
      const paymentsWithProfiles = data?.map(payment => ({
        ...payment,
        profile: profiles?.find(p => p.id === payment.user_id)
      }));

      return paymentsWithProfiles;
    },
  });

  // Check current month payment
  const currentMonthPayment = payments?.find(
    (p) => p.payment_month === currentMonth && p.payment_year === currentYear
  );

  const handlePayment = async () => {
    try {
      setIsProcessing(true);

      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          groupId,
          amount: contributionAmount,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to create payment session",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-payments", groupId] });
      toast({
        title: "Payment Deleted",
        description: "Payment record has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error.message || "Failed to delete payment",
        variant: "destructive",
      });
    },
  });

  const getMonthName = (month: number) => {
    return new Date(2024, month - 1, 1).toLocaleString('default', { month: 'long' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full">
          <CreditCard className="mr-2 h-4 w-4" />
          Monthly Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Payment - {groupName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Month Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {getMonthName(currentMonth)} {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Monthly Contribution:</span>
                <span className="font-semibold">Rs {contributionAmount}</span>
              </div>

              {currentMonthPayment ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Payment Status:</span>
                    <Badge className={getStatusColor(currentMonthPayment.status)}>
                      {currentMonthPayment.status}
                    </Badge>
                  </div>
                  {currentMonthPayment.payment_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid On:</span>
                      <span>{new Date(currentMonthPayment.payment_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={handlePayment} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  {isProcessing ? "Processing..." : `Pay Rs ${contributionAmount}`}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment History Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">Loading payment history...</div>
              ) : payments && payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">
                          {getMonthName(payment.payment_month)} {payment.payment_year}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Rs {payment.amount} • {payment.profile?.full_name || 'Unknown User'}
                        </div>
                        {payment.payment_date && (
                          <div className="text-xs text-muted-foreground">
                            Paid: {new Date(payment.payment_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Payment Record</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this payment record? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deletePaymentMutation.mutate(payment.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No payment history yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};