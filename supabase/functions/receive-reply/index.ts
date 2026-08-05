// ============================================================
// Supabase Edge Function: /receive-reply
// Webhook endpoint untuk menerima notifikasi balasan dari Fonnte
// Ketika PIC membalas pesan, Fonnte akan POST ke URL ini.
// Konfigurasikan Webhook URL di dashboard Fonnte:
//   https://<project-ref>.supabase.co/functions/v1/receive-reply
// Runtime: Deno (TypeScript)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Kata kunci konfirmasi yang diakui
const CONFIRMATION_KEYWORDS = [
  "ok", "oke", "siap", "yes", "ya", "baik", "bisa",
  "sudah", "siapp", "okee", "acc", "lanjut", "setuju",
  "siap pak", "siap bu", "siap kak", "oke pak", "oke bu",
];

// Helper: Normalisasi nomor telepon untuk perbandingan
function getCorePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.toString().replace(/\D/g, "");
  if (cleaned.startsWith("62")) cleaned = cleaned.substring(2);
  else if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  return cleaned;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method tidak diizinkan.", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fonnte mengirim data dalam berbagai format; coba parse JSON dan FormData
    let payload: Record<string, string> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    } else {
      // Coba parse sebagai teks biasa (JSON)
      const text = await req.text();
      try { payload = JSON.parse(text); } catch { /* biarkan payload kosong */ }
    }

    console.log("Webhook payload dari Fonnte:", JSON.stringify(payload));

    // Fonnte webhook fields: sender, message, device, id, timestamp, dst.
    const senderRaw = payload.sender || payload.from || "";
    const messageBody = (payload.message || payload.text || "").toLowerCase().trim();
    const senderCore = getCorePhone(senderRaw);

    if (!senderCore) {
      console.log("Webhook diterima tanpa nomor pengirim yang valid.");
      return new Response(JSON.stringify({ received: true, action: "ignored_no_sender" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Pesan dari ${senderCore}: "${messageBody}"`);

    // Cari jadwal yang PIC-nya memiliki nomor ini dan masih berstatus 'reminded'
    const { data: events, error: fetchError } = await supabase
      .from("events")
      .select("*")
      .in("status", ["pending", "reminded"]);

    if (fetchError) throw fetchError;

    const matchedEvent = events?.find(
      (e) => getCorePhone(e.picPhone) === senderCore
    );

    if (!matchedEvent) {
      console.log(`Tidak ada jadwal untuk nomor ${senderCore}.`);
      return new Response(
        JSON.stringify({ received: true, action: "no_matching_event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cek apakah pesannya merupakan konfirmasi
    const isConfirmation = CONFIRMATION_KEYWORDS.some((kw) =>
      messageBody.includes(kw)
    );

    if (!isConfirmation) {
      console.log(`Pesan dari ${matchedEvent.picName} bukan konfirmasi: "${messageBody}"`);
      return new Response(
        JSON.stringify({ received: true, action: "not_a_confirmation" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status ke 'confirmed'
    const { error: updateError } = await supabase
      .from("events")
      .update({ status: "confirmed" })
      .eq("id", matchedEvent.id);

    if (updateError) throw updateError;

    console.log(
      `✅ Status kegiatan "${matchedEvent.title}" diubah ke CONFIRMED untuk ${matchedEvent.picName}`
    );

    return new Response(
      JSON.stringify({
        received: true,
        action: "confirmed",
        eventId: matchedEvent.id,
        eventTitle: matchedEvent.title,
        picName: matchedEvent.picName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error di webhook /receive-reply:", err);
    // Selalu kembalikan 200 ke Fonnte agar tidak terus-menerus retry
    return new Response(
      JSON.stringify({ received: true, error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
