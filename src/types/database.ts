/**
 * Tipe database — DIGENERATE dari skema Supabase (migrasi v1+).
 * Regenerate setelah migrasi baru:
 *   pnpm supabase gen types typescript --project-id <ref> > src/types/database.ts
 *   # atau via Supabase MCP: generate_typescript_types
 *
 * Jangan diedit manual, KECUALI dua penyimpangan sengaja yang harus dipasang
 * ulang setiap kali berkas ini digenerate (dijaga `tests/unit/db-types.test.ts`):
 *
 *  1. `invitations.user_id` & `orders.user_id` pada **Row** bertipe
 *     `string | null`. Keduanya memang nullable sejak migrasi hapus-akun
 *     (20261003140000): baris dianonimkan dengan `user_id = NULL` demi
 *     kewajiban pembukuan. Hasil generate sebelumnya menyatakannya non-null,
 *     sehingga tak ada satu pun pemanggil yang dipaksa menjaganya.
 *  2. Pada **Insert/Update** keduanya tetap WAJIB/`string` — lebih ketat
 *     daripada DB, dan disengaja: hanya RPC `admin_delete_account` (service_role,
 *     di dalam SQL) yang boleh menulis NULL. Kode aplikasi yang lupa mengisi
 *     pemilik harus tetap gagal di compile.
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
      cron_runs: {
        Row: {
          failures: number;
          last_error: string | null;
          last_ok_at: string | null;
          last_run_at: string;
          name: string;
          ok: boolean;
          runs: number;
          stats: Json;
        };
        Insert: {
          failures?: number;
          last_error?: string | null;
          last_ok_at?: string | null;
          last_run_at?: string;
          name: string;
          ok: boolean;
          runs?: number;
          stats?: Json;
        };
        Update: {
          failures?: number;
          last_error?: string | null;
          last_ok_at?: string | null;
          last_run_at?: string;
          name?: string;
          ok?: boolean;
          runs?: number;
          stats?: Json;
        };
        Relationships: [];
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
          start_at: string | null;
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
          start_at?: string | null;
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
          start_at?: string | null;
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
          purge_final_warned_at: string | null;
          purge_warned_at: string | null;
          purged_at: string | null;
          reminder_sent_at: string | null;
          settings: Json;
          share_template: string | null;
          share_template_general: string | null;
          slug: string;
          status: Database["public"]["Enums"]["invitation_status"];
          theme_id: string;
          updated_at: string;
          user_id: string | null;
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
          purge_final_warned_at?: string | null;
          purge_warned_at?: string | null;
          purged_at?: string | null;
          reminder_sent_at?: string | null;
          settings?: Json;
          share_template?: string | null;
          share_template_general?: string | null;
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
          purge_final_warned_at?: string | null;
          purge_warned_at?: string | null;
          purged_at?: string | null;
          reminder_sent_at?: string | null;
          settings?: Json;
          share_template?: string | null;
          share_template_general?: string | null;
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
      momen_albums: {
        Row: {
          allow_library_upload: boolean;
          created_at: string;
          default_filter: string;
          id: string;
          invitation_id: string;
          photo_ceiling: number | null;
          photo_count: number;
          quota_per_guest: number;
          quota_peserta: number | null;
          reveal_at: string | null;
          status: string;
        };
        Insert: {
          allow_library_upload?: boolean;
          created_at?: string;
          default_filter?: string;
          id?: string;
          invitation_id: string;
          photo_ceiling?: number | null;
          photo_count?: number;
          quota_per_guest?: number;
          quota_peserta?: number | null;
          reveal_at?: string | null;
          status?: string;
        };
        Update: {
          allow_library_upload?: boolean;
          created_at?: string;
          default_filter?: string;
          id?: string;
          invitation_id?: string;
          photo_ceiling?: number | null;
          photo_count?: number;
          quota_per_guest?: number;
          quota_peserta?: number | null;
          reveal_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "momen_albums_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: true;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      momen_photos: {
        Row: {
          album_id: string;
          bytes: number;
          created_at: string;
          device_id: string;
          filter_id: string;
          guest_name: string;
          height: number;
          id: string;
          purged_at: string | null;
          status: string;
          storage_path: string;
          thumb_path: string;
          width: number;
        };
        Insert: {
          album_id: string;
          bytes: number;
          created_at?: string;
          device_id: string;
          filter_id: string;
          guest_name: string;
          height: number;
          id?: string;
          purged_at?: string | null;
          status?: string;
          storage_path: string;
          thumb_path: string;
          width: number;
        };
        Update: {
          album_id?: string;
          bytes?: number;
          created_at?: string;
          device_id?: string;
          filter_id?: string;
          guest_name?: string;
          height?: number;
          id?: string;
          purged_at?: string | null;
          status?: string;
          storage_path?: string;
          thumb_path?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "momen_photos_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "momen_albums";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          txn_id: string | null;
          amount_idr: number;
          created_at: string;
          id: string;
          invitation_id: string;
          order_code: string;
          package_id: string;
          paid_at: string | null;
          payment_method: string | null;
          purpose: string;
          qr_content: string | null;
          raw_notification: Json | null;
          status: Database["public"]["Enums"]["order_status"];
          user_id: string | null;
        };
        Insert: {
          txn_id?: string | null;
          amount_idr: number;
          created_at?: string;
          id?: string;
          invitation_id: string;
          order_code: string;
          package_id: string;
          paid_at?: string | null;
          payment_method?: string | null;
          purpose?: string;
          qr_content?: string | null;
          raw_notification?: Json | null;
          status?: Database["public"]["Enums"]["order_status"];
          user_id: string;
        };
        Update: {
          txn_id?: string | null;
          amount_idr?: number;
          created_at?: string;
          id?: string;
          invitation_id?: string;
          order_code?: string;
          package_id?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          purpose?: string;
          qr_content?: string | null;
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
          kind: string;
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
          kind?: string;
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
          kind?: string;
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
      activate_free_order: {
        Args: {
          p_actor_id: string;
          p_invitation_id: string;
          p_order_code: string;
          p_package_id: string;
          p_purpose: string;
        };
        Returns: {
          result: string;
          slug: string;
        }[];
      };
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
      admin_delete_account: {
        Args: { p_admin_id: string; p_reason: string; p_user_id: string };
        Returns: {
          // Array path null pada hasil 'not_found'/'has_active' — koreksi
          // manual seperti create_momen_album. Pertahankan saat regen.
          media_paths: string[] | null;
          momen_paths: string[] | null;
          purged_count: number;
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
      admin_refund_order: {
        Args: { p_admin_id: string; p_order_code: string; p_reason: string };
        Returns: {
          // `inv_id` SENGAJA bukan `invitation_id`: nama itu menaungi kolom
          // `momen_albums.invitation_id` di dalam fungsi dan membuat setiap
          // refund add-on gagal "ambiguous" (DECISIONS #52). Null pada
          // 'not_found' — koreksi manual, pertahankan saat regen.
          inv_id: string | null;
          result: string;
          slug: string | null;
        }[];
      };
      admin_suspend_invitation: {
        // `p_public_reason`: alasan yang dikirim ke pemilik lewat email, terpisah
        // dari `p_reason` yang hanya masuk audit log internal (DECISIONS #68).
        //
        // WAJIB di sini meski SQL-nya `default null`. Alasannya empiris: dengan
        // satu properti saja ditandai `?`, TypeScript BERHENTI menolak properti
        // berlebih pada argumen `rpc()` untuk fungsi ini — `p_public_reason_SALAH`
        // lolos typecheck dan baru gagal saat dijalankan. Default di SQL ada demi
        // urutan deploy (DB baru + app lama), bukan demi pemanggil di repo ini,
        // dan setiap pemanggil di sini memang selalu mengirimnya.
        // Koreksi manual — pertahankan saat regen.
        Args: {
          p_admin_id: string;
          p_invitation_id: string;
          p_reason: string;
          p_public_reason: string | null;
        };
        Returns: {
          result: string;
          slug: string;
        }[];
      };
      create_momen_album: {
        Args: {
          p_default_filter?: string;
          p_invitation_id: string;
          // Nullable di SQL (null = tak terbatas / tanpa plafon) — koreksi manual
          // seperti activate_paid_order. Pertahankan saat regen.
          p_photo_ceiling: number | null;
          p_quota_peserta: number | null;
        };
        Returns: string;
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
      momen_album_stats: {
        Args: { p_album_id: string };
        Returns: {
          hidden_count: number;
          participant_count: number;
          photographer_count: number;
          visible_count: number;
        }[];
      };
      momen_claim_upload: {
        Args: { p_album_id: string; p_device_id: string };
        Returns: {
          photo_id: string | null;
          remaining: number;
          result: string;
        }[];
      };
      momen_confirm_photo: {
        Args: {
          p_album_id: string;
          p_bytes: number;
          p_device_id: string;
          p_filter_id: string;
          p_guest_name: string;
          p_height: number;
          p_photo_id: string;
          p_storage_path: string;
          p_thumb_path: string;
          p_width: number;
        };
        Returns: {
          remaining: number;
          result: string;
        }[];
      };
      normalize_package_limits: { Args: { raw: Json }; Returns: Json };
      purge_invitation_data: {
        Args: { p_invitation_id: string };
        Returns: {
          media_paths: string[];
          momen_paths: string[];
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
      profile_role: "client" | "admin" | "pro";
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
      profile_role: ["client", "admin", "pro"],
      rsvp_attendance: ["yes", "no"],
      theme_tier: ["standard", "premium"],
    },
  },
} as const;
