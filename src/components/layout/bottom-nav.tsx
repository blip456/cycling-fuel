"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/plan/new", label: "New Plan", Icon: PlusCircle },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  // Plan wizard and result pages have their own fixed footers
  if (pathname.startsWith("/plan/")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1 max-w-lg mx-auto">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href) && href !== "/plan/new");
          const isPlan = href === "/plan/new";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors duration-150 min-w-[60px]",
                isActive && !isPlan && "text-primary",
                !isActive && !isPlan && "text-muted-foreground hover:text-foreground",
                isPlan && "text-accent"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isPlan && "h-6 w-6"
                )}
                strokeWidth={isActive || isPlan ? 2.5 : 2}
              />
              <span className={cn("text-[10px] font-medium", isPlan && "text-xs")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
