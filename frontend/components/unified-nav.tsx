"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  PenTool,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/zscj/utils";

/* 统一导航项配置：覆盖工作台、内容、知识、趋势、招生、AI写手与登录 */
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/?tab=content", label: "内容管理", icon: FileText },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/trends", label: "趋势采集", icon: TrendingUp },
  { href: "/admissions", label: "招生通告", icon: GraduationCap },
  { href: "/generate", label: "AI写手", icon: PenTool },
  { href: "/login", label: "登录", icon: LogIn },
];

/**
 * 判定导航项激活态：
 * - 工作台("/")：位于根路径且 tab 非 content
 * - 内容管理("/?tab=content")：位于根路径且 tab=content
 * - 其余路由：按前缀匹配
 */
function isActive(item: NavItem, pathname: string, tab: string | null): boolean {
  if (item.href === "/") {
    return pathname === "/" && tab !== "content";
  }
  if (item.href === "/?tab=content") {
    return pathname === "/" && tab === "content";
  }
  const route = item.href.split("?")[0];
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * 统一导航栏组件
 * - 桌面端：顶部水平导航栏，sticky 定位，毛玻璃效果
 * - 移动端：底部水平导航条
 * - 当前路由高亮，配合 Apple 系统字体与 CSS 变量主题
 */
export default function UnifiedNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <>
      {/* 桌面端：顶部水平导航栏（sticky + 毛玻璃） */}
      <header
        className={cn(
          "sticky top-0 z-50 hidden md:block",
          "border-b border-line/60 backdrop-blur-xl backdrop-saturate-150",
        )}
        style={{ background: "rgb(var(--glass) / 0.72)" }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          {/* 品牌标识 */}
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-moss-sm"
              style={{
                background:
                  "linear-gradient(135deg, rgb(var(--moss)), rgb(var(--moss) / 0.7))",
              }}
            >
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-wide text-ink">
                OMPC
              </span>
              <span className="text-[10px] tracking-[0.25em] text-muted">
                统一平台
              </span>
            </span>
          </Link>

          {/* 导航项 */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item, pathname, tab);
              const isLogin = item.href === "/login";
              const variant = active
                ? "bg-moss/10 text-moss"
                : isLogin
                  ? "ml-1 border border-moss/50 text-moss hover:bg-moss hover:text-white"
                  : "text-muted hover:bg-mist/80 hover:text-ink";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    variant,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* 移动端：底部水平导航条（首页和Android端有自带 BottomNav，跳过避免重复） */}
      {pathname !== "/" && pathname !== "/android" && (
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex md:hidden",
          "border-t border-line/60 backdrop-blur-xl backdrop-saturate-150",
        )}
        style={{
          background: "rgb(var(--glass) / 0.88)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, pathname, tab);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-200",
                active ? "text-moss" : "text-muted",
              )}
            >
              <Icon
                className={cn("h-5 w-5 transition-transform", active && "scale-110")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      )}
    </>
  );
}
