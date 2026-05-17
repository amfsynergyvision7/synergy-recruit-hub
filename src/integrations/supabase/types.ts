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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing: {
        Row: {
          candidate_id: string | null
          candidate_uuid: string | null
          client_id: string | null
          client_uuid: string | null
          created_at: string
          created_by: string | null
          gst: number | null
          id: string
          invoice_amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          offer_uuid: string | null
          outstanding_amount: number | null
          payment_status: string | null
          placement_fee: number | null
          salary: number | null
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          gst?: number | null
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          offer_uuid?: string | null
          outstanding_amount?: number | null
          payment_status?: string | null
          placement_fee?: number | null
          salary?: number | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          gst?: number | null
          id?: string
          invoice_amount?: number | null
          invoice_date?: string | null
          invoice_number?: string | null
          offer_uuid?: string | null
          outstanding_amount?: number | null
          payment_status?: string | null
          placement_fee?: number | null
          salary?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_candidate_uuid_fkey"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_client_uuid_fkey"
            columns: ["client_uuid"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_offer_uuid_fkey"
            columns: ["offer_uuid"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_activities: {
        Row: {
          action_type: string
          candidate_id: string
          candidate_name: string | null
          created_at: string
          id: string
          module_created: string | null
          notes: string | null
          recruiter_id: string | null
          recruiter_name: string | null
          related_record_id: string | null
        }
        Insert: {
          action_type: string
          candidate_id: string
          candidate_name?: string | null
          created_at?: string
          id?: string
          module_created?: string | null
          notes?: string | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          related_record_id?: string | null
        }
        Update: {
          action_type?: string
          candidate_id?: string
          candidate_name?: string | null
          created_at?: string
          id?: string
          module_created?: string | null
          notes?: string | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          related_record_id?: string | null
        }
        Relationships: []
      }
      candidates: {
        Row: {
          assigned_recruiter: string | null
          candidate_code: string | null
          created_at: string
          created_by: string | null
          created_source: string | null
          current_company: string | null
          current_salary: number | null
          email: string | null
          expected_salary: number | null
          experience_years: number | null
          full_name: string
          id: string
          location: string | null
          mobile: string | null
          notes: string | null
          notice_period: string | null
          position_applied: string | null
          resume_url: string | null
          source: string | null
          stage: Database["public"]["Enums"]["candidate_stage"]
          status: string
          updated_at: string
        }
        Insert: {
          assigned_recruiter?: string | null
          candidate_code?: string | null
          created_at?: string
          created_by?: string | null
          created_source?: string | null
          current_company?: string | null
          current_salary?: number | null
          email?: string | null
          expected_salary?: number | null
          experience_years?: number | null
          full_name: string
          id?: string
          location?: string | null
          mobile?: string | null
          notes?: string | null
          notice_period?: string | null
          position_applied?: string | null
          resume_url?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_recruiter?: string | null
          candidate_code?: string | null
          created_at?: string
          created_by?: string | null
          created_source?: string | null
          current_company?: string | null
          current_salary?: number | null
          email?: string | null
          expected_salary?: number | null
          experience_years?: number | null
          full_name?: string
          id?: string
          location?: string | null
          mobile?: string | null
          notes?: string | null
          notice_period?: string | null
          position_applied?: string | null
          resume_url?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["candidate_stage"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          active_positions: number | null
          agreement_type: string | null
          billing_model: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          active_positions?: number | null
          agreement_type?: string | null
          billing_model?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          active_positions?: number | null
          agreement_type?: string | null
          billing_model?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      google_integrations: {
        Row: {
          auto_sync_enabled: boolean
          column_mapping: Json
          connection_status: string
          created_at: string
          google_account_email: string | null
          header_row: number
          id: string
          last_error: string | null
          last_sync: string | null
          last_synced_row: number
          mapping: Json
          sheet_name: string
          sheet_url: string | null
          spreadsheet_id: string | null
          sync_frequency_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          column_mapping?: Json
          connection_status?: string
          created_at?: string
          google_account_email?: string | null
          header_row?: number
          id?: string
          last_error?: string | null
          last_sync?: string | null
          last_synced_row?: number
          mapping?: Json
          sheet_name?: string
          sheet_url?: string | null
          spreadsheet_id?: string | null
          sync_frequency_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          column_mapping?: Json
          connection_status?: string
          created_at?: string
          google_account_email?: string | null
          header_row?: number
          id?: string
          last_error?: string | null
          last_sync?: string | null
          last_synced_row?: number
          mapping?: Json
          sheet_name?: string
          sheet_url?: string | null
          spreadsheet_id?: string | null
          sync_frequency_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          auto_sync: boolean
          column_mapping: Json
          created_at: string
          header_row: number
          id: string
          last_error: string | null
          last_status: string | null
          last_sync_at: string | null
          last_synced_row: number
          module: string
          sheet_name: string | null
          sheet_url: string | null
          spreadsheet_id: string | null
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean
          column_mapping?: Json
          created_at?: string
          header_row?: number
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          last_synced_row?: number
          module: string
          sheet_name?: string | null
          sheet_url?: string | null
          spreadsheet_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean
          column_mapping?: Json
          created_at?: string
          header_row?: number
          id?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          last_synced_row?: number
          module?: string
          sheet_name?: string | null
          sheet_url?: string | null
          spreadsheet_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          candidate_id: string
          candidate_uuid: string | null
          client_id: string | null
          client_uuid: string | null
          created_at: string
          created_by: string | null
          feedback: string | null
          id: string
          interview_date: string | null
          interview_time: string | null
          mode: string | null
          round: string | null
          status: string | null
          submission_uuid: string | null
        }
        Insert: {
          candidate_id: string
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          feedback?: string | null
          id?: string
          interview_date?: string | null
          interview_time?: string | null
          mode?: string | null
          round?: string | null
          status?: string | null
          submission_uuid?: string | null
        }
        Update: {
          candidate_id?: string
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          feedback?: string | null
          id?: string
          interview_date?: string | null
          interview_time?: string | null
          mode?: string | null
          round?: string | null
          status?: string | null
          submission_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_uuid_fkey"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_client_uuid_fkey"
            columns: ["client_uuid"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_submission_uuid_fkey"
            columns: ["submission_uuid"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          assigned_recruiter: string | null
          client_id: string | null
          client_uuid: string | null
          created_at: string
          created_by: string | null
          id: string
          job_title: string
          location: string | null
          open_positions: number | null
          priority: string | null
          salary_max: number | null
          salary_min: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_recruiter?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_title: string
          location?: string | null
          open_positions?: number | null
          priority?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_recruiter?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_title?: string
          location?: string | null
          open_positions?: number | null
          priority?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_openings_client_uuid_fkey"
            columns: ["client_uuid"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          candidate_id: string
          candidate_uuid: string | null
          client_id: string | null
          client_uuid: string | null
          created_at: string
          created_by: string | null
          ctc: number | null
          id: string
          interview_uuid: string | null
          joining_date: string | null
          joining_status: string | null
          offer_date: string | null
          offer_status: string | null
          salary: number | null
          submission_uuid: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          ctc?: number | null
          id?: string
          interview_uuid?: string | null
          joining_date?: string | null
          joining_status?: string | null
          offer_date?: string | null
          offer_status?: string | null
          salary?: number | null
          submission_uuid?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          ctc?: number | null
          id?: string
          interview_uuid?: string | null
          joining_date?: string | null
          joining_status?: string | null
          offer_date?: string | null
          offer_status?: string | null
          salary?: number | null
          submission_uuid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_candidate_uuid_fkey"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_client_uuid_fkey"
            columns: ["client_uuid"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_interview_uuid_fkey"
            columns: ["interview_uuid"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_submission_uuid_fkey"
            columns: ["submission_uuid"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role_request: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role_request?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role_request?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          candidate_id: string
          candidate_uuid: string | null
          client_id: string | null
          client_uuid: string | null
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          job_uuid: string | null
          remarks: string | null
          role_title: string | null
          status: string | null
          submission_date: string | null
        }
        Insert: {
          candidate_id: string
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          job_uuid?: string | null
          remarks?: string | null
          role_title?: string | null
          status?: string | null
          submission_date?: string | null
        }
        Update: {
          candidate_id?: string
          candidate_uuid?: string | null
          client_id?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          job_uuid?: string | null
          remarks?: string | null
          role_title?: string | null
          status?: string | null
          submission_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_candidate_uuid_fkey"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_client_uuid_fkey"
            columns: ["client_uuid"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_job_uuid_fkey"
            columns: ["job_uuid"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          errors: Json
          id: string
          message: string | null
          module: string
          rows_created: number
          rows_scanned: number
          rows_skipped: number
          rows_updated: number
          status: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          errors?: Json
          id?: string
          message?: string | null
          module: string
          rows_created?: number
          rows_scanned?: number
          rows_skipped?: number
          rows_updated?: number
          status?: string
          triggered_by?: string
        }
        Update: {
          created_at?: string
          errors?: Json
          id?: string
          message?: string | null
          module?: string
          rows_created?: number
          rows_scanned?: number
          rows_skipped?: number
          rows_updated?: number
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      resolve_candidate_uuid: { Args: { _value: string }; Returns: string }
      resolve_client_uuid: { Args: { _value: string }; Returns: string }
      resolve_job_uuid: { Args: { _value: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "operations" | "finance" | "viewer"
      candidate_stage:
        | "lead_received"
        | "contacted"
        | "interested"
        | "resume_collected"
        | "submitted_to_client"
        | "interview_scheduled"
        | "interview_completed"
        | "selected"
        | "offer_released"
        | "joined"
        | "rejected"
        | "dropped"
      user_status: "pending" | "approved" | "rejected" | "suspended"
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
    Enums: {
      app_role: ["admin", "recruiter", "operations", "finance", "viewer"],
      candidate_stage: [
        "lead_received",
        "contacted",
        "interested",
        "resume_collected",
        "submitted_to_client",
        "interview_scheduled",
        "interview_completed",
        "selected",
        "offer_released",
        "joined",
        "rejected",
        "dropped",
      ],
      user_status: ["pending", "approved", "rejected", "suspended"],
    },
  },
} as const
