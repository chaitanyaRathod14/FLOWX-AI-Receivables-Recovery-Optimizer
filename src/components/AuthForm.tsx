"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { login, register } from "@/lib/api";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); const [merchantName, setMerchantName] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { if (isRegister) await register({ email, password, full_name: fullName, merchant_name: merchantName }); else await login(email, password); window.location.href = "/"; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to authenticate"); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-visual"><div className="auth-brand"><span className="brand-mark">F</span> FLOWX</div><div className="auth-quote"><p>THE RECEIVABLES<br /><strong>OPERATING SYSTEM.</strong></p><span>Recover cash with intelligence, control, and a complete audit trail.</span></div><div className="auth-signal"><ShieldCheck size={19} /><span><b>Policy engine active</b><small>AI recommends. Your rules decide.</small></span></div></div><section className="auth-card"><div className="auth-card-inner"><p className="eyebrow">{isRegister ? "CREATE YOUR WORKSPACE" : "WELCOME BACK"}</p><h1>{isRegister ? "Start moving cash." : "Sign in to FLOWX."}</h1><p className="auth-subtitle">{isRegister ? "Set up your receivables command center in minutes." : "Your recovery queue is waiting."}</p><form onSubmit={submit}>{isRegister && <><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="Jordan Davis" /></label><label>Company name<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} required placeholder="Acme Receivables" /></label></>}<label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@company.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="8+ characters" /></label>{error && <div className="form-error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Connecting..." : isRegister ? "Create workspace" : "Sign in"}<ArrowRight size={16} /></button></form><p className="auth-switch">{isRegister ? "Already have an account?" : "New to FLOWX?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create a workspace"}</Link></p>{!isRegister && <p className="demo-hint">Demo: jordan@acmereceivables.com / demo1234</p>}</div></section></main>;
}
