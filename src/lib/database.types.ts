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
      activiteittype: {
        Row: {
          id: string
          naam: string
          normuren_afronding: number
          normuren_uitvoering: number
          normuren_voorbereiding: number
        }
        Insert: {
          id?: string
          naam: string
          normuren_afronding?: number
          normuren_uitvoering?: number
          normuren_voorbereiding?: number
        }
        Update: {
          id?: string
          naam?: string
          normuren_afronding?: number
          normuren_uitvoering?: number
          normuren_voorbereiding?: number
        }
        Relationships: []
      }
      auditlog: {
        Row: {
          actie: string
          gebruiker_id: string | null
          id: number
          nieuwe_waarde: Json | null
          oude_waarde: Json | null
          record_id: string | null
          tabel: string | null
          tijdstip: string
        }
        Insert: {
          actie: string
          gebruiker_id?: string | null
          id?: never
          nieuwe_waarde?: Json | null
          oude_waarde?: Json | null
          record_id?: string | null
          tabel?: string | null
          tijdstip?: string
        }
        Update: {
          actie?: string
          gebruiker_id?: string | null
          id?: never
          nieuwe_waarde?: Json | null
          oude_waarde?: Json | null
          record_id?: string | null
          tabel?: string | null
          tijdstip?: string
        }
        Relationships: []
      }
      boeking: {
        Row: {
          artikelcode: string
          categorie: Database["public"]["Enums"]["boeking_categorie"] | null
          datum: string
          id: string
          import_id: string
          matt_project_id: string
          medewerker_id: string
          uren: number
          uren_open: number
        }
        Insert: {
          artikelcode: string
          categorie?: Database["public"]["Enums"]["boeking_categorie"] | null
          datum: string
          id?: string
          import_id: string
          matt_project_id: string
          medewerker_id: string
          uren: number
          uren_open?: number
        }
        Update: {
          artikelcode?: string
          categorie?: Database["public"]["Enums"]["boeking_categorie"] | null
          datum?: string
          id?: string
          import_id?: string
          matt_project_id?: string
          medewerker_id?: string
          uren?: number
          uren_open?: number
        }
        Relationships: [
          {
            foreignKeyName: "boeking_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "matt_import"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boeking_matt_project_id_fkey"
            columns: ["matt_project_id"]
            isOneToOne: false
            referencedRelation: "matt_project"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boeking_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
        ]
      }
      boeking_omschrijving: {
        Row: {
          boeking_id: string
          omschrijving: string
        }
        Insert: {
          boeking_id: string
          omschrijving: string
        }
        Update: {
          boeking_id?: string
          omschrijving?: string
        }
        Relationships: [
          {
            foreignKeyName: "boeking_omschrijving_boeking_id_fkey"
            columns: ["boeking_id"]
            isOneToOne: true
            referencedRelation: "boeking"
            referencedColumns: ["id"]
          },
        ]
      }
      contract: {
        Row: {
          geldig_tot: string | null
          geldig_van: string
          id: string
          medewerker_id: string
          uren_per_week: number
        }
        Insert: {
          geldig_tot?: string | null
          geldig_van: string
          id?: string
          medewerker_id: string
          uren_per_week: number
        }
        Update: {
          geldig_tot?: string | null
          geldig_van?: string
          id?: string
          medewerker_id?: string
          uren_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
        ]
      }
      feestdag: {
        Row: {
          datum: string
          id: string
          naam: string
        }
        Insert: {
          datum: string
          id?: string
          naam: string
        }
        Update: {
          datum?: string
          id?: string
          naam?: string
        }
        Relationships: []
      }
      gebruiker_rol: {
        Row: {
          gebruiker_id: string
          id: string
          rol: Database["public"]["Enums"]["rol"]
        }
        Insert: {
          gebruiker_id: string
          id?: string
          rol: Database["public"]["Enums"]["rol"]
        }
        Update: {
          gebruiker_id?: string
          id?: string
          rol?: Database["public"]["Enums"]["rol"]
        }
        Relationships: []
      }
      instelling: {
        Row: {
          id: string
          ingangsdatum: string
          sleutel: string
          waarde: string
        }
        Insert: {
          id?: string
          ingangsdatum: string
          sleutel: string
          waarde: string
        }
        Update: {
          id?: string
          ingangsdatum?: string
          sleutel?: string
          waarde?: string
        }
        Relationships: []
      }
      matt_artikel_mapping: {
        Row: {
          artikelcode: string
          categorie: Database["public"]["Enums"]["boeking_categorie"]
          id: string
        }
        Insert: {
          artikelcode: string
          categorie: Database["public"]["Enums"]["boeking_categorie"]
          id?: string
        }
        Update: {
          artikelcode?: string
          categorie?: Database["public"]["Enums"]["boeking_categorie"]
          id?: string
        }
        Relationships: []
      }
      matt_import: {
        Row: {
          aantallen: Json
          id: string
          periode_tot: string
          periode_van: string
          status: Database["public"]["Enums"]["import_status"]
          tijdstip: string
          totaal_uren: number
          uitgevoerd_door: string | null
        }
        Insert: {
          aantallen?: Json
          id?: string
          periode_tot: string
          periode_van: string
          status?: Database["public"]["Enums"]["import_status"]
          tijdstip?: string
          totaal_uren?: number
          uitgevoerd_door?: string | null
        }
        Update: {
          aantallen?: Json
          id?: string
          periode_tot?: string
          periode_van?: string
          status?: Database["public"]["Enums"]["import_status"]
          tijdstip?: string
          totaal_uren?: number
          uitgevoerd_door?: string | null
        }
        Relationships: []
      }
      matt_project: {
        Row: {
          genegeerd: boolean
          id: string
          naam_laatst_gezien: string | null
          projectnummer: string
          werkpakket_id: string | null
        }
        Insert: {
          genegeerd?: boolean
          id?: string
          naam_laatst_gezien?: string | null
          projectnummer: string
          werkpakket_id?: string | null
        }
        Update: {
          genegeerd?: boolean
          id?: string
          naam_laatst_gezien?: string | null
          projectnummer?: string
          werkpakket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matt_project_werkpakket_id_fkey"
            columns: ["werkpakket_id"]
            isOneToOne: false
            referencedRelation: "werkpakket"
            referencedColumns: ["id"]
          },
        ]
      }
      medewerker: {
        Row: {
          achternaam: string
          actief: boolean
          email: string
          id: string
          voornaam: string
        }
        Insert: {
          achternaam: string
          actief?: boolean
          email: string
          id?: string
          voornaam: string
        }
        Update: {
          achternaam?: string
          actief?: boolean
          email?: string
          id?: string
          voornaam?: string
        }
        Relationships: []
      }
      medewerker_alias: {
        Row: {
          alias: string
          alias_genormaliseerd: string | null
          bron: Database["public"]["Enums"]["alias_bron"]
          id: string
          medewerker_id: string
        }
        Insert: {
          alias: string
          alias_genormaliseerd?: string | null
          bron: Database["public"]["Enums"]["alias_bron"]
          id?: string
          medewerker_id: string
        }
        Update: {
          alias?: string
          alias_genormaliseerd?: string | null
          bron?: Database["public"]["Enums"]["alias_bron"]
          id?: string
          medewerker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medewerker_alias_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
        ]
      }
      niet_beschikbaar: {
        Row: {
          beschikbaarheidspercentage: number
          id: string
          medewerker_id: string
          tot: string
          van: string
        }
        Insert: {
          beschikbaarheidspercentage: number
          id?: string
          medewerker_id: string
          tot: string
          van: string
        }
        Update: {
          beschikbaarheidspercentage?: number
          id?: string
          medewerker_id?: string
          tot?: string
          van?: string
        }
        Relationships: [
          {
            foreignKeyName: "niet_beschikbaar_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
        ]
      }
      opslagfactor: {
        Row: {
          bevestigd: boolean
          factor: number
          id: string
          schooljaar_id: string
          schooltype: Database["public"]["Enums"]["schooltype"]
        }
        Insert: {
          bevestigd?: boolean
          factor: number
          id?: string
          schooljaar_id: string
          schooltype: Database["public"]["Enums"]["schooltype"]
        }
        Update: {
          bevestigd?: boolean
          factor?: number
          id?: string
          schooljaar_id?: string
          schooltype?: Database["public"]["Enums"]["schooltype"]
        }
        Relationships: [
          {
            foreignKeyName: "opslagfactor_schooljaar_id_fkey"
            columns: ["schooljaar_id"]
            isOneToOne: false
            referencedRelation: "schooljaar"
            referencedColumns: ["id"]
          },
        ]
      }
      profiel: {
        Row: {
          gebruiker_id: string
          medewerker_id: string
          moet_wachtwoord_wijzigen: boolean
        }
        Insert: {
          gebruiker_id: string
          medewerker_id: string
          moet_wachtwoord_wijzigen?: boolean
        }
        Update: {
          gebruiker_id?: string
          medewerker_id?: string
          moet_wachtwoord_wijzigen?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiel_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: true
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
        ]
      }
      school: {
        Row: {
          adres: string | null
          plaats: string | null
          postcode: string | null
          schooltype: Database["public"]["Enums"]["schooltype"]
          soort: Database["public"]["Enums"]["werkpakket_soort"]
          werkpakket_id: string
        }
        Insert: {
          adres?: string | null
          plaats?: string | null
          postcode?: string | null
          schooltype: Database["public"]["Enums"]["schooltype"]
          soort?: Database["public"]["Enums"]["werkpakket_soort"]
          werkpakket_id: string
        }
        Update: {
          adres?: string | null
          plaats?: string | null
          postcode?: string | null
          schooltype?: Database["public"]["Enums"]["schooltype"]
          soort?: Database["public"]["Enums"]["werkpakket_soort"]
          werkpakket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_werkpakket_id_soort_fkey"
            columns: ["werkpakket_id", "soort"]
            isOneToOne: false
            referencedRelation: "werkpakket"
            referencedColumns: ["id", "soort"]
          },
        ]
      }
      school_schooljaar: {
        Row: {
          aantal_leerlingen: number
          id: string
          school_id: string
          schooljaar_id: string
          toelichting: string | null
          uren_handmatig: number | null
        }
        Insert: {
          aantal_leerlingen: number
          id?: string
          school_id: string
          schooljaar_id: string
          toelichting?: string | null
          uren_handmatig?: number | null
        }
        Update: {
          aantal_leerlingen?: number
          id?: string
          school_id?: string
          schooljaar_id?: string
          toelichting?: string | null
          uren_handmatig?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "school_schooljaar_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school"
            referencedColumns: ["werkpakket_id"]
          },
          {
            foreignKeyName: "school_schooljaar_schooljaar_id_fkey"
            columns: ["schooljaar_id"]
            isOneToOne: false
            referencedRelation: "schooljaar"
            referencedColumns: ["id"]
          },
        ]
      }
      schooljaar: {
        Row: {
          einddatum: string
          id: string
          naam: string
          startdatum: string
        }
        Insert: {
          einddatum: string
          id?: string
          naam: string
          startdatum: string
        }
        Update: {
          einddatum?: string
          id?: string
          naam?: string
          startdatum?: string
        }
        Relationships: []
      }
      schoolvakantie: {
        Row: {
          id: string
          naam: string
          schooljaar_id: string
          tot: string
          van: string
        }
        Insert: {
          id?: string
          naam: string
          schooljaar_id: string
          tot: string
          van: string
        }
        Update: {
          id?: string
          naam?: string
          schooljaar_id?: string
          tot?: string
          van?: string
        }
        Relationships: [
          {
            foreignKeyName: "schoolvakantie_schooljaar_id_fkey"
            columns: ["schooljaar_id"]
            isOneToOne: false
            referencedRelation: "schooljaar"
            referencedColumns: ["id"]
          },
        ]
      }
      staffel: {
        Row: {
          id: string
          leerlingen_max: number | null
          leerlingen_min: number
          schooljaar_id: string
          schooltype: Database["public"]["Enums"]["schooltype"]
          uren: number
        }
        Insert: {
          id?: string
          leerlingen_max?: number | null
          leerlingen_min: number
          schooljaar_id: string
          schooltype: Database["public"]["Enums"]["schooltype"]
          uren: number
        }
        Update: {
          id?: string
          leerlingen_max?: number | null
          leerlingen_min?: number
          schooljaar_id?: string
          schooltype?: Database["public"]["Enums"]["schooltype"]
          uren?: number
        }
        Relationships: [
          {
            foreignKeyName: "staffel_schooljaar_id_fkey"
            columns: ["schooljaar_id"]
            isOneToOne: false
            referencedRelation: "schooljaar"
            referencedColumns: ["id"]
          },
        ]
      }
      toewijzing: {
        Row: {
          aandeel_percentage: number
          aantal_keer: number | null
          bron: Database["public"]["Enums"]["uren_bron"]
          gepland_afronding: number | null
          gepland_uitvoering: number | null
          gepland_voorbereiding: number | null
          id: string
          looptijd_tot: string | null
          looptijd_van: string | null
          medewerker_id: string
          schooljaar_id: string
          toelichting: string | null
          verdeling: Database["public"]["Enums"]["verdeling"]
          werkpakket_id: string
        }
        Insert: {
          aandeel_percentage?: number
          aantal_keer?: number | null
          bron: Database["public"]["Enums"]["uren_bron"]
          gepland_afronding?: number | null
          gepland_uitvoering?: number | null
          gepland_voorbereiding?: number | null
          id?: string
          looptijd_tot?: string | null
          looptijd_van?: string | null
          medewerker_id: string
          schooljaar_id: string
          toelichting?: string | null
          verdeling: Database["public"]["Enums"]["verdeling"]
          werkpakket_id: string
        }
        Update: {
          aandeel_percentage?: number
          aantal_keer?: number | null
          bron?: Database["public"]["Enums"]["uren_bron"]
          gepland_afronding?: number | null
          gepland_uitvoering?: number | null
          gepland_voorbereiding?: number | null
          id?: string
          looptijd_tot?: string | null
          looptijd_van?: string | null
          medewerker_id?: string
          schooljaar_id?: string
          toelichting?: string | null
          verdeling?: Database["public"]["Enums"]["verdeling"]
          werkpakket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toewijzing_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toewijzing_schooljaar_id_fkey"
            columns: ["schooljaar_id"]
            isOneToOne: false
            referencedRelation: "schooljaar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toewijzing_werkpakket_id_fkey"
            columns: ["werkpakket_id"]
            isOneToOne: false
            referencedRelation: "werkpakket"
            referencedColumns: ["id"]
          },
        ]
      }
      toewijzing_datum: {
        Row: {
          datum: string
          id: string
          toewijzing_id: string
        }
        Insert: {
          datum: string
          id?: string
          toewijzing_id: string
        }
        Update: {
          datum?: string
          id?: string
          toewijzing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toewijzing_datum_toewijzing_id_fkey"
            columns: ["toewijzing_id"]
            isOneToOne: false
            referencedRelation: "toewijzing"
            referencedColumns: ["id"]
          },
        ]
      }
      vakantie_uren: {
        Row: {
          id: string
          kalenderjaar: number
          medewerker_id: string
          uren: number
        }
        Insert: {
          id?: string
          kalenderjaar: number
          medewerker_id: string
          uren: number
        }
        Update: {
          id?: string
          kalenderjaar?: number
          medewerker_id?: string
          uren?: number
        }
        Relationships: [
          {
            foreignKeyName: "vakantie_uren_medewerker_id_fkey"
            columns: ["medewerker_id"]
            isOneToOne: false
            referencedRelation: "medewerker"
            referencedColumns: ["id"]
          },
        ]
      }
      werkpakket: {
        Row: {
          actief: boolean
          activiteittype_id: string | null
          id: string
          naam: string
          soort: Database["public"]["Enums"]["werkpakket_soort"]
          vestiging: Database["public"]["Enums"]["vestiging"]
        }
        Insert: {
          actief?: boolean
          activiteittype_id?: string | null
          id?: string
          naam: string
          soort: Database["public"]["Enums"]["werkpakket_soort"]
          vestiging: Database["public"]["Enums"]["vestiging"]
        }
        Update: {
          actief?: boolean
          activiteittype_id?: string | null
          id?: string
          naam?: string
          soort?: Database["public"]["Enums"]["werkpakket_soort"]
          vestiging?: Database["public"]["Enums"]["vestiging"]
        }
        Relationships: [
          {
            foreignKeyName: "werkpakket_activiteittype_id_fkey"
            columns: ["activiteittype_id"]
            isOneToOne: false
            referencedRelation: "activiteittype"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_reset_voorbereiden: {
        Args: { p_gebruiker_id: string }
        Returns: undefined
      }
      boeking_details_van_ander: {
        Args: { p_medewerker_id: string; p_tot: string; p_van: string }
        Returns: {
          artikelcode: string
          boeking_id: string
          categorie: Database["public"]["Enums"]["boeking_categorie"]
          datum: string
          matt_project_id: string
          omschrijving: string
          uren: number
          uren_open: number
        }[]
      }
      mag_gebruikers_beheren: { Args: never; Returns: boolean }
      mijn_status: { Args: never; Returns: Json }
    }
    Enums: {
      alias_bron: "matt" | "planning"
      boeking_categorie:
        | "uitvoering"
        | "voorbereiding_afronding"
        | "relatiebeheer"
      import_status: "concept" | "definitief" | "teruggedraaid"
      rol: "lmc" | "coordinator" | "manager" | "beheerder"
      schooltype: "PO" | "VO" | "BoekStart"
      uren_bron: "staffel" | "norm_x_aantal" | "handmatig"
      verdeling: "schoolweken" | "looptijd" | "op_datum"
      vestiging: "HAR" | "ERM" | "NUN" | "PUT" | "ELS" | "overig"
      werkpakket_soort: "school" | "activiteit" | "project"
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
    Enums: {
      alias_bron: ["matt", "planning"],
      boeking_categorie: [
        "uitvoering",
        "voorbereiding_afronding",
        "relatiebeheer",
      ],
      import_status: ["concept", "definitief", "teruggedraaid"],
      rol: ["lmc", "coordinator", "manager", "beheerder"],
      schooltype: ["PO", "VO", "BoekStart"],
      uren_bron: ["staffel", "norm_x_aantal", "handmatig"],
      verdeling: ["schoolweken", "looptijd", "op_datum"],
      vestiging: ["HAR", "ERM", "NUN", "PUT", "ELS", "overig"],
      werkpakket_soort: ["school", "activiteit", "project"],
    },
  },
} as const

