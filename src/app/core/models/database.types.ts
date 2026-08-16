export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type GenericView = {
  Row: Record<string, unknown>;
  Relationships: [];
};

type GenericFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          uid: string;
          name: string;
          email: string | null;
          is_guest: boolean;
          reputation: number;
          account_type: string;
          avatar_url: string | null;
          bio: string | null;
          home_state: string | null;
          home_country: string | null;
          home_district: string | null;
          home_place: string | null;
          home_lat: number | null;
          home_lng: number | null;
          home_updated_at: string | null;
          business_name: string | null;
          business_phone: string | null;
          business_website: string | null;
          business_category: string | null;
          business_images: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Partial<Database['public']['Tables']['users']['Row']>, 'uid'> & {
          uid?: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Row']>;
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          highlight: string;
          tag: string;
          lat: number;
          lng: number;
          expires_in: number;
          created_at: string;
          hood_id: string | null;
          state: string | null;
          country: string | null;
          location_type: string | null;
          images: string[];
          post_type: string | null;
          intent: string | null;
          price: number | null;
          original_price: number | null;
          availability_note: string | null;
          cta: string | null;
          product_link: string | null;
          business_name: string | null;
          business_phone: string | null;
          business_website: string | null;
          loves: number | null;
          dislikes: number | null;
          comments: string[] | null;
          event_start: string | null;
          event_end: string | null;
          poll_options: string[] | null;
          poll_votes: Record<string, string[]> | null;
          like_count: number | null;
          comment_count: number | null;
          rsvp_count: number | null;
          current_status: string | null;
          status_updated_at: string | null;
          verification_count: number | null;
          // Step 1 template fields
          post_subtype: string | null;
          template_version: number | null;
          title: string | null;
          template_data: Record<string, unknown> | null;
          // Step 5.A publishing state
          publish_status: string;
          published_at: string | null;
          scheduled_for: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['tags']['Row']> & {
          user_id: string;
          username: string;
          highlight: string;
          tag: string;
          lat: number;
          lng: number;
          expires_in: number;
          created_at: string;
          images: string[];
        };
        Update: Partial<Database['public']['Tables']['tags']['Row']>;
        Relationships: [];
      };
      post_template_events: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          post_subtype: string | null;
          template_version: number | null;
          event_type: string;
          post_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['post_template_events']['Row']> & {
          user_id: string;
          category: string;
          event_type: string;
        };
        Update: Partial<Database['public']['Tables']['post_template_events']['Row']>;
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_uid: string;
          author_name: string;
          text: string;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['post_comments']['Row']> & {
          post_id: string;
          author_uid: string;
          text: string;
        };
        Update: Partial<Database['public']['Tables']['post_comments']['Row']>;
        Relationships: [];
      };
      direct_messages: {
        Row: {
          id: string;
          thread_id: string;
          from_uid: string;
          to_uid: string;
          text: string;
          read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['direct_messages']['Row']> & {
          thread_id: string;
          from_uid: string;
          to_uid: string;
          text: string;
        };
        Update: Partial<Database['public']['Tables']['direct_messages']['Row']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string | null;
          type: string;
          target_type: string | null;
          target_id: string | null;
          read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['notifications']['Row']> & {
          user_id: string;
          type: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Row']>;
        Relationships: [];
      };
      [table: string]: GenericTable;
    };
    Views: {
      public_user_profiles: GenericView;
      my_user_profile: GenericView;
      [view: string]: GenericView;
    };
    Functions: {
      fetch_tags_in_bounds: GenericFunction;
      set_user_active: GenericFunction;
      [fn: string]: GenericFunction;
    };
    Enums: Record<string, never>;
  };
}
