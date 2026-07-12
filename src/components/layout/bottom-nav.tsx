"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Leaf, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/plan/new", label: "Plan", Icon: Leaf },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.endsWith("/minimal")) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
    >
      <div className="max-w-lg mx-auto px-5 pb-[calc(env(safe-area-inset-bottom)+0.85rem)]">
        <div className="pointer-events-auto relative flex items-stretch justify-around gap-1 rounded-full border border-white/60 bg-gradient-to-b from-white/75 to-white/35 backdrop-blur-2xl backdrop-saturate-200 shadow-[0_8px_32px_-6px_rgba(45,58,49,0.28)] ring-1 ring-inset ring-white/60 px-2.5 py-2 overflow-hidden">
          {/* Glass sheen — a soft specular highlight across the top edge */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/50 to-transparent"
          />
          {navItems.map(({ href, label, Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href) && href !== "/plan/new");
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-full py-1.5 transition-colors duration-300 ease-out",
                  isActive ? "bg-sage-light" : "hover:bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors duration-300",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  strokeWidth={isActive ? 2 : 1.75}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium tracking-wide leading-none transition-colors duration-300",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
