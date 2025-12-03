// functions/src/index.ts
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { GoogleAuth } from "google-auth-library";
import { androidpublisher } from "@googleapis/androidpublisher";

initializeApp();
const db = getFirestore();
const fcm = getMessaging();

/** ========= Utilidades ========= */
const msToISO = (ms: any) =>
  typeof ms === "number" && ms > 0 ? new Date(ms).toISOString() : null;

const isActiveByExpiry = (expiryMs: any) =>
  typeof expiryMs === "number" && expiryMs > Date.now();

function toMs(v: any) {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

/** Extrae fechas de v2 */
function pickTimesFromV2(data: any) {
  const items = data?.lineItems ?? [];
  const starts = items
    .map(
      (li: any) =>
        toMs(li?.validTimeInterval?.startTimeMillis) ||
        toMs(li?.startTimeMillis) ||
        toMs(li?.startTime)
    )
    .filter((n: number) => n > 0);

  const ends = items
    .map(
      (li: any) =>
        toMs(li?.validTimeInterval?.endTimeMillis) ||
        toMs(li?.expiryTimeMillis) ||
        toMs(li?.expiryTime)
    )
    .filter((n: number) => n > 0);

  return {
    startMs: starts.length ? Math.min(...starts) : undefined,
    endMs: ends.length ? Math.max(...ends) : undefined,
  };
}

/** Consulta estado de suscripción en Google Play (subs v2) */
async function fetchPlaySub(packageName: string, purchaseToken: string) {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const play = androidpublisher({ version: "v3", auth });

  const { data } = await play.purchases.subscriptionsv2.get({
    packageName,
    token: purchaseToken,
  });

  const { startMs, endMs } = pickTimesFromV2(data);

  // intentar extraer obfuscatedAccountId para mapping por cuenta
  const liAny = ((data as any)?.lineItems?.[0]) ?? {};
  const accountId: string | null =
    liAny?.linkedPurchaseToken?.obfuscatedExternalAccountId ??
    liAny?.obfuscatedExternalAccountId ??
    (data as any)?.obfuscatedExternalAccountId ??
    null;

  return {
    startTimeMillis: startMs,
    expiryTimeMillis: endMs,
    subscriptionState: String((data as any)?.subscriptionState ?? ""),
    regionCode: (data as any)?.regionCode ?? null,
    accountId,
    raw: data,
  };
}

function normalizedDoc(
  playData: any,
  packageName: string,
  purchaseToken: string,
  extra?: Record<string, any>
) {
  const expiryMs = playData.expiryTimeMillis;
  const startMs = playData.startTimeMillis;
  return {
    packageName,
    purchaseToken,
    subscriptionState: playData.subscriptionState ?? null,
    startTimeMillis: startMs ?? null,
    startDate: msToISO(startMs),
    expiryTimeMillis: expiryMs ?? null,
    expiryDate: msToISO(expiryMs),
    isActive: isActiveByExpiry(expiryMs),
    regionCode: playData.regionCode ?? null,
    lastFetchAt: new Date().toISOString(),
    ...extra,
  };
}

/** Convierte un doc de playSubscriptions en el parche para users/{uid} */
function toUserPatchFromPlaySub(play: any) {
  const expiryMs = toMs(play?.expiryTimeMillis ?? play?.expiryTime);
  const startMs = toMs(play?.startTimeMillis ?? play?.startTime);
  const active = isActiveByExpiry(expiryMs);
  return {
    subscriptionStatus: active ? "active" : "inactive",
    expiryTimeMillis: expiryMs || null,
    expiryDate: msToISO(expiryMs),
    startDate: msToISO(startMs) || null,
    updatedAt: new Date().toISOString(),
    lastPlayState: {
      subscriptionState: String(
        play?.subscriptionState ?? play?.raw?.subscriptionState ?? ""
      ),
      notificationType:
        typeof play?.notificationType === "number"
          ? play.notificationType
          : Number(play?.raw?.subscriptionNotification?.notificationType) || null,
      regionCode: play?.regionCode ?? play?.raw?.regionCode ?? null,
    },
  };
}

/* =========================
 *  CALLABLES DE MAPEO
 * ========================= */

export const linkPurchaseToken = onCall(
  { region: "us-central1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const { purchaseToken, packageName, email } = (req.data ?? {}) as {
      purchaseToken?: string;
      packageName?: string;
      email?: string;
    };

    if (
      !purchaseToken ||
      typeof purchaseToken !== "string" ||
      purchaseToken.length < 10
    ) {
      throw new HttpsError("invalid-argument", "purchaseToken inválido.");
    }

    await db
      .collection("purchaseLinks")
      .doc(purchaseToken)
      .set(
        {
          uid,
          packageName: packageName ?? null,
          email: email ?? null,
          createdAt: new Date().toISOString(),
          lastClientAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return { ok: true };
  }
);

export const linkAccountId = onCall(
  { region: "us-central1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const { accountId } = (req.data ?? {}) as { accountId?: string };
    if (!accountId || typeof accountId !== "string" || accountId.length < 6) {
      throw new HttpsError("invalid-argument", "accountId inválido.");
    }

    await db
      .collection("accountMap")
      .doc(accountId)
      .set(
        {
          uid,
          createdAt: new Date().toISOString(),
          lastClientAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return { ok: true };
  }
);

/* ======================================
 *  HTTPS OPCIONAL: verificar y guardar YA
 * ====================================== */
export const verifyAndSave = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).send("Only POST");
        return;
      }

      const { uid, packageName, purchaseToken } = (req.body ?? {}) as {
        uid?: string;
        packageName?: string;
        purchaseToken?: string;
      };

      if (!uid || !packageName || !purchaseToken) {
        res.status(400).json({
          ok: false,
          error: "uid, packageName y purchaseToken requeridos",
        });
        return;
      }

      const playData = await fetchPlaySub(packageName, purchaseToken);
      const docData = normalizedDoc(playData, packageName, purchaseToken, {
        source: "verifyAndSave",
      });

      await db
        .collection("playSubscriptions")
        .doc(purchaseToken)
        .set({ uid, ...docData }, { merge: true });

      await db
        .collection("users")
        .doc(uid)
        .set(toUserPatchFromPlaySub(docData), { merge: true });

      res.status(200).json({ ok: true, ...docData });
      return;
    } catch (e: any) {
      logger.error(e);
      res.status(500).json({ ok: false, error: e?.message ?? String(e) });
      return;
    }
  }
);

/* =========================
 *  RTDN (Pub/Sub → Functions)
 * ========================= */
export const handleRtdn = onMessagePublished(
  { topic: "play-rtdn", region: "us-central1" },
  async (event) => {
    try {
      const payload = (event.data?.message?.json ?? {}) as any;

      if (payload?.testNotification) {
        await db.collection("rtdn_raw").add({
          type: "testNotification",
          receivedAt: new Date().toISOString(),
          payload,
        });
        return;
      }

      const packageName = payload?.packageName;
      const eventTimeMillis = Number(payload?.eventTimeMillis || 0);
      const sub = payload?.subscriptionNotification;

      if (!packageName || !sub) {
        await db.collection("rtdn_raw").add({
          type: "unknown_or_oneTime",
          receivedAt: new Date().toISOString(),
          payload,
        });
        return;
      }

      const purchaseToken = sub?.purchaseToken;
      const subscriptionId = sub?.subscriptionId;
      const notificationType = Number(sub?.notificationType);
      if (!purchaseToken) return;

      let playData: any = null;
      try {
        playData = await fetchPlaySub(packageName, purchaseToken);
      } catch (e: any) {
        await db.collection("rtdn_raw").add({
          type: "fetch_error",
          receivedAt: new Date().toISOString(),
          packageName,
          purchaseToken,
          error: e?.message ?? String(e),
          payload,
        });
      }

      const expiryMs = playData?.expiryTimeMillis;
      const startMs = playData?.startTimeMillis;
      const subState = playData?.subscriptionState ?? undefined;

      const docData = {
        packageName,
        subscriptionId: subscriptionId ?? null,
        purchaseToken,
        notificationType: notificationType ?? null,
        eventTimeMillis: eventTimeMillis ?? null,
        eventTime: msToISO(eventTimeMillis),
        subscriptionState: subState ?? null,
        expiryTimeMillis: expiryMs ?? null,
        expiryDate: msToISO(expiryMs),
        startTimeMillis: startMs ?? null,
        startDate: msToISO(startMs),
        isActive: isActiveByExpiry(expiryMs),
        regionCode: playData?.regionCode ?? null,
        lastFetchAt: new Date().toISOString(),
        raw: payload,
      };

      const subRef = db.collection("playSubscriptions").doc(purchaseToken);
      const subSnap = await subRef.get();
      let uid = subSnap.exists ? (subSnap.data() as any)?.uid : undefined;

      await subRef.set(
        { ...docData, uid: uid ?? null, lastRtdnAt: new Date().toISOString() },
        { merge: true }
      );

      if (!uid) {
        const linkSnap = await db
          .collection("purchaseLinks")
          .doc(purchaseToken)
          .get();
        uid = linkSnap.exists ? (linkSnap.data() as any)?.uid : undefined;
        if (uid) await subRef.set({ uid }, { merge: true });
      }

      if (!uid && playData?.accountId) {
        const accSnap = await db
          .collection("accountMap")
          .doc(String(playData.accountId))
          .get();
        uid = accSnap.exists ? (accSnap.data() as any)?.uid : undefined;
        if (uid) await subRef.set({ uid }, { merge: true });
      }

      if (uid) {
        await db
          .collection("users")
          .doc(uid)
          .set(toUserPatchFromPlaySub(docData), { merge: true });
      }
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }
);

/* ==========================================
 *  ESPEJO: playSubscriptions -> users/{uid}
 * ========================================== */
export const mirrorPlaySubToUser = onDocumentWritten(
  { document: "playSubscriptions/{purchaseToken}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after = event.data?.after?.data() as any;
    if (!after) return;

    const relevantChanged =
      !before ||
      before.isActive !== after.isActive ||
      Number(before?.expiryTimeMillis || 0) !==
        Number(after?.expiryTimeMillis || 0) ||
      before.subscriptionState !== after.subscriptionState ||
      before.notificationType !== after.notificationType ||
      before.regionCode !== after.regionCode;

    if (!relevantChanged) return;

    const purchaseToken = String(event.params.purchaseToken || "");

    let uid = after?.uid;
    if (!uid) {
      try {
        const linkSnap = await db
          .collection("purchaseLinks")
          .doc(purchaseToken)
          .get();
        uid = linkSnap.exists ? (linkSnap.data() as any)?.uid : undefined;
        if (uid) {
          await db
            .collection("playSubscriptions")
            .doc(purchaseToken)
            .set({ uid }, { merge: true });
        }
      } catch (e) {
        logger.warn("mirrorPlaySubToUser: error leyendo purchaseLinks", e as any);
      }
    }

    if (!uid) {
      logger.info(
        "mirrorPlaySubToUser: sin uid aún; se reflejará cuando llegue purchaseLinks",
        purchaseToken
      );
      return;
    }

    const patch = toUserPatchFromPlaySub(after);
    await db.collection("users").doc(uid).set(patch, { merge: true });
    logger.info("mirrorPlaySubToUser: users actualizado", { uid, purchaseToken });
  }
);

/* ====================================================
 *  BACKFILL: purchaseLinks -> asegura reflejo en users
 * ==================================================== */
export const backfillOnLink = onDocumentWritten(
  { document: "purchaseLinks/{purchaseToken}", region: "us-central1" },
  async (event) => {
    const after = event.data?.after?.data() as any;
    if (!after) return;

    const token = String(event.params.purchaseToken || "");
    const uid = after?.uid;
    if (!token || !uid) return;

    const subSnap = await db.collection("playSubscriptions").doc(token).get();
    if (!subSnap.exists) return;

    await db.collection("playSubscriptions").doc(token).set({ uid }, { merge: true });

    const sub = subSnap.data();
    const patch = toUserPatchFromPlaySub(sub);
    await db.collection("users").doc(uid).set(patch, { merge: true });
    logger.info("backfillOnLink: users actualizado desde purchaseLinks", {
      uid,
      token,
    });
  }
);

/* ===========================================
 *  SWEEPER: cierra suscripciones ya vencidas
 * =========================================== */
export const sweepExpiredSubs = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "UTC",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    const now = Date.now();

    const psSnap = await db
      .collection("playSubscriptions")
      .where("isActive", "==", true)
      .where("expiryTimeMillis", "<=", now)
      .limit(450)
      .get();

    if (!psSnap.empty) {
      const batch = db.batch();
      for (const doc of psSnap.docs) {
        const d = doc.data() as any;
        const uid = d?.uid;

        batch.set(
          doc.ref,
          { isActive: false, lastSweepAt: new Date().toISOString() },
          { merge: true }
        );

        if (uid) {
          batch.set(
            db.collection("users").doc(uid),
            {
              subscriptionStatus: "inactive",
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
      await batch.commit();
    }

    const usersSnap = await db
      .collection("users")
      .where("subscriptionStatus", "==", "active")
      .where("expiryTimeMillis", "<=", now)
      .limit(450)
      .get();

    if (!usersSnap.empty) {
      const batch2 = db.batch();
      for (const udoc of usersSnap.docs) {
        batch2.set(
          udoc.ref,
          { subscriptionStatus: "inactive", updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }
      await batch2.commit();
    }
  }
);

/* ============================================================
 *  🔔 NOTIFICACIONES: anuncios → push a usuarios suscritos activos
 * ============================================================ */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const sendPushOnAnnouncement = onDocumentWritten(
  { document: "announcements/{aid}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before?.data() as any | undefined;
    const after = event.data?.after?.data() as any | undefined;

    if (!after) return;
    const isNew = !before;
    const nowActive = after?.isDeleted === false;
    const wasActive = before?.isDeleted === false;

    if (!(isNew && nowActive) && !(nowActive && !wasActive)) return;

    const title = String(after?.title || "AL Calculadora");
    const body = String(after?.body || "");

    const tokSnap = await db
      .collectionGroup("deviceTokens")
      .where("enabled", "==", true)
      .limit(10000)
      .get();

    if (tokSnap.empty) {
      logger.info("sendPushOnAnnouncement: no hay deviceTokens.");
      return;
    }

    type Target = { token: string; uid: string };
    const targets: Target[] = [];
    const userCache = new Map<string, boolean>();

    for (const d of tokSnap.docs) {
      const tokenData = d.data() as any;
      const parent = d.ref.parent.parent;
      if (!parent) continue;
      const uid = parent.id;

      let isActiveUser = userCache.get(uid);
      if (typeof isActiveUser === "undefined") {
        const udoc = await parent.get();
        const us = (udoc.data() as any)?.subscriptionStatus;
        isActiveUser = us === "active";
        userCache.set(uid, isActiveUser);
      }

      if (isActiveUser && tokenData?.token) {
        targets.push({ token: String(tokenData.token), uid });
      }
    }

    if (!targets.length) {
      logger.info("sendPushOnAnnouncement: no hay usuarios activos con token.");
      return;
    }

    const batches = chunk(targets, 500);
    const android: any = {
      notification: {
        channelId: "alcalc_general",
        defaultVibrateTimings: true,
        defaultSound: true,
        priority: "HIGH",
      },
    };

    let sent = 0;
    for (const lot of batches) {
      const resp = await fcm.sendEachForMulticast({
        tokens: lot.map((t) => t.token),
        notification: { title, body },
        android,
        data: { type: "announcement" },
      });
      sent += resp.successCount;

      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = (r.error as any)?.errorInfo?.code || r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            const { uid, token } = lot[idx];
            const ref = db
              .collection("users")
              .doc(uid)
              .collection("deviceTokens")
              .doc(token);
            ref.set(
              { enabled: false, disabledAt: new Date().toISOString() },
              { merge: true }
            );
          }
        }
      });
    }

    logger.info("sendPushOnAnnouncement: enviados", {
      sent,
      totalTargets: targets.length,
    });
  }
);

/* ===========================
 *  🔐 BACKUP PROXY (HTTP) — robusto
 * =========================== */
/**
 * GET/POST /backupGetLatest
 * Header: Authorization: Bearer <ID_TOKEN>  (o Firebase <ID_TOKEN>)
 *
 * Si es POST, puede venir body JSON: { path?: string }.
 * Si no se envía path, se toma de users/{uid}/backups/latest.
 */
export const backupGetLatest = onRequest(
  { region: "us-central1", cors: true, timeoutSeconds: 60, memory: "256MiB" },
  async (req, res) => {
    try {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.status(204).send("");
        return;
      }

      // Solo GET o POST
      if (req.method !== "GET" && req.method !== "POST") {
        res.set("Access-Control-Allow-Origin", "*");
        res.status(405).json({ ok: false, error: "Only GET or POST" });
        return;
      }

      // Auth: Bearer o Firebase
      const authHeader = String(req.header("Authorization") || "");
      const m =
        authHeader.match(/^Bearer\s+(.+)$/i) ||
        authHeader.match(/^Firebase\s+(.+)$/i);
      if (!m) {
        res.set("Access-Control-Allow-Origin", "*");
        res.status(401).json({
          ok: false,
          error:
            "Missing Authorization header. Use 'Bearer <ID_TOKEN>' or 'Firebase <ID_TOKEN>'.",
        });
        return;
      }
      const idToken = m[1];
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      const uid = decoded.uid;

      // ── Resolver path (siempre string)
      let path = "";
      if (req.method === "POST" && req.is("application/json") && typeof req.body === "object") {
        const p = (req.body as any)?.path;
        if (typeof p === "string" && p.trim().length > 0) {
          path = p.trim();
        }
      }
      if (!path) {
        const snap = await db.doc(`users/${uid}/backups/latest`).get();
        const data = snap.exists ? (snap.data() as any) : undefined;
        const p2 = data?.path;
        path = typeof p2 === "string" && p2.trim().length > 0 ? p2.trim() : `backups/${uid}/latest.json`;
      }

      // Leer desde Storage
      const storage = getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(path);

      const [exists] = await file.exists();
      if (!exists) {
        res.set("Access-Control-Allow-Origin", "*");
        res.status(404).json({ ok: false, error: `No existe el archivo: ${path}` });
        return;
      }

      // Stream directo
      res.set("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      file
        .createReadStream({ validation: false })
        .on("error", (err) => {
          console.error("backupGetLatest stream ERR:", err);
          if (!res.headersSent) {
            res.status(500).json({ ok: false, error: String(err) });
          }
        })
        .pipe(res);
    } catch (e: any) {
      console.error("backupGetLatest ERR:", e);
      res.set("Access-Control-Allow-Origin", "*");
      if (e?.code === "auth/argument-error" || e?.code === "auth/invalid-id-token") {
        res.status(401).json({ ok: false, error: "Invalid ID token" });
        return;
      }
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);
