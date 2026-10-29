// Yalla Dahab : emails automatiques sur les annonces, envoyés avec Resend.
// Appelée par la base (voir supabase/notifications.sql) quand :
//   - une annonce attend une validation  → email à l'admin (kind "pending")
//   - l'admin la valide ou la refuse     → email à l'hôte  (kind "published" / "rejected")
// Seul secret à ajouter à la main : RESEND_API_KEY. Le mot de passe qui prouve que l'appel vient
// de la base est lu dans le coffre de la base (fonction notify_secret).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE = "https://yalladahab.com";
const FROM = "Yalla Dahab <hello@yalladahab.com>";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

type Listing = {
  id: string; owner_id: string | null; status: string; title: Record<string, string>;
  area: string; type: string; host_name: string; host_whatsapp: string;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function titleOf(l: Listing) { return l.title?.en || l.title?.fr || "Your listing"; }

// Même mise en page que les emails de connexion (dossier emails/ des fichiers du projet).
function layout(heading: string, body: string, button: string, link: string) {
  return `<div style="background:#faf8f4;padding:32px 16px;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#14212b">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;padding:32px;border:1px solid #e8e2d8">
    <p style="margin:0 0 20px;font-size:20px;font-weight:800">Yalla <span style="color:#0b6e78">Dahab</span></p>
    <h1 style="margin:0 0 12px;font-size:22px">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#33414b">${body}</div>
    <p style="margin:28px 0 0"><a href="${link}" style="background:#0b6e78;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${button}</a></p>
  </div></div>`;
}

async function emailOf(userId: string | null) {
  if (!userId) return null;
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

async function adminEmails() {
  const { data } = await supabase.from("profiles").select("id").eq("is_admin", true);
  const emails = await Promise.all((data ?? []).map((p) => emailOf(p.id)));
  return emails.filter((e): e is string => Boolean(e));
}

function message(kind: string, l: Listing) {
  const title = esc(titleOf(l));
  if (kind === "pending") {
    return {
      subject: `New listing to approve: ${titleOf(l)}`,
      html: layout("A new listing is waiting for you",
        `<p><strong>${title}</strong><br>${esc(l.area)} · ${esc(l.type)}</p><p>Host: ${esc(l.host_name)} (WhatsApp +${esc(l.host_whatsapp)})</p>`,
        "Review it", `${SITE}/admin.html`),
    };
  }
  if (kind === "published") {
    return {
      subject: `Your listing is online: ${titleOf(l)}`,
      html: layout("Your listing is online 🎉",
        `<p><strong>${title}</strong> is now visible on Yalla Dahab. Travellers will contact you directly on WhatsApp.</p><p>We will get in touch to visit your place and add the “verified” badge.</p>`,
        "See my listing", `${SITE}/listing.html?id=${encodeURIComponent(l.id)}`),
    };
  }
  return {
    subject: `Your listing needs a few changes: ${titleOf(l)}`,
    html: layout("Your listing needs a few changes",
      `<p>We could not put <strong>${title}</strong> online as it is. Edit it from your space (photos, description, prices) and it will come back to us for approval.</p><p>Questions? Just reply to this email.</p>`,
      "Edit my listing", `${SITE}/account.html`),
  };
}

Deno.serve(async (req) => {
  const { data: secret } = await supabase.rpc("notify_secret");
  if (!secret || req.headers.get("x-notify-secret") !== secret) return new Response("forbidden", { status: 403 });

  const { id, kind } = await req.json();
  if (!["pending", "published", "rejected"].includes(kind)) return new Response("bad kind", { status: 400 });

  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  // L'annonce a pu changer entre-temps : on n'envoie que si son état correspond encore.
  if (!listing || listing.status !== kind) return Response.json({ skipped: "state changed" });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return Response.json({ skipped: "RESEND_API_KEY missing" });

  const to = kind === "pending" ? await adminEmails() : [await emailOf(listing.owner_id)].filter(Boolean);
  if (!to.length) return Response.json({ skipped: "no recipient" });

  const { subject, html } = message(kind, listing);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, reply_to: "hello@yalladahab.com" }),
  });
  const out = await res.text();
  if (!res.ok) console.error("Resend", res.status, out);
  return new Response(out, { status: res.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
});
