"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard,
  Users, 
  ShoppingCart, 
  Calendar, 
  Megaphone,
  Settings, 
  LogOut,
  ScanLine,
  CreditCard,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  {
    name: "Reception",
    href: "/reception",
    icon: ScanLine,
    description: "Check-in monitor",
  },
  {
    name: "Members",
    href: "/members",
    icon: Users,
    description: "Member CRM",
  },
  {
    name: "POS",
    href: "/pos",
    icon: ShoppingCart,
    description: "Point of sale",
  },
  {
    name: "Schedule",
    href: "/calendar",
    icon: Calendar,
    description: "Classes & conflicts",
  },
  {
    name: "Retention",
    href: "/retention",
    icon: Megaphone,
    description: "Automation",
  },
  {
    name: "Canvas",
    href: "/marketing/canvas",
    icon: Sparkles,
    description: "Visual Campaign Builder",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Configuration",
  },
];

export function NavigationRail() {
  const pathname = usePathname();

  return (
    <nav 
      className="fixed left-0 top-0 bottom-0 w-[240px] bg-surface border-r border-border flex flex-col z-50"
      style={{ width: 'var(--spacing-navigation-rail, 240px)' }}
    >
      {/* Logo/Brand */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <ScanLine className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-headline-md font-bold text-foreground">GymPartner</h1>
            <p className="text-xs text-muted-foreground">Operations Console</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    "min-h-[44px]", // 44px minimum touch target
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    <span className="text-xs opacity-70">{item.description}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-border">
        <Link
          href="/login"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[44px]"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Sign Out</span>
        </Link>
      </div>
    </nav>
  );
}
