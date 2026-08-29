import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/", "/invoices", "/recovery", "/promises", "/analytics", "/intelligence", "/audit-log", "/settings", "/system-health"];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) => route === "/" ? path === "/" : path.startsWith(route));
  if (isProtected && !request.cookies.has("flowx_session")) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/invoices/:path*", "/recovery/:path*", "/promises/:path*", "/analytics/:path*", "/intelligence/:path*", "/audit-log/:path*", "/settings/:path*", "/system-health/:path*"] };