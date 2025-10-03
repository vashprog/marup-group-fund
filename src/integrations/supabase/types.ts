export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      contributions: {
        Row: {
          amount: number
          contributed_at: string
          group_id: string
          id: string
          round_id: string
          user_id: string
        }
        Insert: {
          amount: number
          contributed_at?: string
          group_id: string
          id?: string
          round_id: string
          user_id: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          group_id?: string
          id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "marup_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "group_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          has_won: boolean
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          has_won?: boolean
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          has_won?: boolean
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "marup_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_rounds: {
        Row: {
          completed: boolean
          due_date: string
          group_id: string
          id: string
          round_number: number
          started_at: string
          total_amount: number | null
          winner_user_id: string | null
        }
        Insert: {
          completed?: boolean
          due_date: string
          group_id: string
          id?: string
          round_number: number
          started_at?: string
          total_amount?: number | null
          winner_user_id?: string | null
        }
        Update: {
          completed?: boolean
          due_date?: string
          group_id?: string
          id?: string
          round_number?: number
          started_at?: string
          total_amount?: number | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_rounds_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "marup_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          requester_user_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          requester_user_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          requester_user_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marup_groups: {
        Row: {
          active: boolean
          contribution_amount: number
          created_at: string
          description: string | null
          duration_months: number | null
          group_code: string | null
          id: string
          max_members: number
          name: string
          owner_id: string
        }
        Insert: {
          active?: boolean
          contribution_amount: number
          created_at?: string
          description?: string | null
          duration_months?: number | null
          group_code?: string | null
          id?: string
          max_members: number
          name: string
          owner_id: string
        }
        Update: {
          active?: boolean
          contribution_amount?: number
          created_at?: string
          description?: string | null
          duration_months?: number | null
          group_code?: string | null
          id?: string
          max_members?: number
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          group_id: string | null
          id: string
          message_type: string
          recipient_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id?: string | null
          id?: string
          message_type?: string
          recipient_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string | null
          id?: string
          message_type?: string
          recipient_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_notifications: {
        Row: {
          created_at: string
          group_id: string
          id: string
          notification_month: number
          notification_year: number
          sent_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          notification_month: number
          notification_year: number
          sent_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          notification_month?: number
          notification_year?: number
          sent_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          payment_date: string | null
          payment_month: number
          payment_year: number
          status: string
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
          payment_date?: string | null
          payment_month: number
          payment_year: number
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          payment_date?: string | null
          payment_month?: number
          payment_year?: number
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          group_id: string
          id: string
          paid_at: string
          round_id: string
          user_id: string
        }
        Insert: {
          amount: number
          group_id: string
          id?: string
          paid_at?: string
          round_id: string
          user_id: string
        }
        Update: {
          amount?: number
          group_id?: string
          id?: string
          paid_at?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "marup_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "group_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_join_request: {
        Args: { requester_id?: string; target_group_id: string }
        Returns: Json
      }
      generate_group_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_profile_by_user_id: {
        Args: { target_user_id: string }
        Returns: {
          full_name: string
          id: string
          user_id: string
        }[]
      }
      is_group_member: {
        Args: { group_id_param: string; user_id_param?: string }
        Returns: boolean
      }
      is_group_owner: {
        Args: { group_id_param: string; user_id_param?: string }
        Returns: boolean
      }
      run_round_lottery: {
        Args: { p_round_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
