// src/components/Login.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "../styles/Auth.css";

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { acquireDeviceLock } from "../lib/deviceLock";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        await FirebaseAuthentication.getCurrentUser().catch(() => {});
        await FirebaseAuthentication.getIdToken({ forceRefresh: false }).catch(() => {});
      } catch {
        // no-op
      }
    })();
  }, []);

  const markDeviceLockNotice = () => {
    try { localStorage.setItem("alcalc.deviceLockNotice.pending", "1"); } catch {}
  };
  const clearDeviceLockNotice = () => {
    try { localStorage.removeItem("alcalc.deviceLockNotice.pending"); } catch {}
  };

  const goBySubscription = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists() && (snap.data() as any).subscriptionStatus === "active") {
        navigate("/main");
      } else {
        navigate("/subscription");
      }
    } catch (e) {
      console.warn("[Login] Firestore check failed:", e);
      navigate("/subscription");
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      try {
        await acquireDeviceLock(user.uid);
        clearDeviceLockNotice();
      } catch (err: any) {
        if (String(err?.message) === "LOCK_TAKEN") {
          markDeviceLockNotice();
          navigate("/home?dl=1", { replace: true });
          return;
        }
        console.error("[Login] acquireDeviceLock error:", err);
      }

      await goBySubscription(user.uid);
    } catch (err: any) {
      console.error("[Login] Email error:", err);
      const code = err?.code || "";

      // Mensajes claros según los dos casos que necesitas
      if (code === "auth/user-not-found") {
        setError("La cuenta no existe");
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError("Contraseña incorrecta");
      } else {
        setError("Error al iniciar sesión");
      }
    }
  };

  const handleResetPassword = async () => {
    setError("");
    try {
      if (!email) {
        alert("Escribe tu correo electrónico arriba para enviar el enlace de restablecimiento.");
        return;
      }
      await sendPasswordResetEmail(auth, email.trim());
      alert("Te enviamos un correo para restablecer tu contraseña.");
    } catch (err: any) {
      console.error("[Login] reset password error:", err);
      alert("No pudimos enviar el correo de restablecimiento. Verifica el correo e inténtalo de nuevo.");
    }
  };

  const handleGoogleLogin = async () => {
    if (loadingGoogle) return;
    setError("");
    setLoadingGoogle(true);
    try {
      const res = await FirebaseAuthentication.signInWithGoogle();
      const idToken =
        (res as any)?.credential?.idToken || (res as any)?.credential?.idToken;
      if (!idToken) {
        setError("No se recibió idToken de Google. Revisa SHA-1 y configuración.");
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const { user } = await signInWithCredential(auth, credential);

      const userRef = doc(db, "users", user.uid);
      const exists = await getDoc(userRef);
      if (!exists.exists()) {
        await setDoc(userRef, {
          email: user.email,
          subscriptionStatus: "inactive",
          subscriptionType: null,
          startDate: null,
          expiryDate: null,
        });
      }

      try {
        await acquireDeviceLock(user.uid);
        clearDeviceLockNotice();
      } catch (err: any) {
        if (String(err?.message) === "LOCK_TAKEN") {
          markDeviceLockNotice();
          navigate("/home?dl=1", { replace: true });
          return;
        }
        console.error("[Login] acquireDeviceLock error:", err);
      }

      await goBySubscription(user.uid);
    } catch (err: any) {
      console.error("[Login] Google error:", err);
      setError("Error al iniciar sesión con Google");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="login-container">
      <h1 className="login-title">AL</h1>
      <h2 className="login-subtitle">calculadora</h2>

      <div className="login-card">
        <p className="login-description">Vincula tu cuenta</p>
        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleEmailLogin}>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
          />
          <button type="submit" className="btn-login">Ingresar</button>
        </form>

        <div
          onClick={handleResetPassword}
          role="button"
          tabIndex={0}
          style={{
            color: "#e11",
            fontSize: 13,
            textAlign: "center",
            marginTop: 8,
            marginBottom: 8,
            cursor: "pointer",
            userSelect: "none",
          }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleResetPassword(); }}
        >
          ¿Olvidaste la contraseña? Has clic aquí.
        </div>

        {/* ⬇️ Separador con rayitas — — como pediste */}
        <div
          style={{
            textAlign: "center",
            margin: "10px 0 8px",
            fontSize: 12.5,
            fontWeight: 700,
            opacity: 0.9,
            userSelect: "none",
          }}
        >
          — O inicia sesión con Google (Recomendado) —
        </div>

        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleLogin}
          disabled={loadingGoogle}
          aria-busy={loadingGoogle ? "true" : "false"}
        >
          <span className="btn-google__iconbox">
            <img src="/assets/icons/icono-google.png" alt="" className="btn-google__icon" aria-hidden="true" />
          </span>
          <span className="btn-google__text">
            {loadingGoogle ? "Abriendo Google…" : "Continuar con Google"}
          </span>
        </button>

        <p className="login-footer">
          ¿No tienes cuenta?{" "}
          <span className="link" onClick={() => navigate("/signup")}>
            Crear cuenta
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
