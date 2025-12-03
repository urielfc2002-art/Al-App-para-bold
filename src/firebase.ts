// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ⚠️ TIP: verifica que storageBucket coincida EXACTO con el snippet de la consola (SDK setup).
// En muchos proyectos la consola muestra "...appspot.com". Si algo falla con Storage,
// copia/pega el valor desde: Firebase Console → Project settings → Your apps → Web app → SDK snippet.
const firebaseConfig = {
  apiKey: "AIzaSyCLx-cNIPPZy_Nq6fu08jtzwhG-wg8S8ns",
  authDomain: "alcalculadorav2.firebaseapp.com",
  projectId: "alcalculadorav2",
  storageBucket: "alcalculadorav2.firebasestorage.app", // ← deja este valor tal cual por ahora
  messagingSenderId: "338636322262",
  appId: "1:338636322262:android:ba3c5b0ed00213fdb3a077",
};

// ✅ Init idempotente (evita doble inicialización si algún módulo importa este archivo dos veces)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Singletons
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app); // ← ahora disponible si lo quieres usar directamente

// ✅ Persistencia offline Firestore (si falla, NO rompe nada)
enableIndexedDbPersistence(db).catch(() => {
  // En Capacitor (una sola webview) no deberías ver conflictos multi-tab.
  // Si falla, seguimos sin persistencia sin romper nada.
});

// Logs de diagnóstico (útiles mientras integramos backups)
try {
  console.log(
    `[ALC][firebase] init ok | app=${app.name} | bucket=${firebaseConfig.storageBucket}`
  );
} catch {}
export default app;
