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
          closes_at: string | null
          covered_by: string | null
          created_at: string
          done_at: string | null
          due_at: string
          due_moved_from: string | null
          excused: boolean
          flagged_at: string | null
          flagged_by: string | null
          group_name: string | null
          house_id: string
          id: string
          john_id: string | null
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
          closes_at?: string | null
          covered_by?: string | null
          created_at?: string
          done_at?: string | null
          due_at: string
          due_moved_from?: string | null
          excused?: boolean
          flagged_at?: string | null
          flagged_by?: string | null
          group_name?: string | null
          house_id: string
          id?: string
          john_id?: string | null
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
          closes_at?: string | null
          covered_by?: string | null
          created_at?: string
          done_at?: string | null
          due_at?: string
          due_moved_from?: string | null
          excused?: boolean
          flagged_at?: string | null
          flagged_by?: string | null
          group_name?: string | null
          house_id?: string
          id?: string
          john_id?: string | null
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
            foreignKeyName: "assignments_covered_by_fkey"
            columns: ["covered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_john_id_fkey"
            columns: ["john_id"]
            isOneToOne: false
            referencedRelation: "johns"
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
      away: {
        Row: {
          created_at: string
          ends_on: string
          house_id: string
          id: string
          note: string | null
          starts_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          house_id: string
          id?: string
          note?: string | null
          starts_on: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          house_id?: string
          id?: string
          note?: string | null
          starts_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "away_house_id_user_id_fkey"
            columns: ["house_id", "user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["house_id", "user_id"]
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
      group_members: {
        Row: {
          group_id: string
          house_id: string
          user_id: string
        }
        Insert: {
          group_id: string
          house_id: string
          user_id: string
        }
        Update: {
          group_id?: string
          house_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_house_id_fkey"
            columns: ["group_id", "house_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "group_members_house_id_user_id_fkey"
            columns: ["house_id", "user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["house_id", "user_id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          house_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          house_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          house_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          away_makeup: number
          cover_grace_hours: number
          created_at: string
          created_by: string | null
          currency: string
          dispute_hours: number
          first_dealt_at: string | null
          id: string
          join_code: string
          late_forfeit_minor: number
          late_hours: number
          missed_forfeit_minor: number
          name: string
          stake_minor: number
          ticked_at: string | null
          timezone: string
          week_starts: number
        }
        Insert: {
          away_makeup?: number
          cover_grace_hours?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_hours?: number
          first_dealt_at?: string | null
          id?: string
          join_code?: string
          late_forfeit_minor?: number
          late_hours?: number
          missed_forfeit_minor?: number
          name: string
          stake_minor?: number
          ticked_at?: string | null
          timezone?: string
          week_starts?: number
        }
        Update: {
          away_makeup?: number
          cover_grace_hours?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          dispute_hours?: number
          first_dealt_at?: string | null
          id?: string
          join_code?: string
          late_forfeit_minor?: number
          late_hours?: number
          missed_forfeit_minor?: number
          name?: string
          stake_minor?: number
          ticked_at?: string | null
          timezone?: string
          week_starts?: number
        }
        Relationships: []
      }
      johns: {
        Row: {
          anchor_week: number
          archived_at: string | null
          category: string
          created_at: string
          due_dow: number
          due_time: string
          every_weeks: number
          group_id: string | null
          house_id: string
          id: string
          kind: string
          name: string
          needs_photo: boolean
          per_week: number
          points: number
          respond_hours: number
        }
        Insert: {
          anchor_week: number
          archived_at?: string | null
          category?: string
          created_at?: string
          due_dow?: number
          due_time?: string
          every_weeks?: number
          group_id?: string | null
          house_id: string
          id?: string
          kind?: string
          name: string
          needs_photo?: boolean
          per_week?: number
          points?: number
          respond_hours?: number
        }
        Update: {
          anchor_week?: number
          archived_at?: string | null
          category?: string
          created_at?: string
          due_dow?: number
          due_time?: string
          every_weeks?: number
          group_id?: string | null
          house_id?: string
          id?: string
          kind?: string
          name?: string
          needs_photo?: boolean
          per_week?: number
          points?: number
          respond_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "johns_group_in_house"
            columns: ["group_id", "house_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id", "house_id"]
          },
          {
            foreignKeyName: "johns_house_id_fkey"
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
      notification_prefs: {
        Row: {
          checks: boolean
          deal: boolean
          flags: boolean
          quiet_from: number | null
          quiet_until: number | null
          reminders: boolean
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checks?: boolean
          deal?: boolean
          flags?: boolean
          quiet_from?: number | null
          quiet_until?: number | null
          reminders?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          checks?: boolean
          deal?: boolean
          flags?: boolean
          quiet_from?: number | null
          quiet_until?: number | null
          reminders?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      on_call: {
        Row: {
          house_id: string
          john_id: string
          user_id: string
          week_id: string
        }
        Insert: {
          house_id: string
          john_id: string
          user_id: string
          week_id: string
        }
        Update: {
          house_id?: string
          john_id?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_call_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_call_john_id_fkey"
            columns: ["john_id"]
            isOneToOne: false
            referencedRelation: "johns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_call_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_call_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
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
      week_shares: {
        Row: {
          house_id: string
          share: number
          user_id: string
          week_id: string
        }
        Insert: {
          house_id: string
          share: number
          user_id: string
          week_id: string
        }
        Update: {
          house_id?: string
          share?: number
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_shares_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_shares_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
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
      cancel_away: { Args: { p_away: string }; Returns: undefined }
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
      cover_john: {
        Args: { p_assignment: string; p_photo_path?: string }
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
          p_on_call?: Json
          p_replace?: boolean
          p_shares: Json
          p_starts_at: string
          p_starts_on: string
        }
        Returns: string
      }
      delete_group: { Args: { p_group: string }; Returns: undefined }
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
          covered_by: string | null
          created_at: string
          done_at: string | null
          due_at: string
          due_moved_from: string | null
          excused: boolean
          flagged_at: string | null
          flagged_by: string | null
          group_name: string | null
          house_id: string
          id: string
          john_id: string | null
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
      open_flag: {
        Args: { p_at: string; p_by?: string; p_john: string }
        Returns: string
      }
      proof_house: { Args: { object_name: string }; Returns: string }
      push_action: {
        Args: {
          p_assignment: string
          p_dispute: string
          p_uphold: boolean
          p_user: string
        }
        Returns: undefined
      }
      raise_dispute: {
        Args: { p_assignment: string; p_reason: string }
        Returns: string
      }
      raise_flag: { Args: { p_john: string }; Returns: string }
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
      save_group: {
        Args: {
          p_group: string
          p_house: string
          p_members: string[]
          p_name: string
        }
        Returns: string
      }
      set_away: {
        Args: { p_ends: string; p_note?: string; p_starts: string }
        Returns: number
      }
      set_member_role: {
        Args: { p_house: string; p_role: string; p_user: string }
        Returns: undefined
      }
      settle_assignments: { Args: { p_items: Json }; Returns: number }
      shares_house: { Args: { other: string }; Returns: boolean }
      undo_cover: { Args: { p_assignment: string }; Returns: undefined }
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

