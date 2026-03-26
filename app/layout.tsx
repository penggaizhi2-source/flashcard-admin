import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '工程闪卡管理后台',
  description: '工程安装培训与复盘管理系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
