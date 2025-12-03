// src/components/Signup.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import "../styles/Auth.css";

import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { acquireDeviceLock } from "../lib/deviceLock";

const Signup: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Verifica la contraseña");
      return;
    }
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", user.uid), {
        email,
        subscriptionStatus: "inactive",
        subscriptionType: null,
        startDate: null,
        expiryDate: null,
      });

      try { localStorage.setItem("alcalc.lastEmail", String(email || user.email || "")); } catch {}

      try {
        await acquireDeviceLock(user.uid);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (msg.includes("LOCK_TAKEN")) {
          setError("Esta cuenta ya está activa en otro dispositivo.");
          navigate("/home?lock=taken", { replace: true });
          return;
        }
        console.error("[Signup] acquireDeviceLock error:", err);
      }

      navigate("/subscription");
    } catch (err: any) {
      console.error("[Signup] Email error:", err);
      setError("Error al registrarse: " + (err?.message || err));
    }
  };

  const handleGoogleSignup = async () => {
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

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        subscriptionStatus: "inactive",
        subscriptionType: null,
        startDate: null,
        expiryDate: null,
      });

      try { localStorage.setItem("alcalc.lastEmail", String(user.email || "")); } catch {}

      try {
        await acquireDeviceLock(user.uid);
      } catch (err: any) {
        const msg = String(err?.message || "");
        if (msg.includes("LOCK_TAKEN")) {
          setError("Esta cuenta ya está activa en otro dispositivo.");
          navigate("/home?lock=taken", { replace: true });
          return;
        }
        console.error("[Signup] acquireDeviceLock error:", err);
      }

      navigate("/subscription");
    } catch (err: any) {
      console.error("[Signup] Google error:", err);
      setError("Error con el registro con Google");
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="login-container">
      <h1 className="login-title">AL</h1>
      <h2 className="login-subtitle">calculadora</h2>

      <div className="login-card">
        <p className="login-description">Crea tu cuenta para empezar a trabajar</p>
        {error && <p className="login-error">{error}</p>}

        <form onSubmit={handleEmailSignup}>
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
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
          />
          <input
            type="password"
            placeholder="Verificar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="login-input"
            required
          />

          <button type="submit" className="btn-login">Crear cuenta</button>
        </form>

        {/* — O inicia sesión con Google (Recomendado) — (visible y en negritas) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "10px 0 12px",
            color: "#0b2f52",                 // <— oscuro para que sí se vea en la tarjeta blanca
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
          aria-hidden="true"
        >
          <span style={{ flex: 1, height: 1, background: "rgba(11,47,82,0.2)" }} />
          <span>O inicia sesión con Google (Recomendado)</span>
          <span style={{ flex: 1, height: 1, background: "rgba(11,47,82,0.2)" }} />
        </div>

        {/* Botón Google */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleSignup}
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
          ¿Ya tienes cuenta?{" "}
          <span className="link" onClick={() => navigate("/login")}>
            Iniciar sesión
          </span>
        </p>
      </div>
    </div>
  );
};

export default Signup;
