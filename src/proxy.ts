import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Next 16: proxy.ts 取代了 middleware.ts
// 受保护路径前缀
const PROTECTED = ["/library", "/book", "/stats"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  // 已登录用户访问登录页则跳书架
  if ((pathname === "/login" || pathname === "/register") && req.auth) {
    return NextResponse.redirect(new URL("/library", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
