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
      business_integrations: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          id: string
          metadata: Json
          provider: string
          provider_account_id: string | null
          provider_account_name: string | null
          refresh_token_encrypted: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          provider: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string
          provider_account_id?: string | null
          provider_account_name?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      business_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          offer_price: number | null
          price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          offer_price?: number | null
          price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          offer_price?: number | null
          price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      business_offers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          title: string
          user_id: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          title: string
          user_id: string
          valid_until: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          title?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_offers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_offers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_offers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      direct_messages: {
        Row: {
          created_at: string
          from_uid: string
          id: string
          post_id: string | null
          read: boolean
          text: string
          thread_id: string
          to_name: string
          to_uid: string
        }
        Insert: {
          created_at?: string
          from_uid: string
          id?: string
          post_id?: string | null
          read?: boolean
          text: string
          thread_id: string
          to_name: string
          to_uid: string
        }
        Update: {
          created_at?: string
          from_uid?: string
          id?: string
          post_id?: string | null
          read?: boolean
          text?: string
          thread_id?: string
          to_name?: string
          to_uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_from_uid_fkey"
            columns: ["from_uid"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "direct_messages_from_uid_fkey"
            columns: ["from_uid"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "direct_messages_from_uid_fkey"
            columns: ["from_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "direct_messages_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_to_uid_fkey"
            columns: ["to_uid"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "direct_messages_to_uid_fkey"
            columns: ["to_uid"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "direct_messages_to_uid_fkey"
            columns: ["to_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      hood_messages: {
        Row: {
          created_at: string
          hood_id: string
          id: string
          text: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          hood_id: string
          id?: string
          text: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          hood_id?: string
          id?: string
          text?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "hood_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["auth_user_id"]
          },
        ]
      }
      muted_threads: {
        Row: {
          created_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muted_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "muted_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "muted_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          nonce: string
          provider: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          provider: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          provider?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      payout_destinations: {
        Row: {
          created_at: string
          id: string
          masked_identifier: string
          provider_contact_id: string | null
          provider_reference: string | null
          type: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          masked_identifier: string
          provider_contact_id?: string | null
          provider_reference?: string | null
          type: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          masked_identifier?: string
          provider_contact_id?: string | null
          provider_reference?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payout_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "payout_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "payout_destinations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      payout_rewards: {
        Row: {
          created_at: string
          id: string
          payout_id: string
          released: boolean
          released_at: string | null
          reward_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payout_id: string
          released?: boolean
          released_at?: string | null
          reward_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payout_id?: string
          released?: boolean
          released_at?: string | null
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_rewards_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "my_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          failure_code: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          payout_destination_id: string | null
          processed_at: string | null
          provider: string | null
          provider_payout_id: string | null
          provider_status: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          payout_destination_id?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_payout_id?: string | null
          provider_status?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          payout_destination_id?: string | null
          processed_at?: string | null
          provider?: string | null
          provider_payout_id?: string | null
          provider_status?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_payout_destination_id_fkey"
            columns: ["payout_destination_id"]
            isOneToOne: false
            referencedRelation: "payout_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      post_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_name: string
          author_uid: string
          created_at: string
          id: string
          mentions: string[]
          parent_id: string | null
          post_id: string
          text: string
          upvotes: number
        }
        Insert: {
          author_name: string
          author_uid: string
          created_at?: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          post_id: string
          text: string
          upvotes?: number
        }
        Update: {
          author_name?: string
          author_uid?: string
          created_at?: string
          id?: string
          mentions?: string[]
          parent_id?: string | null
          post_id?: string
          text?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_uid_fkey"
            columns: ["author_uid"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_comments_author_uid_fkey"
            columns: ["author_uid"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_comments_author_uid_fkey"
            columns: ["author_uid"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      post_poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      post_publications: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          post_id: string
          provider: string
          provider_post_id: string | null
          published_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          post_id: string
          provider: string
          provider_post_id?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          post_id?: string
          provider?: string
          provider_post_id?: string | null
          published_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_publications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      post_rsvps: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      post_template_events: {
        Row: {
          category: string
          created_at: string
          event_type: string
          id: string
          post_id: string | null
          post_subtype: string | null
          template_version: number | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          event_type: string
          id?: string
          post_id?: string | null
          post_subtype?: string | null
          template_version?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          event_type?: string
          id?: string
          post_id?: string | null
          post_subtype?: string | null
          template_version?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_template_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_template_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_template_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "post_template_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      provider_webhook_events: {
        Row: {
          event_type: string
          id: string
          processed: boolean
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          processed?: boolean
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          processed?: boolean
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      referral_program_config: {
        Row: {
          campaign_end: string | null
          campaign_start: string | null
          created_at: string
          fixed_reward_amount: number
          id: number
          maximum_referrals_per_day: number
          maximum_referrals_per_month: number
          minimum_payout_amount: number
          payout_enabled: boolean
          referral_enabled: boolean
          reward_enabled: boolean
          reward_type: string
          updated_at: string
        }
        Insert: {
          campaign_end?: string | null
          campaign_start?: string | null
          created_at?: string
          fixed_reward_amount?: number
          id?: number
          maximum_referrals_per_day?: number
          maximum_referrals_per_month?: number
          minimum_payout_amount?: number
          payout_enabled?: boolean
          referral_enabled?: boolean
          reward_enabled?: boolean
          reward_type?: string
          updated_at?: string
        }
        Update: {
          campaign_end?: string | null
          campaign_start?: string | null
          created_at?: string
          fixed_reward_amount?: number
          id?: number
          maximum_referrals_per_day?: number
          maximum_referrals_per_month?: number
          minimum_payout_amount?: number
          payout_enabled?: boolean
          referral_enabled?: boolean
          reward_enabled?: boolean
          reward_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_reward_events: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          payout_id: string | null
          provider_reference: string | null
          referral_id: string | null
          resulting_status: string | null
          reward_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          payout_id?: string | null
          provider_reference?: string | null
          referral_id?: string | null
          resulting_status?: string | null
          reward_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          payout_id?: string | null
          provider_reference?: string | null
          referral_id?: string | null
          resulting_status?: string | null
          reward_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_reward_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reward_events_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reward_events_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "my_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reward_events_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_reward_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referral_reward_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referral_reward_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          qualified_at: string | null
          qualifying_event: string | null
          referral_code_id: string
          referred_user_id: string
          referrer_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          qualifying_event?: string | null
          referral_code_id: string
          referred_user_id: string
          referrer_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          qualified_at?: string | null
          qualifying_event?: string | null
          referral_code_id?: string
          referred_user_id?: string
          referrer_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      reward_ledger: {
        Row: {
          amount: number
          balance_effect: string
          created_at: string
          id: string
          metadata: Json
          payout_id: string | null
          reward_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_effect: string
          created_at?: string
          id?: string
          metadata?: Json
          payout_id?: string | null
          reward_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_effect?: string
          created_at?: string
          id?: string
          metadata?: Json
          payout_id?: string | null
          reward_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "my_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "reward_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "reward_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          eligible_at: string | null
          id: string
          referral_id: string | null
          revealed_at: string | null
          reward_amount: number
          reward_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eligible_at?: string | null
          id?: string
          referral_id?: string | null
          revealed_at?: string | null
          reward_amount: number
          reward_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          eligible_at?: string | null
          id?: string
          referral_id?: string | null
          revealed_at?: string | null
          reward_amount?: number
          reward_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          availability_note: string | null
          background_color: string | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          business_whatsapp: string | null
          comment_count: number
          country: string | null
          created_at: string
          cta: string | null
          event_end: string | null
          event_start: string | null
          expires_in: number
          highlight: string
          hood_id: string | null
          id: string
          images: string[]
          intent: string | null
          lat: number
          like_count: number
          lng: number
          location: unknown
          location_type: string | null
          original_price: number | null
          poll_options: string[] | null
          poll_votes: Json
          post_subtype: string | null
          post_type: string
          price: number | null
          product_link: string | null
          publish_status: string
          published_at: string | null
          rsvp_count: number
          scheduled_for: string | null
          state: string | null
          tag: string
          template_data: Json | null
          template_version: number | null
          title: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          availability_note?: string | null
          background_color?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          business_whatsapp?: string | null
          comment_count?: number
          country?: string | null
          created_at?: string
          cta?: string | null
          event_end?: string | null
          event_start?: string | null
          expires_in: number
          highlight: string
          hood_id?: string | null
          id?: string
          images?: string[]
          intent?: string | null
          lat: number
          like_count?: number
          lng: number
          location?: unknown
          location_type?: string | null
          original_price?: number | null
          poll_options?: string[] | null
          poll_votes?: Json
          post_subtype?: string | null
          post_type?: string
          price?: number | null
          product_link?: string | null
          publish_status?: string
          published_at?: string | null
          rsvp_count?: number
          scheduled_for?: string | null
          state?: string | null
          tag: string
          template_data?: Json | null
          template_version?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          availability_note?: string | null
          background_color?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          business_whatsapp?: string | null
          comment_count?: number
          country?: string | null
          created_at?: string
          cta?: string | null
          event_end?: string | null
          event_start?: string | null
          expires_in?: number
          highlight?: string
          hood_id?: string | null
          id?: string
          images?: string[]
          intent?: string | null
          lat?: number
          like_count?: number
          lng?: number
          location?: unknown
          location_type?: string | null
          original_price?: number | null
          poll_options?: string[] | null
          poll_votes?: Json
          post_subtype?: string | null
          post_type?: string
          price?: number | null
          product_link?: string | null
          publish_status?: string
          published_at?: string | null
          rsvp_count?: number
          scheduled_for?: string | null
          state?: string | null
          tag?: string
          template_data?: Json | null
          template_version?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_followed_hoods: {
        Row: {
          created_at: string
          hood_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hood_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hood_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_followed_hoods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_followed_hoods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_followed_hoods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_followed_topics: {
        Row: {
          created_at: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_followed_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_followed_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_followed_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          followed_user_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_user_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_user_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_followed_user_id_fkey"
            columns: ["followed_user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_follows_followed_user_id_fkey"
            columns: ["followed_user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_follows_followed_user_id_fkey"
            columns: ["followed_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_hidden_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hidden_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hidden_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_hidden_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_hidden_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      user_saved_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "user_saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      users: {
        Row: {
          account_type: string
          auth_user_id: string | null
          avatar_url: string | null
          bio: string | null
          business_category: string | null
          business_established_year: number | null
          business_images: string[] | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          cover_image_url: string | null
          created_at: string
          email: string | null
          google_maps_url: string | null
          home_country: string
          home_district: string
          home_lat: number | null
          home_lng: number | null
          home_place: string | null
          home_state: string
          home_updated_at: string
          is_guest: boolean
          is_test: boolean
          last_active: string | null
          name: string
          opening_hours: Json | null
          reputation: number
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_whatsapp: string | null
          social_x: string | null
          social_youtube: string | null
          uid: string
        }
        Insert: {
          account_type?: string
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_established_year?: number | null
          business_images?: string[] | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          cover_image_url?: string | null
          created_at?: string
          email?: string | null
          google_maps_url?: string | null
          home_country?: string
          home_district?: string
          home_lat?: number | null
          home_lng?: number | null
          home_place?: string | null
          home_state?: string
          home_updated_at?: string
          is_guest?: boolean
          is_test?: boolean
          last_active?: string | null
          name: string
          opening_hours?: Json | null
          reputation?: number
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          social_youtube?: string | null
          uid: string
        }
        Update: {
          account_type?: string
          auth_user_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_established_year?: number | null
          business_images?: string[] | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          cover_image_url?: string | null
          created_at?: string
          email?: string | null
          google_maps_url?: string | null
          home_country?: string
          home_district?: string
          home_lat?: number | null
          home_lng?: number | null
          home_place?: string | null
          home_state?: string
          home_updated_at?: string
          is_guest?: boolean
          is_test?: boolean
          last_active?: string | null
          name?: string
          opening_hours?: Json | null
          reputation?: number
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          social_youtube?: string | null
          uid?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      my_business_integrations: {
        Row: {
          created_at: string | null
          id: string | null
          provider: string | null
          provider_account_id: string | null
          provider_account_name: string | null
          status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          provider?: string | null
          provider_account_id?: string | null
          provider_account_name?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          provider?: string | null
          provider_account_id?: string | null
          provider_account_name?: string | null
          status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "business_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      my_reward_ledger: {
        Row: {
          amount: number | null
          balance_effect: string | null
          created_at: string | null
          id: string | null
          metadata: Json | null
          payout_id: string | null
          reward_id: string | null
          type: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "my_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "reward_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "reward_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      my_reward_summary: {
        Row: {
          available_amount: number | null
          paid_amount: number | null
          pending_amount: number | null
          qualified_referrals: number | null
          total_earned_amount: number | null
          total_referrals: number | null
          unrevealed_count: number | null
        }
        Relationships: []
      }
      my_rewards: {
        Row: {
          created_at: string | null
          eligible_at: string | null
          id: string | null
          referral_id: string | null
          revealed_at: string | null
          reward_amount: number | null
          reward_type: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          eligible_at?: string | null
          id?: string | null
          referral_id?: string | null
          revealed_at?: string | null
          reward_amount?: never
          reward_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          eligible_at?: string | null
          id?: string | null
          referral_id?: string | null
          revealed_at?: string | null
          reward_amount?: never
          reward_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: true
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_user_profile"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_user_profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["uid"]
          },
        ]
      }
      my_user_profile: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          business_category: string | null
          business_established_year: number | null
          business_images: string[] | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          cover_image_url: string | null
          created_at: string | null
          email: string | null
          google_maps_url: string | null
          home_country: string | null
          home_district: string | null
          home_lat: number | null
          home_lng: number | null
          home_place: string | null
          home_state: string | null
          home_updated_at: string | null
          is_guest: boolean | null
          name: string | null
          opening_hours: Json | null
          reputation: number | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_whatsapp: string | null
          social_x: string | null
          social_youtube: string | null
          uid: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_established_year?: number | null
          business_images?: string[] | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          email?: string | null
          google_maps_url?: string | null
          home_country?: string | null
          home_district?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_place?: string | null
          home_state?: string | null
          home_updated_at?: string | null
          is_guest?: boolean | null
          name?: string | null
          opening_hours?: Json | null
          reputation?: number | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          social_youtube?: string | null
          uid?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_established_year?: number | null
          business_images?: string[] | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          email?: string | null
          google_maps_url?: string | null
          home_country?: string | null
          home_district?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_place?: string | null
          home_state?: string | null
          home_updated_at?: string | null
          is_guest?: boolean | null
          name?: string | null
          opening_hours?: Json | null
          reputation?: number | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          social_youtube?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      public_user_profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          business_category: string | null
          business_established_year: number | null
          business_images: string[] | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          cover_image_url: string | null
          created_at: string | null
          google_maps_url: string | null
          is_guest: boolean | null
          name: string | null
          opening_hours: Json | null
          reputation: number | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_whatsapp: string | null
          social_x: string | null
          social_youtube: string | null
          uid: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_established_year?: number | null
          business_images?: string[] | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          google_maps_url?: string | null
          is_guest?: boolean | null
          name?: string | null
          opening_hours?: Json | null
          reputation?: number | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          social_youtube?: string | null
          uid?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_established_year?: number | null
          business_images?: string[] | null
          business_name?: string | null
          business_phone?: string | null
          business_website?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          google_maps_url?: string | null
          is_guest?: boolean | null
          name?: string | null
          opening_hours?: Json | null
          reputation?: number | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_whatsapp?: string | null
          social_x?: string | null
          social_youtube?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      referral_program_settings: {
        Row: {
          campaign_end: string | null
          campaign_start: string | null
          fixed_reward_amount: number | null
          minimum_payout_amount: number | null
          payout_enabled: boolean | null
          referral_enabled: boolean | null
          reward_enabled: boolean | null
          reward_type: string | null
        }
        Insert: {
          campaign_end?: string | null
          campaign_start?: string | null
          fixed_reward_amount?: number | null
          minimum_payout_amount?: number | null
          payout_enabled?: boolean | null
          referral_enabled?: boolean | null
          reward_enabled?: boolean | null
          reward_type?: string | null
        }
        Update: {
          campaign_end?: string | null
          campaign_start?: string | null
          fixed_reward_amount?: number | null
          minimum_payout_amount?: number | null
          payout_enabled?: boolean | null
          referral_enabled?: boolean | null
          reward_enabled?: boolean | null
          reward_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      add_payout_destination: {
        Args: {
          p_masked_identifier: string
          p_provider_contact_id: string
          p_provider_reference: string
          p_type: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          id: string
          masked_identifier: string
          provider_contact_id: string | null
          provider_reference: string | null
          type: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        SetofOptions: {
          from: "*"
          to: "payout_destinations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      apply_payout_result: {
        Args: {
          p_failure_code: string
          p_failure_reason: string
          p_payout_id: string
          p_provider_payout_id: string
          p_provider_status: string
          p_status: string
        }
        Returns: Json
      }
      apply_payout_webhook: {
        Args: {
          p_event_type: string
          p_failure_code: string
          p_failure_reason: string
          p_provider: string
          p_provider_event_id: string
          p_provider_payout_id: string
          p_provider_status: string
          p_status: string
        }
        Returns: Json
      }
      create_or_get_referral_code: {
        Args: { p_user_id: string }
        Returns: {
          active: boolean
          code: string
          created_at: string
          id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_codes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_own_account: { Args: never; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      evaluate_referral: { Args: { p_referral_id: string }; Returns: Json }
      fetch_tags_in_bounds: {
        Args: {
          max_lat: number
          max_lng: number
          min_lat: number
          min_lng: number
        }
        Returns: {
          availability_note: string | null
          background_color: string | null
          business_name: string | null
          business_phone: string | null
          business_website: string | null
          business_whatsapp: string | null
          comment_count: number
          country: string | null
          created_at: string
          cta: string | null
          event_end: string | null
          event_start: string | null
          expires_in: number
          highlight: string
          hood_id: string | null
          id: string
          images: string[]
          intent: string | null
          lat: number
          like_count: number
          lng: number
          location: unknown
          location_type: string | null
          original_price: number | null
          poll_options: string[] | null
          poll_votes: Json
          post_subtype: string | null
          post_type: string
          price: number | null
          product_link: string | null
          publish_status: string
          published_at: string | null
          rsvp_count: number
          scheduled_for: string | null
          state: string | null
          tag: string
          template_data: Json | null
          template_version: number | null
          title: string | null
          updated_at: string
          user_id: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tags"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_referral_code: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      increment_comment_upvote: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      payout_result: {
        Args: { p_payout: Database["public"]["Tables"]["payouts"]["Row"] }
        Returns: Json
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      referral_evaluation_result: {
        Args: {
          p_ref: Database["public"]["Tables"]["referrals"]["Row"]
          p_reward?: Database["public"]["Tables"]["rewards"]["Row"]
        }
        Returns: Json
      }
      register_referral: {
        Args: { p_code: string; p_referred_user_id: string }
        Returns: Json
      }
      request_payout: {
        Args: {
          p_destination_id: string
          p_idempotency_key: string
          p_provider: string
          p_user_id: string
        }
        Returns: Json
      }
      reveal_reward: {
        Args: { p_reward_id: string; p_user_id: string }
        Returns: Json
      }
      set_user_active: { Args: never; Returns: undefined }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
