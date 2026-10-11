export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      assignments: {
        Row: {
          category: string
          created_at: string
          done_at: string | null
          due_at: string
          excused: boolean
          house_id: string
          id: string
          johh_id: string | null
          name: string
          needs_photo: boolean
          outcome: string | null
          photo_path: string | null
          points: number
          reminded: number
          settled_at: string | null
          user_id: string
          week_id: string
        }
        Insert: {
          category: string
          created_at?: string
          done_at?: string | null
          due_at: string
          excused?: boolean
          house_id: string
          id?: string
          johh_id?: string | null
          name: string
          needs_photo?: boolean
          outcome?: string | null
          photo_path?: string | null
          points: number
          reminded?: number
          settled_at?: string | null
          user_id: string
          week_id: string
        }
        Update: {
          category?: string
          created_at?: string
          done_at?: string | null
          due_at?: string
          excused?: boolean
          house_id?: string
          id?: string
          johh_id?: string | null
          name?: string
          needs_photo?: boolean
          outcome?: string | null
          photo_path?: string | null
          points?: number
          reminded?: number
          settled_at?: string | null
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_johh_id_fkey"
            columns: ["johh_id"]
            isOneToOne: false
            referencedRelation: "johhs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_votes: {
        Row: {
          created_at: string
          dispute_id: string
          uphold: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          uphold: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          uphold?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_votes_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assignment_id: string
          closes_at: string
          created_at: string
          house_id: string
          id: string
          raised_by: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          tick_at: string
        }
        Insert: {
          assignment_id: string
          closes_at: string
          created_at?: string
          house_id: string
          id?: string
          raised_by?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          tick_at: string
        }
        Update: {
          assignment_id?: string
          closes_at?: string
          created_at?: string
          house_id?: string
          id?: string
          raised_by?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          tick_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          assignment_id: string | null
          created_at: string
          data: Json
          house_id: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          data?: Json
          house_id: string
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          data?: Json
          house_id?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          dispute_hours: number
          id: string
          join_code: string
          late_forfeit_minor: number
          missed_forfeit_minor: number
          name: string
          rota_started_at: string | null
          stake_minor: number
          ticked_at: string | null
          timezone: string
          week_starts: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_hours?: number
          id?: string
          join_code?: string
          late_forfeit_minor?: number
          missed_forfeit_minor?: number
          name: string
          rota_started_at?: string | null
          stake_minor?: number
          ticked_at?: string | null
          timezone?: string
          week_starts?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_hours?: number
          id?: string
          join_code?: string
          late_forfeit_minor?: number
          missed_forfeit_minor?: number
          name?: string
          rota_started_at?: string | null
          stake_minor?: number
          ticked_at?: string | null
          timezone?: string
          week_starts?: number
        }
        Relationships: []
      }
      johhs: {
        Row: {
          anchor_week: number
          archived_at: string | null
          category: string
          created_at: string
          due_dow: number
          due_time: string
          every_weeks: number
          house_id: string
          id: string
          name: string
          needs_photo: boolean
          points: number
        }
        Insert: {
          anchor_week: number
          archived_at?: string | null
          category?: string
          created_at?: string
          due_dow?: number
          due_time?: string
          every_weeks?: number
          house_id: string
          id?: string
          name: string
          needs_photo?: boolean
          points?: number
        }
        Update: {
          anchor_week?: number
          archived_at?: string | null
          category?: string
          created_at?: string
          due_dow?: number
          due_time?: string
          every_weeks?: number
          house_id?: string
          id?: string
          name?: string
          needs_photo?: boolean
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "johhs_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger: {
        Row: {
          amount_minor: number
          assignment_id: string | null
          counterparty: string | null
          created_at: string
          house_id: string
          id: number
          kind: string
          month: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          assignment_id?: string | null
          counterparty?: string | null
          created_at?: string
          house_id: string
          id?: never
          kind: string
          month: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          assignment_id?: string | null
          counterparty?: string | null
          created_at?: string
          house_id?: string
          id?: never
          kind?: string
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_counterparty_fkey"
            columns: ["counterparty"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          house_id: string
          immunity_tokens: number
          joined_at: string
          role: string
          streak: number
          swap_tokens: number
          user_id: string
        }
        Insert: {
          house_id: string
          immunity_tokens?: number
          joined_at?: string
          role?: string
          streak?: number
          swap_tokens?: number
          user_id: string
        }
        Update: {
          house_id?: string
          immunity_tokens?: number
          joined_at?: string
          role?: string
          streak?: number
          swap_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      month_closes: {
        Row: {
          closed_at: string
          house_id: string
          month: string
        }
        Insert: {
          closed_at?: string
          house_id: string
          month: string
        }
        Update: {
          closed_at?: string
          house_id?: string
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: "month_closes_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          event_id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          kind: string
          user_id?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weeks: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          house_id: string
          id: string
          starts_at: string
          starts_on: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          house_id: string
          id?: string
          starts_at: string
          starts_on: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          house_id?: string
          id?: string
          starts_at?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "weeks_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_upload_proof: { Args: { object_name: string }; Returns: boolean }
      cast_vote: {
        Args: { p_dispute: string; p_uphold: boolean }
        Returns: undefined
      }
      close_month: {
        Args: { p_entries: Json; p_house: string; p_month: string }
        Returns: boolean
      }
      close_week: {
        Args: { p_members: Json; p_week: string }
        Returns: boolean
      }
      confirm_payment: {
        Args: { p_amount: number; p_from: string; p_house: string }
        Returns: undefined
      }
      create_house: {
        Args: {
          p_currency: string
          p_name: string
          p_timezone: string
          p_week_starts: number
        }
        Returns: string
      }
      deal_week: {
        Args: {
          p_assignments: Json
          p_ends_at: string
          p_house: string
          p_replace?: boolean
          p_starts_at: string
          p_starts_on: string
        }
        Returns: string
      }
      house_by_code: {
        Args: { p_code: string }
        Returns: {
          id: string
          members: number
          name: string
        }[]
      }
      is_admin: { Args: { h: string }; Returns: boolean }
      is_member: { Args: { h: string }; Returns: boolean }
      join_house: { Args: { p_code: string }; Returns: string }
      mark_done: {
        Args: { p_assignment: string; p_photo_path?: string }
        Returns: undefined
      }
      my_open_assignment: {
        Args: { p_assignment: string }
        Returns: {
          category: string
          created_at: string
          done_at: string | null
          due_at: string
          excused: boolean
          house_id: string
          id: string
          johh_id: string | null
          name: string
          needs_photo: boolean
          outcome: string | null
          photo_path: string | null
          points: number
          reminded: number
          settled_at: string | null
          user_id: string
          week_id: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      new_join_code: { Args: never; Returns: string }
      proof_house: { Args: { object_name: string }; Returns: string }
      raise_dispute: {
        Args: { p_assignment: string; p_reason: string }
        Returns: string
      }
      remove_member: {
        Args: { p_house: string; p_user: string }
        Returns: undefined
      }
      request_tick: { Args: never; Returns: undefined }
      require_user: { Args: never; Returns: string }
      resolve_dispute: {
        Args: { p_dispute: string; p_resolution: string }
        Returns: boolean
      }
      set_member_role: {
        Args: { p_house: string; p_role: string; p_user: string }
        Returns: undefined
      }
      settle_assignments: { Args: { p_items: Json }; Returns: number }
      shares_house: { Args: { other: string }; Returns: boolean }
      undo_done: { Args: { p_assignment: string }; Returns: undefined }
      use_immunity: { Args: { p_assignment: string }; Returns: undefined }
      use_swap: {
        Args: { p_mine: string; p_theirs: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

