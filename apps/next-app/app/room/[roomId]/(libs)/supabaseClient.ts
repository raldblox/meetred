"use client";

import { createClient } from "@supabase/supabase-js";

export function createRoomSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_METERED_SUPABASESUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_METERED_SUPABASESUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase credentials are missing");
  }

  return createClient(url, anonKey);
}
