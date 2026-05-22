// Placeholder Database type. Replace with output of:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// once the Supabase project exists and migrations have been applied.

export type Database = {
    public: {
        Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
        Views: Record<string, { Row: Record<string, unknown> }>;
        Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
        Enums: Record<string, string>;
        CompositeTypes: Record<string, Record<string, unknown>>;
    };
};
