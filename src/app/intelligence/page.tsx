"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BrainCircuit, CircleDollarSign, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { getIntelligence, IntelligenceData } from "@/lib/api";
import AppShell from "@/components/AppShell";

const money=(v:number)=>`₹${Math.round(v).toLocaleString("en-IN")}`;
export default function Intelligence(){
 const [data,setData]=useState<IntelligenceData|null>(null); const [error,setError]=useState("");
 useEffect(()=>{getIntelligence().then(setData).catch(e=>setError(e.message));},[]);
 if(!data&&!error) return <div className="loading">Loading FLOWX intelligence engine...</div>;
 if(error) return <div className="page-error">{error}</div>;
 const next=data!.recommended_next_action;
 return <AppShell><main className="page-shell"><div className="page-heading"><div><p className="eyebrow">FLOWX INTELLIGENCE</p><h2>Cash Intelligence Center</h2><p className="subhead">Find leakage, understand customer behavior, and choose the fastest safe recovery path.</p></div><Link href="/" className="view-all"><ArrowLeft size={15}/> Back to overview</Link></div>
 <div className="intelligence-grid">
  <section className="panel score-card"><div className="intel-icon"><BrainCircuit size={20}/></div><p className="eyebrow">CASH VELOCITY SCORE</p><strong>{data!.cash_velocity_score}</strong><span>/100 · {data!.cash_velocity_score>=75?"Healthy":"Needs attention"}</span><div className="score-track"><i style={{width:`${data!.cash_velocity_score}%`}}/></div><small>Measures how efficiently outstanding receivables can turn into cash.</small></section>
  <section className="panel leakage-card"><div className="panel-heading"><div><p className="eyebrow">CASH LEAKAGE DETECTOR</p><h3>{money(data!.total_leakage)} potential leakage</h3></div><CircleDollarSign size={20}/></div><div className="leakage-list">{data!.leakage_items.length?data!.leakage_items.map((x,i)=><div className="leakage-item" key={i}><span><b>{x.customer}</b><small>{x.invoice_number} · {x.reason}</small></span><strong>{money(x.value)}</strong></div>):<div className="loading">No leakage signals detected.</div>}</div></section>
  <section className="panel next-action"><div className="panel-heading"><div><p className="eyebrow">BEST ACTION NOW</p><h3>Recommended recovery</h3></div><Sparkles size={20}/></div><div className="next-customer"><div><b>{next.customer}</b><small>{next.invoice} · {next.risk} risk · {money(next.amount)}</small></div><span>{next.confidence}% confidence</span></div><div className="recommendation"><ArrowUpRight size={18}/><div><b>{next.action}</b><small>Prioritized for cash acceleration while staying inside policy guardrails.</small></div></div></section>
  <section className="panel health-card-wide"><div className="panel-heading"><div><p className="eyebrow">PORTFOLIO SIGNAL</p><h3>Receivables health fingerprint</h3></div><TrendingUp size={20}/></div><div className="health-metrics">{Object.entries(data!.portfolio_health).map(([k,v])=><div key={k}><span>{k.replaceAll("_"," ")}</span><b>{v}</b><i><em style={{width:`${v}%`}}/></i></div>)}</div><div className="policy-badge"><ShieldCheck size={14}/> Policy-safe recommendations</div></section>
 </div></main></AppShell>
}
