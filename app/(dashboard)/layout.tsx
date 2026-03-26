'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  HardHat,
  BookOpen,
  Camera,
  LogOut,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: '主控台', icon: LayoutDashboard },
  { href: '/company',   label: '公司设置', icon: Building2 },
  { href: '/workers',   label: '工人管理', icon: HardHat },
  { href: '/flashcards',label: '闪卡管理', icon: BookOpen },
  { href: '/records',   label: '留痕查看', icon: Camera },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-100">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-sm font-black text-white">管</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-gray-800">工程闪卡</p>
              <p className="text-xs text-gray-400">管理后台</p>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={16} strokeWidth={2.2} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* 用户信息 + 退出 */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                管
              </div>
              <span className="text-sm text-gray-700">管理员</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 transition"
              title="退出登录"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
