// Generated from the Supabase schema (public). Regenerate after migrations:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// (The helper types at the bottom are hand-written and kept after regeneration.)

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
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      dishes: {
        Row: {
          created_at: string
          eaten_at: string
          id: string
          name: string
          note: string | null
          photo_path: string | null
          place_id: string | null
          rating: number | null
          source_url: string | null
          status: Database['public']['Enums']['dish_status']
          tags: string[]
          updated_at: string
          user_id: string
          visibility: Database['public']['Enums']['dish_visibility']
        }
        Insert: {
          created_at?: string
          eaten_at?: string
          id?: string
          name: string
          note?: string | null
          photo_path?: string | null
          place_id?: string | null
          rating?: number | null
          source_url?: string | null
          status?: Database['public']['Enums']['dish_status']
          tags?: string[]
          updated_at?: string
          user_id?: string
          visibility?: Database['public']['Enums']['dish_visibility']
        }
        Update: {
          created_at?: string
          eaten_at?: string
          id?: string
          name?: string
          note?: string | null
          photo_path?: string | null
          place_id?: string | null
          rating?: number | null
          source_url?: string | null
          status?: Database['public']['Enums']['dish_status']
          tags?: string[]
          updated_at?: string
          user_id?: string
          visibility?: Database['public']['Enums']['dish_visibility']
        }
        Relationships: [
          {
            foreignKeyName: 'dishes_place_id_fkey'
            columns: ['place_id']
            isOneToOne: false
            referencedRelation: 'places'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dishes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      list_items: {
        Row: {
          created_at: string
          dish_id: string
          id: string
          list_id: string
          position: number
        }
        Insert: {
          created_at?: string
          dish_id: string
          id?: string
          list_id: string
          position?: number
        }
        Update: {
          created_at?: string
          dish_id?: string
          id?: string
          list_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'list_items_dish_id_fkey'
            columns: ['dish_id']
            isOneToOne: false
            referencedRelation: 'dishes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'list_items_list_id_fkey'
            columns: ['list_id']
            isOneToOne: false
            referencedRelation: 'lists'
            referencedColumns: ['id']
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          share_slug: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          share_slug?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          share_slug?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lists_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          external_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          external_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          provider: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          external_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'places_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          handle: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          handle?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_list: { Args: { p_slug: string }; Returns: Json }
      upsert_place: {
        Args: {
          p_address?: string
          p_city?: string
          p_country?: string
          p_cuisine?: string
          p_external_place_id: string
          p_lat?: number
          p_lng?: number
          p_name: string
          p_provider: string
        }
        Returns: string
      }
    }
    Enums: {
      dish_status: 'tried' | 'want_to_try'
      dish_visibility: 'private' | 'followers' | 'public'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ---- hand-written helpers (keep when regenerating) ----
type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

export type Dish = Tables<'dishes'>
export type Place = Tables<'places'>
export type DishList = Tables<'lists'>
export type DishStatus = Enums<'dish_status'>
