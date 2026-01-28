"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mic,
  PenTool,
  Terminal,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import { clsx } from "clsx";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/workspace", icon: LayoutDashboard },
  { name: "Huddle", href: "/workspace/huddle", icon: Mic },
  { name: "Design", href: "/workspace/design", icon: PenTool },
  { name: "Dev", href: "/workspace/dev", icon: Terminal },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 250 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative h-screen bg-background border-r border-foreground/10 flex flex-col"
    >
      {/* Logo */}
      <div className="h-[60px] flex items-center px-4 border-b border-foreground/10">
        <Link href="/workspace" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center flex-shrink-0">
            <span className="text-background font-bold text-lg">N</span>
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-semibold text-foreground whitespace-nowrap"
            >
              noteboard<span className="text-primary">.ai</span>
            </motion.span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors group",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              )}
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r"
                  transition={{ duration: 0.2 }}
                />
              )}

              {/* Icon */}
              <Icon
                className={clsx(
                  "w-5 h-5 flex-shrink-0 transition-all",
                  isActive && "drop-shadow-[0_0_8px_rgba(239,211,11,0.5)]"
                )}
              />

              {/* Label */}
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {item.name}
                </motion.span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-muted rounded text-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-muted border border-foreground/10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      {/* Footer */}
      <div className="p-4 border-t border-foreground/10">
        {!isCollapsed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground"
          >
            © 2026 noteboard.ai
          </motion.p>
        )}
      </div>
    </motion.aside>
  );
}
