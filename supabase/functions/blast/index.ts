// ============================================================
// Supabase Edge Function: /blast
// Mengirim pesan WhatsApp via Fonnte API
// Mendukung:
//   - POST /blast/h1      → Blasting ke semua PIC jadwal H-1
//   - POST /blast/{id}    → Kirim ke satu PIC berdasarkan event ID
// Runtime: Deno (TypeScript)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-fonnte-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper: Normalisasi nomor telepon → format internasional (628xxx)
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

// Helper: Kirim pesan via Fonnte API
async function sendViaFonnte(
  fonnteToken: string,
  phone: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const normalizedPhone = normalizePhone(phone);

  const formData = new FormData();
  formData.append("target", normalizedPhone);
  formData.append("message", message);
  formData.append("countryCode", "62");

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: fonnteToken,
    },
    body: formData,
  });

  const result = await response.json();
  console.log(`Fonnte response for ${normalizedPhone}:`, result);

  if (result.status === true) {
    return { success: true, message: `Pesan terkirim ke ${normalizedPhone}` };
  } else {
    return {
      success: false,
      message: result.reason || result.message || "Gagal mengirim pesan",
    };
  }
}

// Helper: Format pesan pengingat
function buildReminderMessage(event: {
  title: string;
  date: string;
  picName: string;
}): string {
  return (
    `Halo ${event.picName}, ini pengingat dari aplikasi KalRemind untuk kegiatan besok:\n\n` +
    `*${event.title}*\n` +
    `Tanggal: ${event.date}\n\n` +
    `Mohon balas pesan ini dengan kata *OK* atau *SIAP* untuk mengonfirmasi kehadiran/kesiapan Anda. Terima kasih! 🙏`
  );
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method tidak diizinkan." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Ambil Fonnte token dari header request atau dari body
    const body = await req.json().catch(() => ({}));
    const fonnteToken =
      req.headers.get("x-fonnte-token") ||
      body.fonnteToken ||
      Deno.env.get("FONNTE_TOKEN") ||
      "";

    if (!fonnteToken) {
      return new Response(
        JSON.stringify({
          error:
            "Token Fonnte tidak ditemukan. Masukkan token Fonnte di halaman Pengaturan aplikasi.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1]; // "h1" atau ID angka

    // ============================================================
    // POST /blast/h1 → Blasting semua jadwal H-1 yang masih pending
    // ============================================================
    if (lastSegment === "h1") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Format tanggal: YYYY-MM-DD
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const { data: targetEvents, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("date", tomorrowStr)
        .eq("status", "pending");

      if (fetchError) throw fetchError;

      if (!targetEvents || targetEvents.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            sent: 0,
            message: `Tidak ada jadwal H-1 (${tomorrowStr}) yang memerlukan pengingat.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = [];
      let successCount = 0;

      for (const event of targetEvents) {
        const message = buildReminderMessage(event);
        const result = await sendViaFonnte(fonnteToken, event.picPhone, message);

        if (result.success) {
          // Update status ke 'reminded'
          await supabase
            .from("events")
            .update({ status: "reminded" })
            .eq("id", event.id);
          successCount++;
        }

        results.push({
          id: event.id,
          title: event.title,
          picName: event.picName,
          picPhone: event.picPhone,
          ...result,
        });

        // Jeda 1 detik antar pesan untuk menghindari rate limiting Fonnte
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return new Response(
        JSON.stringify({
          success: true,
          sent: successCount,
          total: targetEvents.length,
          date: tomorrowStr,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // POST /blast/{id} → Kirim ke satu PIC berdasarkan event ID
    // ============================================================
    const eventId = Number(lastSegment);
    if (!isNaN(eventId)) {
      const { data: event, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (fetchError || !event) {
        return new Response(
          JSON.stringify({ error: "Jadwal tidak ditemukan." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (event.status === "confirmed") {
        return new Response(
          JSON.stringify({
            error: "Jadwal ini sudah terkonfirmasi, tidak perlu dikirim ulang.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const message = buildReminderMessage(event);
      const result = await sendViaFonnte(fonnteToken, event.picPhone, message);

      if (result.success) {
        await supabase
          .from("events")
          .update({ status: "reminded" })
          .eq("id", eventId);
        event.status = "reminded";
      }

      return new Response(
        JSON.stringify({ ...result, event }),
        {
          status: result.success ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Endpoint tidak valid. Gunakan /blast/h1 atau /blast/{id}" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error di Edge Function /blast:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
