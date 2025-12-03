// src/components/StartupRouter.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import {
  loadOfflineSubFor,
  isOfflineSubActive,
  saveOfflineSubFor,
  OfflineSubState,
} from "../lib/offlineSubStorage";
import { acquireOrRenewLockForUser } from "../lib/deviceLock";
import { Preferences } from "@capacitor/preferences";

// ---------------------- UI Loader (solo visual) ----------------------
// Mantiene el look original (imagen, tamaños y colores) + anima los tres puntitos
function FullscreenLoader() {
  const [dots, setDots] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 550);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #0b254d 0%, #0b1b32 100%)", // como tu original
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center", // asegura que el icono quede perfectamente centrado con el texto
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {/* Icono como imagen (tu /assets/home.png), centrado */}
        <img
          src="/assets/home.png"
          alt="AL"
          width={72}
          height={72}
          style={{
            opacity: 0.95,
            marginBottom: 14,
            display: "block",
          }}
        />

        {/* Título exactamente como lo tenías */}
        <div
          style={{
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 0.2,
            color: "#e5e7eb",
          }}
        >
          AL Calculadora
        </div>

        {/* "Cargando" con tres puntitos animados (sin cambiar el estilo base) */}
        <div
          style={{
            marginTop: 6,
            opacity: 0.8,
            color: "#e5e7eb",
            fontSize: 16,
            fontWeight: 600,
            height: 22, // evita saltos cuando cambian los puntos
          }}
        >
          {"Cargando" + ".".repeat(dots)}
        </div>
      </div>
    </div>
  );
}

// ---------------------- Avisos Home (compatibilidad) ----------------------
const KICK_LS_KEY = "alcalc.kickNotice.v1";
const DEVLOCK_LS_KEY = "alcalc.deviceLockNotice.v1";
function setKickNotice(message: string) {
  try {
    localStorage.setItem(
      KICK_LS_KEY,
      JSON.stringify({ ts: Date.now(), message })
    );
  } catch {}
}
function clearKickNotice() {
  try {
    localStorage.removeItem(KICK_LS_KEY);
  } catch {}
}
function setDeviceLockNotice(message: string) {
  try {
    localStorage.setItem(
      DEVLOCK_LS_KEY,
      JSON.stringify({ ts: Date.now(), message })
    );
  } catch {}
}
function clearDeviceLockNotice() {
  try {
    localStorage.removeItem(DEVLOCK_LS_KEY);
  } catch {}
}

// ---------------------- Lógica de LOCK Offline ----------------------
// (sin cambios: lógica intacta)
const DEV_ID_KEY = "alcalc.deviceId";
const LOCAL_LOCK_KEY = (uid: string) => `alcalc.deviceLock.current.${uid}`;

async function ensureDeviceId(): Promise<string> {
  const existing = await Preferences.get({ key: DEV_ID_KEY });
  if (existing.value) return existing.value;
  const id = cryptoRandomId();
  await Preferences.set({ key: DEV_ID_KEY, value: id });
  return id;
}
function cryptoRandomId(): string {
  const rnd = (n = 16) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return `${rnd(2)}-${rnd(2)}-${rnd(2)}-${rnd(2)}`;
}

type LocalLock = {
  uid: string;
  ownerDeviceId: string;
  updatedAt: number;
};

async function readLocalLock(uid: string): Promise<LocalLock | null> {
  const { value } = await Preferences.get({ key: LOCAL_LOCK_KEY(uid) });
  if (!value) return null;
  try {
    return JSON.parse(value) as LocalLock;
  } catch {
    return null;
  }
}

async function writeLocalLock(uid: string, ownerDeviceId: string) {
  const lock: LocalLock = { uid, ownerDeviceId, updatedAt: Date.now() };
  await Preferences.set({
    key: LOCAL_LOCK_KEY(uid),
    value: JSON.stringify(lock),
  });
}

function isOwnedByThisDevice(lock: LocalLock | null, deviceId: string) {
  return !!(lock && lock.ownerDeviceId === deviceId);
}

// ---------------------- Componente ----------------------
const StartupRouter: React.FC = () => {
  const nav = useNavigate();
  const didNav = useRef(false);
  const [showLoader, setShowLoader] = useState(true);

  const navigateOnce = (path: string) => {
    if (didNav.current) return;
    didNav.current = true;
    setShowLoader(false);
    nav(path, { replace: true });
  };

  // Lock con red
  const tryEnterMainWithLockOnline = async (uid: string) => {
    try {
      const ok = await acquireOrRenewLockForUser(uid);
      if (ok) {
        clearKickNotice();
        clearDeviceLockNotice();
        navigateOnce("/main");
      } else {
        const msg =
          "Tu cuenta está activa en otro dispositivo. Cierra sesión allí o vuelve a intentarlo más tarde.";
        setKickNotice(msg);
        setDeviceLockNotice(msg);
        navigateOnce("/home");
      }
    } catch {
      const msg =
        "No se pudo verificar el dispositivo. Intenta de nuevo con conexión a internet.";
      setKickNotice(msg);
      setDeviceLockNotice(msg);
      navigateOnce("/home");
    }
  };

  // Lock sin red
  const tryEnterMainWithLockOffline = async (uid: string) => {
    const deviceId = await ensureDeviceId();
    const localLock = await readLocalLock(uid);

    if (isOwnedByThisDevice(localLock, deviceId)) {
      navigateOnce("/main");
      return;
    }
    if (!localLock) {
      await writeLocalLock(uid, deviceId);
      navigateOnce("/main");
      return;
    }

    const msg =
      "Tu cuenta está activa en otro dispositivo. Vuelve a intentarlo cuando tengas conexión para liberar la licencia.";
    setKickNotice(msg);
    setDeviceLockNotice(msg);
    navigateOnce("/home");
  };

  useEffect(() => {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        navigateOnce("/home");
        return;
      }

      const email = u.email || "";
      const hasNet =
        typeof navigator !== "undefined" ? navigator.onLine : true;

      // -------- OFFLINE FIRST --------
      const localSub = email ? loadOfflineSubFor(email) : null;
      if (localSub && isOfflineSubActive(localSub)) {
        if (hasNet) {
          await tryEnterMainWithLockOnline(u.uid);
        } else {
          await tryEnterMainWithLockOffline(u.uid);
        }
        return;
      }

      // -------- ONLINE REFRESH --------
      if (hasNet) {
        try {
          const db = getFirestore();
          const ref = doc(db, "users", u.uid);

          const timer = setTimeout(() => {}, 1500);
          const snap = await getDoc(ref).catch(() => null);
          clearTimeout(timer);

          const data = snap?.data() as any | undefined;
          if (data) {
            const expiry = Number(data?.expiryTimeMillis ?? 0);
            const subState: string = String(
              data?.lastPlayState?.subscriptionState ?? ""
            );
            const label = /(CANCEL|EXPIRE|ON_HOLD|PAUSE)/i.test(subState)
              ? "Fecha de fin de suscripción:"
              : "Fecha de renovación automática:";

            const fresh: Partial<OfflineSubState> = {
              expiryTimeMillis: Number.isFinite(expiry) ? expiry : 0,
              subscriptionState: subState,
              label,
            };

            if (email) {
              saveOfflineSubFor(email, fresh);
            }

            if (isOfflineSubActive(fresh as OfflineSubState)) {
              await tryEnterMainWithLockOnline(u.uid);
              return;
            }
          }
        } catch {
          // ignorar
        }
      }

      // -------- Sin internet y sin caché activo, o sigue inactiva --------
      navigateOnce("/home");
    });

    return () => unsub();
  }, [nav]);

  return showLoader ? <FullscreenLoader /> : null;
};

export default StartupRouter;
