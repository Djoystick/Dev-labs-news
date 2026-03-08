export type UserRole = 'admin' | 'editor' | 'user';
export type PostSort = 'newest' | 'oldest';

export type Topic = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
};

export type UserTopicPreferenceRow = {
  user_id: string;
  topic_id: string;
  created_at: string;
};

export type PostRow = {
  id: string;
  topic_id: string;
  title: string;
  excerpt: string | null;
  content: string;
  custom_tags: string[];
  cover_url: string | null;
  source_url: string | null;
  source_domain: string | null;
  import_origin: string | null;
  import_note: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  scheduled_at: string | null;
  published_at: string | null;
};

export type Post = PostRow & {
  topic?: Topic | null;
};

export type PublicationRule = {
  content_md: string;
  id: number;
  updated_at: string;
  updated_by: string | null;
  version: number;
};

export type AiImportModel = 'qwen-3-235b-a22b-instruct-2507' | 'gpt-oss-120b';
export type AiRewriteMode = 'conservative' | 'balanced' | 'aggressive';
export type AiResultLength = 'short' | 'standard' | 'long';
export type AiDedupeMode = 'strict_url' | 'url_and_soft_title';

export type AiImportSettings = {
  dedupe_mode: AiDedupeMode;
  fallback_model: AiImportModel;
  id: number;
  max_tags: number;
  primary_model: AiImportModel;
  result_length: AiResultLength;
  rewrite_mode: AiRewriteMode;
  updated_at: string;
  updated_by: string | null;
  use_source_image: boolean;
};

export type ContentSourceType = 'rss';

export type ContentSource = {
  id: string;
  title: string;
  type: ContentSourceType;
  url: string;
  is_enabled: boolean;
  default_topic_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type Profile = {
  id: string;
  role: UserRole;
  handle: string | null;
  handle_norm: string | null;
  bio: string | null;
  telegram_id: string | null;
  telegram_user_id: number | null;
  telegram_notifications_enabled: boolean;
  telegram_linked_at: string | null;
  for_you_digest_enabled: boolean;
  for_you_digest_threshold: number;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ForYouDigestStateRow = {
  user_id: string;
  current_bucket: number;
  last_notified_count: number;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FavoriteRow = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Favorite = FavoriteRow & {
  post?: Post | null;
};

export type ReadingHistoryRow = {
  id: string;
  user_id: string;
  post_id: string;
  last_read_at: string;
  read_count: number;
};

export type ReadingHistoryEntry = ReadingHistoryRow & {
  post?: Post | null;
};

export type Database = {
  public: {
    Tables: {
      topics: {
        Row: Topic;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_topic_preferences: {
        Row: UserTopicPreferenceRow;
        Insert: {
          user_id: string;
          topic_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          topic_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: {
          id?: string;
          topic_id: string;
          title: string;
          excerpt?: string | null;
          content: string;
          custom_tags?: string[];
          cover_url?: string | null;
          source_url?: string | null;
          source_domain?: string | null;
          import_origin?: string | null;
          import_note?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          author_id?: string | null;
          scheduled_at?: string | null;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          topic_id?: string;
          title?: string;
          excerpt?: string | null;
          content?: string;
          custom_tags?: string[];
          cover_url?: string | null;
          source_url?: string | null;
          source_domain?: string | null;
          import_origin?: string | null;
          import_note?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
          author_id?: string | null;
          scheduled_at?: string | null;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          role?: UserRole;
          handle?: string | null;
          handle_norm?: string | null;
          bio?: string | null;
          telegram_id?: string | null;
          telegram_user_id?: number | null;
          telegram_notifications_enabled?: boolean;
          telegram_linked_at?: string | null;
          for_you_digest_enabled?: boolean;
          for_you_digest_threshold?: number;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          handle?: string | null;
          handle_norm?: string | null;
          bio?: string | null;
          telegram_id?: string | null;
          telegram_user_id?: number | null;
          telegram_notifications_enabled?: boolean;
          telegram_linked_at?: string | null;
          for_you_digest_enabled?: boolean;
          for_you_digest_threshold?: number;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      for_you_digest_state: {
        Row: ForYouDigestStateRow;
        Insert: {
          user_id: string;
          current_bucket?: number;
          last_notified_count?: number;
          last_notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_bucket?: number;
          last_notified_count?: number;
          last_notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'for_you_digest_state_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      publication_rules: {
        Row: PublicationRule;
        Insert: {
          content_md?: string;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          content_md?: string;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      ai_import_settings: {
        Row: AiImportSettings;
        Insert: {
          dedupe_mode?: AiDedupeMode;
          fallback_model?: AiImportModel;
          id?: number;
          max_tags?: number;
          primary_model?: AiImportModel;
          result_length?: AiResultLength;
          rewrite_mode?: AiRewriteMode;
          updated_at?: string;
          updated_by?: string | null;
          use_source_image?: boolean;
        };
        Update: {
          dedupe_mode?: AiDedupeMode;
          fallback_model?: AiImportModel;
          id?: number;
          max_tags?: number;
          primary_model?: AiImportModel;
          result_length?: AiResultLength;
          rewrite_mode?: AiRewriteMode;
          updated_at?: string;
          updated_by?: string | null;
          use_source_image?: boolean;
        };
        Relationships: [];
      };
      content_sources: {
        Row: ContentSource;
        Insert: {
          id?: string;
          title: string;
          type?: ContentSourceType;
          url: string;
          is_enabled?: boolean;
          default_topic_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          type?: ContentSourceType;
          url?: string;
          is_enabled?: boolean;
          default_topic_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'content_sources_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_sources_default_topic_id_fkey';
            columns: ['default_topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_sources_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      favorites: {
        Row: FavoriteRow;
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'favorites_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reading_history: {
        Row: ReadingHistoryRow;
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          last_read_at?: string;
          read_count?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          last_read_at?: string;
          read_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'reading_history_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reading_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_author_handles: {
        Args: {
          p_ids: string[];
        };
        Returns: Array<{
          id: string;
          handle: string;
        }>;
      };
      get_for_you_digest_stats: {
        Args: {
          p_user_id: string;
        };
        Returns: Array<{
          candidate_count: number;
          newest_post_created_at: string | null;
        }>;
      };
      get_post_reaction_summaries: {
        Args: {
          p_post_ids: string[];
        };
        Returns: Array<{
          post_id: string;
          likes: number;
          dislikes: number;
          my_reaction: number;
        }>;
      };
      get_recommended_posts: {
        Args: {
          p_limit: number;
        };
        Returns: PostRow[];
      };
      mark_post_read: {
        Args: {
          p_post_id: string;
        };
        Returns: undefined;
      };
      set_my_topics: {
        Args: {
          topic_ids: string[];
        };
        Returns: number;
      };
      set_profile_role_by_handle: {
        Args: {
          p_handle: string;
          p_role: UserRole;
        };
        Returns: Profile;
      };
      toggle_post_reaction: {
        Args: {
          p_post_id: string;
          p_value: number;
        };
        Returns: Array<{
          post_id: string;
          likes: number;
          dislikes: number;
          my_reaction: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
