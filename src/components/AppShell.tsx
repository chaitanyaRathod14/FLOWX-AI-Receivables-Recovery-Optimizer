"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bell, FileText, Gauge, LayoutDashboard, LifeBuoy, LogOut, ReceiptText, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { logout } from "@/lib/api";

const workspace = [["Overview", "/", LayoutDashboard], ["Invoices & risk", "/invoices", ReceiptText], ["Recovery actions", "/recovery", Sparkles], ["AI Negotiation", "/negotiation", Sparkles], ["Promises to pay", "/promises", WalletCards], ["Cash analytics", "/analytics", BarChart3], ["Cash intelligence", "/intelligence", Sparkles]] as const;
const controls = [["Audit log", "/audit-log", FileText], ["Policies", "/settings/policies", ShieldCheck], ["System health", "/system-health", Gauge]] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [user, setUser] = useState({ full_name: "Jordan Davis", merchant_name: "Acme Receivables", role: "finance_admin" });
  const [today, setToday] = useState("August 2024");
  useEffect(() => { if (!localStorage.getItem("flowx_token")) router.replace("/login"); const raw=localStorage.getItem("flowx_user"); if(raw){ try { setUser(JSON.parse(raw)); } catch {} } setToday(new Intl.DateTimeFormat("en-IN", { month: "short", day: "2-digit", year: "numeric" }).format(new Date())); }, [router]);
  function signOut() { logout(); router.push("/login"); }
  return <main className="app-shell"><aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">F</span><span>FLOWX</span></Link><div className="tenant-switcher"><span className="tenant-dot">AR</span><span><b>{user.merchant_name}</b><small>Merchant workspace</small></span></div><nav className="nav-group"><p className="nav-label">WORKSPACE</p>{workspace.map(([label, href, Icon]) => <Link className={`nav-item ${pathname === href ? "active" : ""}`} href={href} key={href}><Icon size={17} /><span>{label}</span></Link>)}</nav><nav className="nav-group lower-nav"><p className="nav-label">CONTROL CENTER</p>{controls.map(([label, href, Icon]) => <Link className={`nav-item ${pathname === href ? "active" : ""}`} href={href} key={href}><Icon size={17} /><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><div className="help-row"><LifeBuoy size={16} /><span>Help center</span></div><div className="profile"><span className="avatar">{user.full_name.split(" ").map((part)=>part[0]).slice(0,2).join("").toUpperCase()}</span><span><b>{user.full_name}</b><small>Finance admin</small></span><button className="row-more" onClick={signOut} aria-label="Log out"><LogOut size={16} /></button></div></div></aside><section className="workspace"><header className="topbar"><div><p className="breadcrumb">Workspace / {pathname === "/" ? "Overview" : pathname.slice(1).replaceAll("/", " / ")}</p><h1>{user.full_name ? `Good morning, ${user.full_name.split(" ")[0]}` : "Welcome to FLOWX"} <span>✦</span></h1></div><div className="top-actions"><div className="date-chip">{today}</div><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><button className="logout" onClick={signOut}><LogOut size={16} /> Log out</button></div></header><div className="content">{children}</div></section></main>;
}
