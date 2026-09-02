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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          content_url: string
          demo_video_url: string
          highlights: Json
          id: number
          marquee_lines: Json
          qr_path: string
          services_text: string
          support_message: string
          telegram_link: string
          updated_at: string
          upi_id: string
          video_popup_enabled: boolean
          video_popup_url: string
        }
        Insert: {
          content_url?: string
          demo_video_url?: string
          highlights?: Json
          id?: number
          marquee_lines?: Json
          qr_path?: string
          services_text?: string
          support_message?: string
          telegram_link?: string
          updated_at?: string
          upi_id?: string
          video_popup_enabled?: boolean
          video_popup_url?: string
        }
        Update: {
          content_url?: string
          demo_video_url?: string
          highlights?: Json
          id?: number
          marquee_lines?: Json
          qr_path?: string
          services_text?: string
          support_message?: string
          telegram_link?: string
          updated_at?: string
          upi_id?: string
          video_popup_enabled?: boolean
          video_popup_url?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: Json
          email: string | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          created_at: string
          device_id: string
          id: string
          ip: string | null
          is_active: boolean
          last_seen: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          ip?: string | null
          is_active?: boolean
          last_seen?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          ip?: string | null
          is_active?: boolean
          last_seen?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      login_events: {
        Row: {
          created_at: string
          device_id: string | null
          email: string
          id: string
          ip: string | null
          outcome: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          email: string
          id?: string
          ip?: string | null
          outcome?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          email?: string
          id?: string
          ip?: string | null
          outcome?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          access_key: string | null
          admin_note: string | null
          created_at: string
          decided_at: string | null
          deny_reason: string | null
          email: string
          holder_name: string
          id: string
          phone: string
          plan_code: string
          proof_deleted_at: string | null
          purge_at: string | null
          screenshot_path: string | null
          status: string
          user_id: string | null
          utr: string
        }
        Insert: {
          access_key?: string | null
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          deny_reason?: string | null
          email: string
          holder_name: string
          id?: string
          phone?: string
          plan_code: string
          proof_deleted_at?: string | null
          purge_at?: string | null
          screenshot_path?: string | null
          status?: string
          user_id?: string | null
          utr: string
        }
        Update: {
          access_key?: string | null
          admin_note?: string | null
          created_at?: string
          decided_at?: string | null
          deny_reason?: string | null
          email?: string
          holder_name?: string
          id?: string
          phone?: string
          plan_code?: string
          proof_deleted_at?: string | null
          purge_at?: string | null
          screenshot_path?: string | null
          status?: string
          user_id?: string | null
          utr?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          is_active: boolean
          name: string
          price_inr: number
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          duration_days: number
          is_active?: boolean
          name: string
          price_inr: number
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          is_active?: boolean
          name?: string
          price_inr?: number
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reader_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          created_at: string
          details: Json
          device_count: number
          email: string
          id: string
          phone: string | null
          reason: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          device_count?: number
          email: string
          id?: string
          phone?: string | null
          reason: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          device_count?: number
          email?: string
          id?: string
          phone?: string | null
          reason?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          access_key: string | null
          created_at: string
          expires_at: string | null
          id: string
          plan_code: string
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_code: string
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          access_key?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_code?: string
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
