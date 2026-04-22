"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  GitPullRequest,
  Users,
  Settings,
  Bot,
  Activity,
  LogOut,
  ChevronDown,
  Plus,
  Building2,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SyncStatusIndicator } from "@/components/layout/sync-status-indicator";
import { OnlineIndicator } from "@/components/layout/online-indicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface SidebarProps {
  user: { name: string; email: string };
  workspaces: Workspace[];
}

export function Sidebar({ user, workspaces }: SidebarProps) {
  const pathname = usePathname();
  const workspaceSlugMatch = pathname.match(/^\/workspaces\/([^/]+)/);
  const workspaceSlug = workspaceSlugMatch?.[1];
  const currentWorkspace = workspaces.find((w) => w.slug === workspaceSlug);

  const base = workspaceSlug ? `/workspaces/${workspaceSlug}` : "";

  const globalNav = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  const workspaceNav = workspaceSlug
    ? [
        { href: `${base}/documents`, icon: FolderOpen, label: "Documents" },
        { href: `${base}/ai-assistant`, icon: Bot, label: "AI Assistant" },
        { href: `${base}/proposals`, icon: GitPullRequest, label: "Proposals" },
        { href: `${base}/members`, icon: Users, label: "Members" },
        { href: `${base}/activity`, icon: Activity, label: "Activity" },
        { href: `${base}/settings`, icon: Settings, label: "Settings" },
      ]
    : [];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className="flex flex-col h-screen shrink-0"
      style={{
        width: 220,
        background: "#18181b",
        borderRight: "1px solid #27272a",
      }}
    >
      {/* Logo strip */}
      <div
        className="flex items-center gap-2 px-4"
        style={{ height: 56, borderBottom: "1px solid #27272a" }}
      >
        <div
          className="flex items-center justify-center font-extrabold text-white text-xs shrink-0"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#4f46e5",
          }}
        >
          C
        </div>
        <span className="font-bold text-white" style={{ fontSize: 14 }}>
          CoWork
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <OnlineIndicator />
          <SyncStatusIndicator />
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid #27272a" }}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-full flex items-center gap-2 px-2 h-8 rounded-lg transition-colors"
            style={{
              background: "#27272a",
              border: "1px solid #27272a",
              borderRadius: 8,
              color: "#d4d4d8",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Building2
              className="shrink-0"
              style={{ width: 14, height: 14, color: "#71717a" }}
            />
            <span className="truncate flex-1 text-left">
              {currentWorkspace?.name ?? "Select workspace"}
            </span>
            <ChevronDown style={{ width: 12, height: 12 }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => {
                  window.location.href = `/workspaces/${ws.slug}`;
                }}
              >
                <Building2 className="w-4 h-4 mr-2" />
                {ws.name}
              </DropdownMenuItem>
            ))}
            {workspaces.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => {
                window.location.href = "/dashboard?action=new-workspace";
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {globalNav.map((item) => (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  "flex items-center gap-2.5 cursor-pointer transition-all",
                  isActive(item.href)
                    ? "text-white"
                    : "hover:text-[#d4d4d8]"
                )}
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: isActive(item.href) ? "#27272a" : "transparent",
                  color: isActive(item.href) ? "#ffffff" : "#a1a1aa",
                  borderLeft: isActive(item.href)
                    ? "2.5px solid #4f46e5"
                    : "2.5px solid transparent",
                }}
              >
                <item.icon
                  className="shrink-0"
                  style={{
                    width: 15,
                    height: 15,
                    color: isActive(item.href) ? "#4f46e5" : "currentColor",
                  }}
                />
                {item.label}
              </span>
            </Link>
          ))}

          {workspaceNav.length > 0 && (
            <>
              <div style={{ padding: "10px 10px 4px" }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#71717a",
                  }}
                >
                  Workspace
                </p>
              </div>
              {workspaceNav.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "flex items-center gap-2.5 cursor-pointer transition-all",
                      isActive(item.href) ? "text-white" : "hover:text-[#d4d4d8]"
                    )}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      background: isActive(item.href) ? "#27272a" : "transparent",
                      color: isActive(item.href) ? "#ffffff" : "#a1a1aa",
                      borderLeft: isActive(item.href)
                        ? "2.5px solid #4f46e5"
                        : "2.5px solid transparent",
                    }}
                  >
                    <item.icon
                      className="shrink-0"
                      style={{
                        width: 15,
                        height: 15,
                        color: isActive(item.href) ? "#4f46e5" : "currentColor",
                      }}
                    />
                    {item.label}
                  </span>
                </Link>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div style={{ borderTop: "1px solid #27272a", padding: "10px 12px" }}>
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-[#27272a]">
            <Avatar style={{ width: 28, height: 28 }}>
              <AvatarFallback
                className="font-bold text-white text-xs"
                style={{ background: "#4f46e5" }}
              >
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-left min-w-0 flex-1">
              <span
                className="truncate font-semibold"
                style={{ fontSize: 12, color: "#d4d4d8" }}
              >
                {user.name}
              </span>
              <span
                className="truncate"
                style={{ fontSize: 11, color: "#71717a" }}
              >
                {user.email}
              </span>
            </div>
            <ChevronDown style={{ width: 12, height: 12, color: "#71717a" }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                window.location.href = "/settings";
              }}
            >
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
