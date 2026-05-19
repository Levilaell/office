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
      accounts: {
        Row: {
          cnpj: string
          created_at: string
          id: string
          nome_fantasia: string | null
          razao_social: string
          regime_tributario: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          regime_tributario?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          regime_tributario?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          run_id: string
          tenant_id: string
          turn_index: number
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          role: string
          run_id: string
          tenant_id: string
          turn_index: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          run_id?: string
          tenant_id?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          cost_usd: number
          error_message: string | null
          id: string
          started_at: string
          status: string
          task_id: string
          tenant_id: string
          tokens_used: number
          trace_id: string
          turns: number
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          cost_usd?: number
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          task_id: string
          tenant_id: string
          tokens_used?: number
          trace_id: string
          turns?: number
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          cost_usd?: number
          error_message?: string | null
          id?: string
          started_at?: string
          status?: string
          task_id?: string
          tenant_id?: string
          tokens_used?: number
          trace_id?: string
          turns?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agent_key: string
          autonomy_tier: string
          budget: Json
          created_at: string
          department: string
          description: string | null
          id: string
          name: string
          role: string
          state: string
          state_metadata: Json
          tenant_id: string
          tier: string
          tools: Json
          updated_at: string
        }
        Insert: {
          agent_key: string
          autonomy_tier?: string
          budget?: Json
          created_at?: string
          department: string
          description?: string | null
          id?: string
          name: string
          role: string
          state?: string
          state_metadata?: Json
          tenant_id: string
          tier: string
          tools?: Json
          updated_at?: string
        }
        Update: {
          agent_key?: string
          autonomy_tier?: string
          budget?: Json
          created_at?: string
          department?: string
          description?: string | null
          id?: string
          name?: string
          role?: string
          state?: string
          state_metadata?: Json
          tenant_id?: string
          tier?: string
          tools?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          action_type: string
          agent_id: string
          context: Json
          created_at: string
          decided_at: string | null
          decision: Json | null
          expires_at: string | null
          id: string
          proposal: Json
          reviewer_user_id: string | null
          status: string
          task_id: string
          tenant_id: string
          trace_id: string
        }
        Insert: {
          action_type: string
          agent_id: string
          context?: Json
          created_at?: string
          decided_at?: string | null
          decision?: Json | null
          expires_at?: string | null
          id?: string
          proposal: Json
          reviewer_user_id?: string | null
          status?: string
          task_id: string
          tenant_id: string
          trace_id: string
        }
        Update: {
          action_type?: string
          agent_id?: string
          context?: Json
          created_at?: string
          decided_at?: string | null
          decision?: Json | null
          expires_at?: string | null
          id?: string
          proposal?: Json
          reviewer_user_id?: string | null
          status?: string
          task_id?: string
          tenant_id?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          account_id: string | null
          action: string
          actor: string
          after: Json | null
          before: Json | null
          cost_usd: number | null
          created_at: string
          id: string
          metadata: Json
          model: string | null
          prompt_version: string | null
          resource: string
          tenant_id: string | null
          trace_id: string
        }
        Insert: {
          account_id?: string | null
          action: string
          actor: string
          after?: Json | null
          before?: Json | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          prompt_version?: string | null
          resource: string
          tenant_id?: string | null
          trace_id: string
        }
        Update: {
          account_id?: string | null
          action?: string
          actor?: string
          after?: Json | null
          before?: Json | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          model?: string | null
          prompt_version?: string | null
          resource?: string
          tenant_id?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_sessions: {
        Row: {
          channel: string
          connection_metadata: Json
          created_at: string
          display_name: string | null
          error_details: Json | null
          id: string
          identifier: string | null
          last_health_check: string | null
          last_message_at: string | null
          secrets_ref: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          connection_metadata?: Json
          created_at?: string
          display_name?: string | null
          error_details?: Json | null
          id?: string
          identifier?: string | null
          last_health_check?: string | null
          last_message_at?: string | null
          secrets_ref?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          connection_metadata?: Json
          created_at?: string
          display_name?: string | null
          error_details?: Json | null
          id?: string
          identifier?: string | null
          last_health_check?: string | null
          last_message_at?: string | null
          secrets_ref?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_classifications: {
        Row: {
          agent_id: string
          agent_run_id: string | null
          confidence: number | null
          conversation_id: string
          cost_usd: number | null
          created_at: string
          decision: string
          decision_metadata: Json
          id: string
          intent: string
          message_id: string | null
          model: string | null
          prompt_version: string | null
          reasoning: string | null
          tenant_id: string
        }
        Insert: {
          agent_id: string
          agent_run_id?: string | null
          confidence?: number | null
          conversation_id: string
          cost_usd?: number | null
          created_at?: string
          decision: string
          decision_metadata?: Json
          id?: string
          intent: string
          message_id?: string | null
          model?: string | null
          prompt_version?: string | null
          reasoning?: string | null
          tenant_id: string
        }
        Update: {
          agent_id?: string
          agent_run_id?: string | null
          confidence?: number | null
          conversation_id?: string
          cost_usd?: number | null
          created_at?: string
          decision?: string
          decision_metadata?: Json
          id?: string
          intent?: string
          message_id?: string | null
          model?: string | null
          prompt_version?: string | null
          reasoning?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_classifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_classifications_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_classifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_classifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_classifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          account_id: string
          channel: string
          channel_handle: string
          created_at: string
          id: string
          intent_current: string | null
          last_message_at: string | null
          metadata: Json
          status: string
          subject: string | null
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          account_id: string
          channel: string
          channel_handle: string
          created_at?: string
          id?: string
          intent_current?: string | null
          last_message_at?: string | null
          metadata?: Json
          status?: string
          subject?: string | null
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          channel?: string
          channel_handle?: string
          created_at?: string
          id?: string
          intent_current?: string | null
          last_message_at?: string | null
          metadata?: Json
          status?: string
          subject?: string | null
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          account_id: string
          category: string
          competencia: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          file_name: string | null
          file_size: number | null
          id: string
          metadata: Json
          mime_type: string | null
          notes: string | null
          processed_at: string | null
          received_at: string | null
          reference_date: string | null
          source: string | null
          source_message_id: string | null
          status: string
          storage_path: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          category: string
          competencia?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          notes?: string | null
          processed_at?: string | null
          received_at?: string | null
          reference_date?: string | null
          source?: string | null
          source_message_id?: string | null
          status?: string
          storage_path?: string | null
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          category?: string
          competencia?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          notes?: string | null
          processed_at?: string | null
          received_at?: string | null
          reference_date?: string | null
          source?: string | null
          source_message_id?: string | null
          status?: string
          storage_path?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          account_id: string
          address: Json | null
          created_at: string
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          address?: Json | null
          created_at?: string
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          address?: Json | null
          created_at?: string
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to_user_id: string | null
          converted_at: string | null
          converted_to_account_id: string | null
          created_at: string
          estimated_value_monthly: number | null
          id: string
          lost_reason: string | null
          notes: string | null
          primary_contact_id: string | null
          primary_conversation_id: string | null
          qualification_data: Json
          qualified_at: string | null
          scheduled_call_at: string | null
          source: string
          source_metadata: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          converted_at?: string | null
          converted_to_account_id?: string | null
          created_at?: string
          estimated_value_monthly?: number | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          primary_contact_id?: string | null
          primary_conversation_id?: string | null
          qualification_data?: Json
          qualified_at?: string | null
          scheduled_call_at?: string | null
          source: string
          source_metadata?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          converted_at?: string | null
          converted_to_account_id?: string | null
          created_at?: string
          estimated_value_monthly?: number | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          primary_contact_id?: string | null
          primary_conversation_id?: string | null
          qualification_data?: Json
          qualified_at?: string | null
          scheduled_call_at?: string | null
          source?: string
          source_metadata?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_account_id_fkey"
            columns: ["converted_to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_primary_conversation_id_fkey"
            columns: ["primary_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_drafts: {
        Row: {
          agent_id: string
          agent_run_id: string | null
          confidence: number | null
          content_type: string
          conversation_id: string
          created_at: string
          decision_metadata: Json | null
          edit_diff: Json | null
          expires_at: string | null
          final_message_id: string | null
          id: string
          proposed_content: string
          reasoning: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_message_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_run_id?: string | null
          confidence?: number | null
          content_type?: string
          conversation_id: string
          created_at?: string
          decision_metadata?: Json | null
          edit_diff?: Json | null
          expires_at?: string | null
          final_message_id?: string | null
          id?: string
          proposed_content: string
          reasoning?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_message_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_run_id?: string | null
          confidence?: number | null
          content_type?: string
          conversation_id?: string
          created_at?: string
          decision_metadata?: Json | null
          edit_diff?: Json | null
          expires_at?: string | null
          final_message_id?: string | null
          id?: string
          proposed_content?: string
          reasoning?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_message_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_final_message_id_fkey"
            columns: ["final_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          account_id: string
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          metadata: Json
          sender_id: string | null
          sender_type: string
          tenant_id: string
        }
        Insert: {
          account_id: string
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          metadata?: Json
          sender_id?: string | null
          sender_type: string
          tenant_id: string
        }
        Update: {
          account_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          metadata?: Json
          sender_id?: string | null
          sender_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          account_id: string
          amount: number | null
          amount_paid: number | null
          category: string
          competencia: string
          created_at: string
          description: string | null
          due_date: string
          entity_id: string | null
          id: string
          metadata: Json
          notes: string | null
          paid_at: string | null
          payment_code: string | null
          payment_link: string | null
          payment_method: string | null
          reference_period: unknown
          status: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number | null
          amount_paid?: number | null
          category: string
          competencia: string
          created_at?: string
          description?: string | null
          due_date: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_code?: string | null
          payment_link?: string | null
          payment_method?: string | null
          reference_period?: unknown
          status?: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number | null
          amount_paid?: number | null
          category?: string
          competencia?: string
          created_at?: string
          description?: string | null
          due_date?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_code?: string | null
          payment_link?: string | null
          payment_method?: string | null
          reference_period?: unknown
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          account_id: string | null
          assigned_agent_id: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          parent_task_id: string | null
          payload: Json
          priority: number
          result: Json | null
          started_at: string | null
          status: string
          task_type: string
          tenant_id: string
          trace_id: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          assigned_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          parent_task_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          task_type: string
          tenant_id: string
          trace_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          assigned_agent_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          parent_task_id?: string | null
          payload?: Json
          priority?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          task_type?: string
          tenant_id?: string
          trace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          joined_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          clerk_org_id: string
          created_at: string
          display_settings: Json
          id: string
          name: string
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          clerk_org_id: string
          created_at?: string
          display_settings?: Json
          id?: string
          name: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Update: {
          clerk_org_id?: string
          created_at?: string
          display_settings?: Json
          id?: string
          name?: string
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          clerk_user_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_type: string
          payload: Json
          processed_at: string
          svix_id: string
        }
        Insert: {
          event_type: string
          payload: Json
          processed_at?: string
          svix_id: string
        }
        Update: {
          event_type?: string
          payload?: Json
          processed_at?: string
          svix_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
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
