// ============================================================
// Supabase Edge Function: /events
// Handles CRUD operations for the events table
// Runtime: Deno (TypeScript)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    // Ekstrak ID dari URL: /events/{id}
    const pathParts = url.pathname.split("/").filter(Boolean);
    const id = pathParts[pathParts.length - 1];
    const hasId = id && !isNaN(Number(id));

    // === GET /events → Ambil semua jadwal ===
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === POST /events → Tambah jadwal baru ===
    if (req.method === "POST" && !hasId) {
      const body = await req.json();
      const { title, date, category, picName, picPhone } = body;

      if (!title || !date || !category || !picName || !picPhone) {
        return new Response(
          JSON.stringify({ error: "Semua field wajib diisi." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("events")
        .insert([{ title, date, category, picName, picPhone, status: "pending" }])
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === PUT /events/{id} → Update status/data jadwal ===
    if (req.method === "PUT" && hasId) {
      const body = await req.json();

      const { data, error } = await supabase
        .from("events")
        .update(body)
        .eq("id", Number(id))
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Event tidak ditemukan." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DELETE /events/{id} → Hapus jadwal ===
    if (req.method === "DELETE" && hasId) {
      const { error, count } = await supabase
        .from("events")
        .delete({ count: "exact" })
        .eq("id", Number(id));

      if (error) throw error;
      if (count === 0) {
        return new Response(JSON.stringify({ error: "Event tidak ditemukan." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method tidak diizinkan." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error di Edge Function /events:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
