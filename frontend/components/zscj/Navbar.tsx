"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, LayoutDashboard, LogOut, PenTool, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearStoredUser, clearToken, getStoredUser, type UserRead } from "@/lib/api";

const NAV_LINKS = [
  { href: "/", label: "首页", icon: LayoutDashboard },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/trends", label: "趋势采集", icon: TrendingUp },
  { href: "/generate", label: "AI写手", icon: PenTool },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserRead | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getStoredUser());
  }, []);

  function handleLogout() {
    clearToken();
    clearStoredUser();
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-900">OMPC-ZSCJ</span>
          </Link>
          <div className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mounted && user ? (
            <>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-slate-900">
                  {user.nickname ?? user.phone}
                </div>
                <div className="text-xs text-slate-500">{user.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" />
                退出
              </button>
            </>
          ) : (
            mounted && (
              <Link
                href="/login"
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                登录
              </Link>
            )
          )}
        </div>
      </nav>
      <div className="flex items-center gap-1 border-t border-slate-100 px-4 py-2 sm:hidden">
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
