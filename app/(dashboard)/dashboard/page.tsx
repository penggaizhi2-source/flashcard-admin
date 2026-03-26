'use client';

import { useEffect, useState } from 'react';

type Stats = {
  workerCount: number;
  inProgressCount: number;
  completedCount: number;
  thisWeekWorkers: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    workerCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    thisWeekWorkers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch((err) => console.error('[dashboard]', err))
      .finally(() => setLoading(false));
  }, []);

  const STATS = [
    { label: '已注册工人', value: stats.workerCount,     icon: '👷', color: 'bg-blue-50 text-blue-700' },
    { label: '进行中闪卡', value: stats.inProgressCount, icon: '📋', color: 'bg-amber-50 text-amber-700' },
    { label: '已完成闪卡', value: stats.completedCount,  icon: '✅', color: 'bg-green-50 text-green-700' },
    { label: '本周新增工人', value: stats.thisWeekWorkers, icon: '📈', color: 'bg-purple-50 text-purple-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">主控台</h1>
        <p className="text-sm text-gray-400 mt-0.5">工程闪卡概览</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 bg-gray-50 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color.split(' ')[0]}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-2xl font-black ${s.color.split(' ')[1]}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
