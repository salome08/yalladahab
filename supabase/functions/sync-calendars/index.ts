// Yalla Dahab : lit les calendriers Airbnb (iCal) des annonces et enregistre les dates réservées.
// Appelée toutes les heures par la base (voir supabase/calendar.sql), et par l'éditeur d'annonce
// juste après que l'hôte a enregistré son lien, pour cette seule annonce.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// « 20261105 » ou « 20261105T140000Z » → « 2026-11-05 »
function day(value: string) {
  const m = value.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Périodes réservées d'un fichier iCal (date de fin non comprise, comme dans iCal).
function busyRanges(ics: string) {
  const text = ics.replace(/\r?\n[ \t]/g, ""); // lignes repliées
  const today = new Date().toISOString().slice(0, 10);
  const ranges: { starts: string; ends: string }[] = [];
  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const starts = day(block.match(/^DTSTART[^:\r\n]*:(.+)$/m)?.[1] || "");
    let ends = day(block.match(/^DTEND[^:\r\n]*:(.+)$/m)?.[1] || "");
    if (!starts) continue;
    if (!ends || ends <= starts) {
      const d = new Date(starts + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      ends = d.toISOString().slice(0, 10);
    }
    if (ends >= today) ranges.push({ starts, ends });
  }
  return ranges;
}

async function syncOne(cal: { listing_id: string; ical_url: string }) {
  try {
    const res = await fetch(cal.ical_url, { headers: { Accept: "text/calendar" } });
    const body = await res.text();
    if (!res.ok || !body.includes("BEGIN:VCALENDAR")) throw new Error(`calendar ${res.status}`);
    const ranges = busyRanges(body);
    await admin.from("listing_busy").delete().eq("listing_id", cal.listing_id);
    if (ranges.length) {
      const { error } = await admin.from("listing_busy").insert(ranges.map((r) => ({ listing_id: cal.listing_id, ...r })));
      if (error) throw error;
    }
    await admin.from("listing_calendars").update({ last_sync: new Date().toISOString(), last_error: null }).eq("listing_id", cal.listing_id);
    return { listing_id: cal.listing_id, busy: ranges.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from("listing_calendars").update({ last_error: msg }).eq("listing_id", cal.listing_id);
    return { listing_id: cal.listing_id, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = await req.json().catch(() => ({}));

  // Appel de la base (toutes les heures) : toutes les annonces.
  const { data: secret } = await admin.rpc("notify_secret");
  if (secret && req.headers.get("x-notify-secret") === secret) {
    const { data: cals } = await admin.from("listing_calendars").select("listing_id, ical_url");
    return reply(await Promise.all((cals ?? []).map(syncOne)));
  }

  // Appel de l'éditeur : seulement une annonce de l'hôte connecté (ou de l'admin).
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user || !body.listing_id) return reply({ error: "forbidden" }, 403);
  const [{ data: listing }, { data: profile }] = await Promise.all([
    admin.from("listings").select("owner_id").eq("id", body.listing_id).maybeSingle(),
    admin.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!listing || (listing.owner_id !== auth.user.id && !profile?.is_admin)) return reply({ error: "forbidden" }, 403);
  const { data: cal } = await admin.from("listing_calendars").select("listing_id, ical_url").eq("listing_id", body.listing_id).maybeSingle();
  if (!cal) {
    await admin.from("listing_busy").delete().eq("listing_id", body.listing_id);
    return reply({ listing_id: body.listing_id, busy: 0 });
  }
  return reply(await syncOne(cal));
});
