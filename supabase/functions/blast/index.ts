// ============================================================
// Supabase Edge Function: /blast
// Mengirim pesan WhatsApp via Fonnte API
// Mendukung:
//   - POST /blast/h1      → Blasting ke semua PIC jadwal H-1 (besok)
//   - POST /blast/h2      → Blasting ke semua PIC jadwal H-2 (2 hari lagi)
//   - POST /blast/h3      → Blasting ke semua PIC jadwal H-3 (3 hari lagi)
//   - POST /blast/h7      → Blasting ke semua PIC jadwal H-7 (7 hari lagi)
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
// Menghapus semua karakter non-digit, lalu pastikan awalan 62
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("62")) {
    // Sudah benar, tidak perlu diubah
    return cleaned;
  } else if (cleaned.startsWith("0")) {
    // Ganti 0 di depan dengan 62
    return "62" + cleaned.substring(1);
  } else {
    // Tidak ada awalan sama sekali, tambahkan 62
    return "62" + cleaned;
  }
}

// Helper: Dapatkan tanggal target YYYY-MM-DD dalam zona waktu WIB (UTC+7)
// daysAhead: jumlah hari ke depan (1 = besok, 2 = lusa, dst.)
function getTargetDateWIB(daysAhead: number): string {
  const nowUTC = new Date();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(nowUTC.getTime() + wibOffsetMs);
  const target = new Date(nowWIB.getTime());
  target.setDate(target.getDate() + daysAhead);
  const year  = target.getUTCFullYear();
  const month = String(target.getUTCMonth() + 1).padStart(2, "0");
  const day   = String(target.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper: Kirim pesan via Fonnte API menggunakan JSON body
// (lebih andal daripada FormData di lingkungan Deno Edge Function)
async function sendViaFonnte(
  fonnteToken: string,
  phone: string,
  message: string
): Promise<{ success: boolean; message: string; detail?: unknown }> {
  const normalizedPhone = normalizePhone(phone);

  console.log(`[Fonnte] Mengirim ke nomor: ${normalizedPhone}`);

  // PERBAIKAN BUG #1: Gunakan JSON body, bukan FormData
  // PERBAIKAN BUG #2: Hapus countryCode agar tidak terjadi double-prefix (628xxx + 62 = 62628xxx)
  const payload = {
    target: normalizedPhone,
    message: message,
    // countryCode SENGAJA DIHAPUS karena nomor sudah dinormalisasi ke format 62xxx
  };

  let response: Response;
  try {
    response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": fonnteToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.error("[Fonnte] Network error:", networkErr);
    const errorMessage = networkErr instanceof Error ? networkErr.message : String(networkErr);
    return {
      success: false,
      message: `Gagal terhubung ke Fonnte API: ${errorMessage}`,
    };
  }

  let result: Record<string, unknown>;
  try {
    result = await response.json();
  } catch {
    const rawText = await response.text().catch(() => "(tidak bisa dibaca)");
    console.error("[Fonnte] Response bukan JSON:", rawText);
    return {
      success: false,
      message: `Fonnte mengembalikan response tidak valid (HTTP ${response.status}): ${rawText}`,
    };
  }

  console.log(`[Fonnte] Response untuk ${normalizedPhone}:`, JSON.stringify(result));

  // Fonnte mengembalikan { status: true, ... } jika berhasil
  if (result.status === true) {
    return {
      success: true,
      message: `Pesan berhasil dikirim ke ${normalizedPhone}`,
      detail: result,
    };
  } else {
    // Tampilkan semua field error yang mungkin dikirim Fonnte
    const errMsg =
      (result.reason as string) ||
      (result.message as string) ||
      (result.error as string) ||
      `HTTP ${response.status}: Pesan gagal dikirim`;
    console.error(`[Fonnte] Gagal kirim ke ${normalizedPhone}:`, errMsg, result);
    return {
      success: false,
      message: errMsg,
      detail: result,
    };
  }
}

// Helper: Format pesan pengingat
// daysAhead: 1 = besok, 2+ = X hari lagi
function buildReminderMessage(
  event: { title: string; date: string; picName: string },
  daysAhead = 1
): string {
  let timeDesc: string;
  if (daysAhead === 1) {
    timeDesc = "besok";
  } else if (daysAhead === 7) {
    timeDesc = "7 hari lagi (seminggu lagi)";
  } else {
    timeDesc = `${daysAhead} hari lagi`;
  }
  return (
    `Halo ${event.picName}, ini pengingat dari aplikasi *KALCER* (Kalender Cerdas Reminder) untuk kegiatan *${timeDesc}*:\n\n` +
    `📌 *${event.title}*\n` +
    `📅 Tanggal: ${event.date}\n\n` +
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
    // PERBAIKAN BUG #3: Baca URL path SEBELUM mencoba parsing body,
    // agar tidak ada konflik dengan body consumption
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1]; // "h1" atau ID angka

    // Ambil Fonnte token dari header (prioritas) atau dari body JSON
    // Header lebih diutamakan karena tidak mengkonsumsi body
    const tokenFromHeader = req.headers.get("x-fonnte-token");

    let fonnteToken = tokenFromHeader || Deno.env.get("FONNTE_TOKEN") || "";

    // Hanya parse body jika token tidak ada di header (hindari double parsing)
    let parsedBody: Record<string, unknown> = {};
    if (!fonnteToken) {
      try {
        parsedBody = await req.json();
        fonnteToken = (parsedBody.fonnteToken as string) || "";
      } catch {
        // Body mungkin kosong, tidak masalah
      }
    }

    console.log(`[Blast] Path: ${url.pathname}, Segment: ${lastSegment}, Token ada: ${!!fonnteToken}`);

    if (!fonnteToken) {
      return new Response(
        JSON.stringify({
          error: "Token Fonnte tidak ditemukan. Masukkan token Fonnte di halaman Pengaturan aplikasi.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ============================================================
    // POST /blast/hN → Blasting semua jadwal H-N yang masih pending
    // Contoh: /blast/h1, /blast/h2, /blast/h3, /blast/h7
    // ============================================================
    const hMatch = lastSegment.match(/^h(\d+)$/);
    if (hMatch) {
      const daysAhead = parseInt(hMatch[1], 10);
      if (daysAhead < 1 || daysAhead > 30) {
        return new Response(
          JSON.stringify({ error: "Nilai H harus antara 1 dan 30. Contoh: /blast/h1, /blast/h7" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const targetDateStr = getTargetDateWIB(daysAhead);
      console.log(`[Blast H-${daysAhead}] Mencari jadwal untuk tanggal: ${targetDateStr}`);

      const { data: targetEvents, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("date", targetDateStr)
        .eq("status", "pending");

      if (fetchError) throw fetchError;

      if (!targetEvents || targetEvents.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            sent: 0,
            daysAhead,
            message: `Tidak ada jadwal H-${daysAhead} (${targetDateStr}) yang memerlukan pengingat.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Blast H-${daysAhead}] Ditemukan ${targetEvents.length} jadwal untuk ${targetDateStr}`);

      const results = [];
      let successCount = 0;

      for (const event of targetEvents) {
        const message = buildReminderMessage(event, daysAhead);
        const result = await sendViaFonnte(fonnteToken, event.picPhone, message);

        if (result.success) {
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
          normalizedPhone: normalizePhone(event.picPhone),
          ...result,
        });

        // Jeda 3 menit antar pesan untuk menghindari deteksi spam WhatsApp
        if (targetEvents.indexOf(event) < targetEvents.length - 1) {
          console.log(`[Blast H-${daysAhead}] Menunggu 3 menit (180 detik) sebelum pesan berikutnya...`);
          await new Promise((resolve) => setTimeout(resolve, 180000));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          sent: successCount,
          total: targetEvents.length,
          daysAhead,
          date: targetDateStr,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // POST /blast/{id} → Kirim ke satu PIC berdasarkan event ID
    // ============================================================
    const eventId = Number(lastSegment);
    if (!isNaN(eventId) && eventId > 0) {
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

      console.log(`[Blast Single] Mengirim ke event ID ${eventId}: ${event.title} → ${event.picPhone}`);

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
        JSON.stringify({
          ...result,
          normalizedPhone: normalizePhone(event.picPhone),
          event,
        }),
        {
          status: result.success ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Endpoint tidak valid. Gunakan /blast/h1, /blast/h2, /blast/h3, /blast/h7, atau /blast/{id}" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Blast] Error tidak terduga:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
