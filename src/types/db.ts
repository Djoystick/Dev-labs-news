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
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
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

export type Profile = {
  id: string;
  role: UserRole;
  handle: string | null;
  handle_norm: string | null;
  bio: string | null;
  telegram_id: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
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
          cover_url?: string | null;
          created_at?: string;
          updated_at?: string;
          author_id?: string | null;
        };
        Update: {
          id?: string;
          topic_id?: string;
          title?: string;
          excerpt?: string | null;
          content?: string;
          cover_url?: string | null;
          created_at?: string;
          updated_at?: string;
          author_id?: string | null;
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
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
      get_recommended_posts: {
        Args: {
          p_limit: number;
        };
        Returns: PostRow[];
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
