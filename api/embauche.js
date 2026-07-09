// api/embauche.js — CGC Partners
// Réception des données d'un nouveau salarié + upload des documents dans Dropbox.
// Route les fichiers vers /2 PAIE/<Société>/Nouveaux salariés/<AAAA-MM-JJ_NOM>/

const DOSSIERS = [
  "Cyber-soft","SPTB","TRUCK MASTER","BOLTI","IEC INTERNATIONAL","ZIDRA BTP","SRG",
  "GEOS BAT","VEROM RENOV","GELO STYLE","Plov.fr","VALERIYA PARIS","CAR2DRIVE","DO CASH",
  "GORSEDAS","SM REVE","SOPHROSPACE","PIXELBOOST","DIM MODERN","PLOVSAMSA","L'ERMITAGE",
  "PRIX NOBEL","TIARA INTERNATIONAL","STARK LOGISTICS","RCO CONSULTING","LEKVOR",
  "SASHATATTOING","Marel Animale Nutrition","JAROS","SCI Château","ARTLAN","RENOVITA SAS NEW",
  "VITSAR","GraceBeauté+","TEKNIK","GONTA-BAT NEW","VDECO","ISD TRAVAUX","G.A.BAT","INOBAT",
  "THIRTEEN","SVEL","BAVILEX","TIMELESS","CBE","GOALPES","AM BAILEAC","GA PRODUCTION",
  "FOOD VILS PRO SAMOVAR","PEERS","OLIMPIA","NEXTFUSION CONSEIL","DIGITALWAVES","FUTUREDIGIT",
  "CAR PEDIEM","LOOK AGENCY","MARLAN","INVESTCOMPAGNIE","STB old SERGE TR BTP","XPdev",
  "NV SERVICES","LIGHTSTAR","BADLON"
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
    headers: {
      "Authorization": "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
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
      "Dropbox-API-Arg": dropboxArg({
        path: chemin, mode: "add", autorename: true, mute: false, strict_conflict: false
      }),
      "Content-Type": "application/octet-stream"
    },
    body: buffer
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Upload Dropbox " + r.status + " : " + t);
  }
  return r.json();
}

function construireFiche(e, societe) {
  const L = (fr, val) => `${fr} : ${val || "—"}`;
  return [
    "FICHE NOUVEAU SALARIÉ / КАРТОЧКА НОВОГО СОТРУДНИКА",
    "Société / Компания : " + societe,
    "Reçu le / Получено : " + new Date().toLocaleString("fr-FR"),
    "",
    "— INFORMATIONS PERSONNELLES / ЛИЧНАЯ ИНФОРМАЦИЯ —",
    L("Nom Prénom / Имя Фамилия", e.nom),
    L("N° sécurité sociale / Номер соц. страхования", e.secu),
    L("Date de naissance / Дата рождения", e.naissance),
    L("Lieu de naissance / Место рождения", e.lieuNaissance),
    L("Nationalité / Национальность", e.nationalite),
    L("Adresse / Адрес", e.adresse),
    "",
    "— POSTE ET CONTRAT / ДОЛЖНОСТЬ И КОНТРАКТ —",
    L("Poste / Должность", e.poste),
    L("Statut / Статус", e.statut),
    L("Début du contrat / Начало контракта", e.dateDebut),
    L("Type de contrat / Тип контракта", e.typeContrat),
    L("Fin (si CDD) / Окончание (если срочный)", e.dateFin),
    L("Heures / semaine / Часов в неделю", e.heures),
    "",
    "— RÉMUNÉRATION / ЗАРАБОТНАЯ ПЛАТА —",
    L("Brut horaire / Ставка брутто в час", e.salaireHoraire),
    L("Brut mensuel / ЗП брутто в месяц", e.salaireMensuel),
    L("Frais de transport / Транспорт", e.transport),
    L("Frais de santé / Мед. страховка", e.sante),
    "",
    "— COMMENTAIRES / КОММЕНТАРИИ —",
    (e.commentaires || "—"),
    "",
    "Rempli par / Заполнил : " + (e.responsable || "—")
  ].join("\n");
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: c, text: msg })
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Méthode non autorisée" });
    return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (Buffer.isBuffer(body)) body = JSON.parse(body.toString("utf8"));
    if (!body || typeof body !== "object") {
      res.status(400).json({ ok: false, error: "Corps de requête invalide" });
      return;
    }

    const dossier = resoudreDossier(body.societe);
    if (!dossier) {
      res.status(400).json({ ok: false, error: "Société inconnue : " + (body.societe || "") });
      return;
    }

    const token = await obtenirToken();
    const boite = nettoyer(body.dossier);
    const base = `${RACINE}/${dossier}/${SOUS_DOSSIER}/${boite}`;

    if (body.action === "data") {
      const fiche = construireFiche(body.employee || {}, dossier);
      await televerser(token, `${base}/_Fiche_salarie.txt`, Buffer.from(fiche, "utf8"));
      await notifier(body.employee || {}, dossier);
      res.status(200).json({ ok: true, dossier, dossierComplet: base });
      return;
    }

    if (body.action === "file") {
      if (!body.base64) {
        res.status(400).json({ ok: false, error: "Fichier vide" });
        return;
      }
      const nomFichier = nettoyer(body.filename);
      const buf = Buffer.from(body.base64, "base64");
      const result = await televerser(token, `${base}/${nomFichier}`, buf);
      res.status(200).json({ ok: true, path: result.path_display || `${base}/${nomFichier}` });
      return;
    }

    res.status(400).json({ ok: false, error: "Action inconnue" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}
