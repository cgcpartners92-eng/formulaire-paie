// api/embauche.js — CGC Partners
// Réception des données d'un nouveau salarié + upload des documents dans Dropbox.
// La fiche est générée en HTML (lisible + imprimable) côté serveur.
// Fichiers vers /2 PAIE/<Société>/Nouveaux salariés/<AAAA-MM-JJ_NOM>/

const DOSSIERS = [
  "SPTB", "TRUCK MASTER", "BOLTI", "IEC INTERNATIONAL", "ZIDRA BTP", "SRG", "GEOS BAT",
  "VEROM RENOV", "GONTA-BAT", "GELO STYLE", "Plov.fr", "VALERIYA PARIS", "CAR2DRIVE", "STB",
  "DO CASH", "GORSEDAS", "SM REVE", "SOPHROSPACE", "PIXELBOOST", "TEKNIK CONSULT", "PLOVSAMSA",
  "L'ERMITAGE", "PEERS CONSULTING", "TIARA INTERNATIONAL", "STARK LOGISTICS", "RCO CONSULTING",
  "LEKVOR", "VITSAR STYLE", "SASHATATTOING", "GRACE BEAUTE PLUS", "Marel Animale Nutrition",
  "CYBERSOFT", "JAROS", "SCI Château", "ARTLAN", "GLOBAL CIVILIZATIONS DIALOGUES INSTITUTE",
  "SVEL RENOVATION", "VDECO", "ISD TRAVAUX", "G.A.BAT", "INOBAT", "THIRTEEN", "BAVILEX",
  "TIMELESS", "CBE", "GOALPES", "AM BAILEAC", "GA PRODUCTION", "FOOD VILS PRO SAMOVAR",
  "D.I.M MODERN", "OLIMPIA", "NEXTFUSION CONSEIL", "DIGITALWAVES", "FUTUREDIGIT", "CAR PEDIEM",
  "LOOK AGENCY", "MARLAN", "INVESTCOMPAGNIE", "RENOVITA", "XPDEV", "NV SERVICES", "LIGHTSTAR",
  "BADLON"
];

const RACINE = "/2 PAIE";
const SOUS_DOSSIER = "Nouveaux salariés";

function resoudreDossier(societe) {
  if (!societe) return null;
  const cible = String(societe).trim().toLowerCase();
  return DOSSIERS.find(d => d.toLowerCase() === cible) || null;
}

function nettoyer(s) {
  return String(s || "")
    .replace(/[\/\\:?*"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "SANS_NOM";
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dropboxArg(obj) {
  return JSON.stringify(obj).replace(/[\u007f-\uffff]/g,
    c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

async function obtenirToken() {
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", process.env.DROPBOX_REFRESH_TOKEN);
  const auth = Buffer.from(
    process.env.DROPBOX_APP_KEY + ":" + process.env.DROPBOX_APP_SECRET
  ).toString("base64");

  const r = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Token Dropbox : " + JSON.stringify(j));
  return j.access_token;
}

async function televerser(token, chemin, buffer) {
  const r = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Dropbox-API-Arg": dropboxArg({ path: chemin, mode: "add", autorename: true, mute: false, strict_conflict: false }),
      "Content-Type": "application/octet-stream"
    },
    body: buffer
  });
  if (!r.ok) { const t = await r.text(); throw new Error("Upload Dropbox " + r.status + " : " + t); }
  return r.json();
}

async function notifier(e, societe) {
  const t = process.env.TELEGRAM_BOT_TOKEN, c = process.env.TELEGRAM_CHAT_ID;
  if (!t || !c) return;
  const msg =
    "🆕 Nouveau salarié / Новый сотрудник\n" +
    "Société : " + societe + "\n" +
    "Nom : " + (e.nom || "—") + "\n" +
    "Poste : " + (e.poste || "—") + "\n" +
    "Contrat : " + (e.typeContrat || "—");
  try {
    await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: c, text: msg })
    });
  } catch (_) {}
}

function ficheHtml(e, societe) {
  const dateFr = new Date().toLocaleDateString("fr-FR");
  const ligne = (fr, ru, val) =>
    '<div class="row"><div class="lab">' + esc(fr) + ' <span>/ ' + esc(ru) + '</span></div>' +
    '<div class="val">' + esc(val || "—") + '</div></div>';
  const bloc = (num, fr, ru, rows) =>
    '<section><div class="eb"><span class="num">' + num + '</span>' +
    '<span class="tt">' + esc(fr) + ' <span class="ttru">' + esc(ru) + '</span></span></div>' +
    rows.join("") + '</section>';

  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Fiche — ' + esc(e.nom || "salarié") + ' — ' + esc(societe) + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:wght@600;700&display=swap&subset=cyrillic,latin" rel="stylesheet">' +
    '<style>' +
    ':root{--ink:#17242B;--muted:#6E7B82;--accent:#1F6E64;--soft:#E7F0EE;--line:#EEF0ED}' +
    '*{box-sizing:border-box}' +
    'body{margin:0;background:#F3F4F1;font-family:Inter,system-ui,sans-serif;color:var(--ink);padding:28px 16px 60px}' +
    '.sheet{max-width:720px;margin:0 auto;background:#fff;border-radius:14px;padding:40px 42px;box-shadow:0 1px 3px rgba(0,0,0,.06)}' +
    '.brand{font-family:Inter Tight;font-weight:700;letter-spacing:.16em;color:var(--accent);font-size:13px}' +
    'h1{font-family:Inter Tight;font-weight:700;font-size:24px;margin:8px 0 0}' +
    '.h1ru{color:var(--muted);font-weight:600;font-size:16px;margin-bottom:14px}' +
    '.pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px}' +
    '.pill{background:var(--soft);color:var(--accent);font-weight:600;font-size:13px;padding:6px 13px;border-radius:999px}' +
    '.pill.g{background:#F3F4F1;color:var(--muted);font-weight:500}' +
    'section{margin-top:22px}' +
    '.eb{display:flex;align-items:baseline;gap:9px;margin-bottom:4px}' +
    '.num{font-family:Inter Tight;font-weight:700;color:var(--accent);font-size:12px;letter-spacing:.08em}' +
    '.tt{font-family:Inter Tight;font-weight:600;font-size:15px}' +
    '.ttru{color:var(--muted);font-weight:500;font-size:12.5px}' +
    '.row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--line)}' +
    '.lab{font-size:12.5px;color:var(--muted)}.lab span{color:#AEB6B3}' +
    '.val{font-size:13.5px;font-weight:600;text-align:right;max-width:55%}' +
    '.foot{margin-top:26px;padding-top:14px;border-top:2px solid var(--ink);font-size:12.5px;color:var(--muted)}' +
    '.foot b{color:var(--ink)}' +
    '.print{display:inline-flex;align-items:center;gap:7px;margin:0 auto 18px;cursor:pointer;' +
    'font-family:Inter Tight;font-weight:600;font-size:14px;color:#fff;background:var(--accent);' +
    'border:none;border-radius:9px;padding:11px 18px}' +
    '.bar{max-width:720px;margin:0 auto;text-align:center}' +
    '@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:none}.bar{display:none}}' +
    '</style></head><body>' +
    '<div class="bar"><button class="print" onclick="window.print()">🖨 Imprimer / Enregistrer en PDF · Печать / PDF</button></div>' +
    '<div class="sheet">' +
    '<div class="brand">CGC PARTNERS</div>' +
    '<h1>Fiche nouveau salarié</h1><div class="h1ru">Карточка нового сотрудника</div>' +
    '<div class="pills"><span class="pill">Société : ' + esc(societe) + '</span>' +
    '<span class="pill g">Reçu le / Получено : ' + esc(dateFr) + '</span></div>' +
    bloc("01", "Informations personnelles", "Личная информация", [
      ligne("Nom Prénom", "Имя Фамилия", e.nom),
      ligne("N° sécurité sociale", "Соц. страхование", e.secu),
      ligne("Date de naissance", "Дата рождения", e.naissance),
      ligne("Lieu de naissance", "Место рождения", e.lieuNaissance),
      ligne("Nationalité", "Национальность", e.nationalite),
      ligne("Adresse", "Адрес", e.adresse)
    ]) +
    bloc("02", "Poste et contrat", "Должность и контракт", [
      ligne("Poste", "Должность", e.poste),
      ligne("Statut", "Статус", e.statut),
      ligne("Début du contrat", "Начало контракта", e.dateDebut),
      ligne("Type de contrat", "Тип контракта", e.typeContrat),
      ligne("Fin (si CDD)", "Окончание (срочный)", e.dateFin),
      ligne("Heures / semaine", "Часов в неделю", e.heures)
    ]) +
    bloc("03", "Rémunération", "Заработная плата", [
      ligne("Brut horaire", "Ставка в час", e.salaireHoraire),
      ligne("Brut mensuel", "ЗП в месяц", e.salaireMensuel),
      ligne("Frais de transport", "Транспорт", e.transport),
      ligne("Frais de santé", "Мед. страховка", e.sante)
    ]) +
    bloc("04", "Commentaires", "Комментарии", [
      '<div style="font-size:13.5px;padding:8px 0;white-space:pre-wrap">' + esc(e.commentaires || "—") + '</div>'
    ]) +
    '<div class="foot">Rempli par / Заполнил : <b>' + esc(e.responsable || "—") + '</b></div>' +
    '</div></body></html>';
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Méthode non autorisée" }); return; }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString("utf8"));
    if (!body || typeof body !== "object") {
      res.status(400).json({ ok: false, error: "Corps de requête invalide" }); return;
    }

    const dossier = resoudreDossier(body.societe);
    if (!dossier) { res.status(400).json({ ok: false, error: "Société inconnue : " + (body.societe || "") }); return; }

    const token = await obtenirToken();
    const boite = nettoyer(body.dossier);
    const base = `${RACINE}/${dossier}/${SOUS_DOSSIER}/${boite}`;

    if (body.action === "data") {
      const html = ficheHtml(body.employee || {}, dossier);
      await televerser(token, `${base}/_Fiche_salarie.html`, Buffer.from(html, "utf8"));
      await notifier(body.employee || {}, dossier);
      res.status(200).json({ ok: true, dossier }); return;
    }

    if (body.action === "file") {
      if (!body.base64) { res.status(400).json({ ok: false, error: "Fichier vide" }); return; }
      const nomFichier = nettoyer(body.filename);
      const buf = Buffer.from(body.base64, "base64");
      const result = await televerser(token, `${base}/${nomFichier}`, buf);
      res.status(200).json({ ok: true, path: result.path_display || `${base}/${nomFichier}` }); return;
    }

    res.status(400).json({ ok: false, error: "Action inconnue" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
