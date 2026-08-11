/**
 * Tipe database — DIGENERATE dari skema Supabase (migrasi v1+).
 * Regenerate setelah migrasi baru:
 *   pnpm supabase gen types typescript --project-id <ref> > src/types/database.ts
 *   # atau via Supabase MCP: generate_typescript_types
 * Jangan diedit manual.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string;
          admin_id: string | null;
          created_at: string;
          detail: Json | null;
          id: string;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          created_at?: string;
          detail?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          created_at?: string;
          detail?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_logs_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_notes: {
        Row: {
          amount: number | null;
          created_at: string;
          guest_name: string;
          id: string;
          invitation_id: string;
          note: string | null;
          type: Database["public"]["Enums"]["gift_note_type"];
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          guest_name: string;
          id?: string;
          invitation_id: string;
          note?: string | null;
          type: Database["public"]["Enums"]["gift_note_type"];
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          guest_name?: string;
          id?: string;
          invitation_id?: string;
          note?: string | null;
          type?: Database["public"]["Enums"]["gift_note_type"];
        };
        Relationships: [
          {
            foreignKeyName: "gift_notes_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      guests: {
        Row: {
          created_at: string;
          first_viewed_at: string | null;
          group_label: string | null;
          id: string;
          invitation_id: string;
          name: string;
          notes: string | null;
          pax_allocated: number;
          phone: string | null;
          token: string;
          wa_clicked_at: string | null;
        };
        Insert: {
          created_at?: string;
          first_viewed_at?: string | null;
          group_label?: string | null;
          id?: string;
          invitation_id: string;
          name: string;
          notes?: string | null;
          pax_allocated?: number;
          phone?: string | null;
          token: string;
          wa_clicked_at?: string | null;
        };
        Update: {
          created_at?: string;
          first_viewed_at?: string | null;
          group_label?: string | null;
          id?: string;
          invitation_id?: string;
          name?: string;
          notes?: string | null;
          pax_allocated?: number;
          phone?: string | null;
          token?: string;
          wa_clicked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guests_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitation_events: {
        Row: {
          address: string | null;
          end_at: string | null;
          id: string;
          invitation_id: string;
          maps_url: string | null;
          name: string;
          sort_order: number;
          start_at: string;
          venue_name: string | null;
        };
        Insert: {
          address?: string | null;
          end_at?: string | null;
          id?: string;
          invitation_id: string;
          maps_url?: string | null;
          name: string;
          sort_order?: number;
          start_at: string;
          venue_name?: string | null;
        };
        Update: {
          address?: string | null;
          end_at?: string | null;
          id?: string;
          invitation_id?: string;
          maps_url?: string | null;
          name?: string;
          sort_order?: number;
          start_at?: string;
          venue_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_events_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          active_until: string | null;
          category: Database["public"]["Enums"]["invitation_category"];
          content: Json;
          created_at: string;
          event_date: string | null;
          id: string;
          package_id: string | null;
          published_at: string | null;
          purged_at: string | null;
          reminder_sent_at: string | null;
          settings: Json;
          slug: string;
          status: Database["public"]["Enums"]["invitation_status"];
          theme_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_until?: string | null;
          category: Database["public"]["Enums"]["invitation_category"];
          content?: Json;
          created_at?: string;
          event_date?: string | null;
          id?: string;
          package_id?: string | null;
          published_at?: string | null;
          purged_at?: string | null;
          reminder_sent_at?: string | null;
          settings?: Json;
          slug: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          theme_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_until?: string | null;
          category?: Database["public"]["Enums"]["invitation_category"];
          content?: Json;
          created_at?: string;
          event_date?: string | null;
          id?: string;
          package_id?: string | null;
          published_at?: string | null;
          purged_at?: string | null;
          reminder_sent_at?: string | null;
          settings?: Json;
          slug?: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          theme_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_theme_id_fkey";
            columns: ["theme_id"];
            isOneToOne: false;
            referencedRelation: "themes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          created_at: string;
          height: number | null;
          id: string;
          invitation_id: string;
          sort_order: number;
          storage_path: string;
          type: Database["public"]["Enums"]["media_type"];
          width: number | null;
        };
        Insert: {
          created_at?: string;
          height?: number | null;
          id?: string;
          invitation_id: string;
          sort_order?: number;
          storage_path: string;
          type?: Database["public"]["Enums"]["media_type"];
          width?: number | null;
        };
        Update: {
          created_at?: string;
          height?: number | null;
          id?: string;
          invitation_id?: string;
          sort_order?: number;
          storage_path?: string;
          type?: Database["public"]["Enums"]["media_type"];
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          amount_idr: number;
          created_at: string;
          id: string;
          invitation_id: string;
          order_code: string;
          package_id: string;
          paid_at: string | null;
          payment_method: string | null;
          raw_notification: Json | null;
          status: Database["public"]["Enums"]["order_status"];
          user_id: string;
        };
        Insert: {
          amount_idr: number;
          created_at?: string;
          id?: string;
          invitation_id: string;
          order_code: string;
          package_id: string;
          paid_at?: string | null;
          payment_method?: string | null;
          raw_notification?: Json | null;
          status?: Database["public"]["Enums"]["order_status"];
          user_id: string;
        };
        Update: {
          amount_idr?: number;
          created_at?: string;
          id?: string;
          invitation_id?: string;
          order_code?: string;
          package_id?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          raw_notification?: Json | null;
          status?: Database["public"]["Enums"]["order_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      packages: {
        Row: {
          code: string;
          created_at: string;
          duration_months: number;
          id: string;
          is_active: boolean;
          limits: Json;
          name: string;
          price_idr: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          duration_months: number;
          id?: string;
          is_active?: boolean;
          limits?: Json;
          name: string;
          price_idr: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          duration_months?: number;
          id?: string;
          is_active?: boolean;
          limits?: Json;
          name?: string;
          price_idr?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["profile_role"];
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          attendance: Database["public"]["Enums"]["rsvp_attendance"];
          created_at: string;
          guest_id: string | null;
          guest_name: string;
          id: string;
          invitation_id: string;
          is_approved: boolean;
          is_hidden: boolean;
          message: string | null;
          pax: number;
          updated_at: string;
        };
        Insert: {
          attendance: Database["public"]["Enums"]["rsvp_attendance"];
          created_at?: string;
          guest_id?: string | null;
          guest_name: string;
          id?: string;
          invitation_id: string;
          is_approved?: boolean;
          is_hidden?: boolean;
          message?: string | null;
          pax?: number;
          updated_at?: string;
        };
        Update: {
          attendance?: Database["public"]["Enums"]["rsvp_attendance"];
          created_at?: string;
          guest_id?: string | null;
          guest_name?: string;
          id?: string;
          invitation_id?: string;
          is_approved?: boolean;
          is_hidden?: boolean;
          message?: string | null;
          pax?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rsvps_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      songs: {
        Row: {
          artist: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          storage_path: string;
          title: string;
        };
        Insert: {
          artist?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          storage_path: string;
          title: string;
        };
        Update: {
          artist?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          storage_path?: string;
          title?: string;
        };
        Relationships: [];
      };
      themes: {
        Row: {
          categories: Database["public"]["Enums"]["invitation_category"][];
          created_at: string;
          demo_slug: string | null;
          id: string;
          is_active: boolean;
          name: string;
          preview_image: string | null;
          slug: string;
          sort_order: number;
          tier: Database["public"]["Enums"]["theme_tier"];
        };
        Insert: {
          categories?: Database["public"]["Enums"]["invitation_category"][];
          created_at?: string;
          demo_slug?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          preview_image?: string | null;
          slug: string;
          sort_order?: number;
          tier?: Database["public"]["Enums"]["theme_tier"];
        };
        Update: {
          categories?: Database["public"]["Enums"]["invitation_category"][];
          created_at?: string;
          demo_slug?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          preview_image?: string | null;
          slug?: string;
          sort_order?: number;
          tier?: Database["public"]["Enums"]["theme_tier"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_paid_order: {
        Args: {
          p_amount: number;
          p_order_code: string;
          // Nullable di SQL (di-`coalesce`) — generator tak bisa menyatakan arg
          // fungsi nullable; koreksi manual agar jalur webhook/poll (paidAt/
          // paymentMethod bisa null) tetap ter-type. Pertahankan saat regen.
          p_paid_at: string | null;
          p_payment_method: string | null;
          p_raw: Json;
        };
        Returns: {
          result: string;
          slug: string;
        }[];
      };
      admin_activate_invitation: {
        Args: {
          p_admin_id: string;
          p_invitation_id: string;
          p_order_code: string;
          p_package_id: string;
        };
        Returns: {
          result: string;
          slug: string;
        }[];
      };
      admin_change_owner: {
        Args: {
          p_admin_id: string;
          p_invitation_id: string;
          p_new_user_id: string;
        };
        Returns: {
          result: string;
        }[];
      };
      admin_extend_invitation: {
        Args: { p_admin_id: string; p_invitation_id: string; p_months: number };
        Returns: {
          active_until: string;
          result: string;
          slug: string;
        }[];
      };
      admin_month_revenue: {
        Args: { p_since: string };
        Returns: {
          cnt: number;
          total: number;
        }[];
      };
      admin_reinstate_invitation: {
        Args: { p_admin_id: string; p_invitation_id: string };
        Returns: {
          new_status: string;
          result: string;
          slug: string;
        }[];
      };
      admin_suspend_invitation: {
        Args: { p_admin_id: string; p_invitation_id: string; p_reason: string };
        Returns: {
          result: string;
          slug: string;
        }[];
      };
      expire_pending_order: {
        Args: { p_order_code: string };
        Returns: {
          result: string;
        }[];
      };
      insert_gallery_media: {
        Args: {
          h: number;
          inv_id: string;
          media_id: string;
          path: string;
          w: number;
        };
        Returns: {
          created_at: string;
          height: number | null;
          id: string;
          invitation_id: string;
          sort_order: number;
          storage_path: string;
          type: Database["public"]["Enums"]["media_type"];
          width: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "media";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      insert_guest: {
        Args: {
          guest_group_label?: string;
          guest_name: string;
          guest_notes?: string;
          guest_pax?: number;
          guest_phone?: string;
          guest_token: string;
          inv_id: string;
        };
        Returns: {
          created_at: string;
          first_viewed_at: string | null;
          group_label: string | null;
          id: string;
          invitation_id: string;
          name: string;
          notes: string | null;
          pax_allocated: number;
          phone: string | null;
          token: string;
          wa_clicked_at: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "guests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      insert_guests_bulk: {
        Args: { guests: Json; inv_id: string };
        Returns: {
          created_at: string;
          first_viewed_at: string | null;
          group_label: string | null;
          id: string;
          invitation_id: string;
          name: string;
          notes: string | null;
          pax_allocated: number;
          phone: string | null;
          token: string;
          wa_clicked_at: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "guests";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      invitation_effective_limits: { Args: { inv_id: string }; Returns: Json };
      normalize_package_limits: { Args: { raw: Json }; Returns: Json };
      purge_invitation_data: {
        Args: { p_invitation_id: string };
        Returns: {
          media_paths: string[];
          result: string;
        }[];
      };
      replace_invitation_events: {
        Args: { events: Json; inv_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      gift_note_type: "transfer" | "gift";
      invitation_category: "wedding" | "corporate" | "family";
      invitation_status:
        "draft" | "pending_payment" | "active" | "expired" | "suspended";
      media_type: "photo";
      order_status: "pending" | "paid" | "expired" | "failed" | "refunded";
      profile_role: "client" | "admin";
      rsvp_attendance: "yes" | "no";
      theme_tier: "standard" | "premium";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      gift_note_type: ["transfer", "gift"],
      invitation_category: ["wedding", "corporate", "family"],
      invitation_status: [
        "draft",
        "pending_payment",
        "active",
        "expired",
        "suspended",
      ],
      media_type: ["photo"],
      order_status: ["pending", "paid", "expired", "failed", "refunded"],
      profile_role: ["client", "admin"],
      rsvp_attendance: ["yes", "no"],
      theme_tier: ["standard", "premium"],
    },
  },
} as const;
