'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, Trash2, UserCircle2 } from 'lucide-react';

type Worker = {
  id: string;
  name: string;
  avatarUrl: string;
  joinedAt: string;
  assignedCards: number;
  completedCards: number;
  status?: string;
};

function DeleteConfirm({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="text-base font-bold text-gray-900 mb-1">确认移除</h3>
        <p className="text-sm text-gray-500 mb-5">
          确认移除工人 <span className="font-semibold text-gray-800">「{name}」</span>？
          <br />移除后该工人将无法访问公司闪卡。
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">取消</button>
          <button onClick={onConfirm} className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition">确认移除</button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const colors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />;
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${color}`}>
      {name[0] || '?'}
    </div>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [pendingWorkers, setPendingWorkers] = useState<Worker[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetch('/api/workers').then((r) => r.json());
      setWorkers(data.workers ?? []);
      setPendingWorkers(data.pendingWorkers ?? []);
      setInviteCode(data.inviteCode ?? '');
      // companyId is needed for refreshCode; fetch from company endpoint
      const comp = await fetch('/api/company').then((r) => r.json());
      setCompanyId(comp.id ?? '');
    } catch (err) {
      console.error('[workers]', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCode() {
    if (!companyId) return;
    const newCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    await fetch('/api/company', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: companyId, inviteCode: newCode }),
    });
    setInviteCode(newCode);
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRemove() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/workers/${deleteTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'removed' }),
      });
      setWorkers((prev) => prev.filter((w) => w.id !== deleteTarget.id));
    } catch (err) {
      console.error('[workers] 移除失败', err);
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleApprove(worker: Worker) {
    await fetch(`/api/workers/${worker.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    setPendingWorkers((prev) => prev.filter((w) => w.id !== worker.id));
    setWorkers((prev) => [...prev, { ...worker, status: 'active' }]);
  }

  async function handleReject(worker: Worker) {
    await fetch(`/api/workers/${worker.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'removed' }),
    });
    setPendingWorkers((prev) => prev.filter((w) => w.id !== worker.id));
  }

  const totalAssigned  = workers.reduce((s, w) => s + w.assignedCards, 0);
  const totalCompleted = workers.reduce((s, w) => s + w.completedCards, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">工人管理</h1>
        <p className="text-sm text-gray-400 mt-0.5">共 {workers.length} 名工人</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">公司邀请码</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-black text-gray-900 tracking-widest">{inviteCode || '------'}</span>
          <div className="flex gap-2">
            <button onClick={refreshCode} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition">
              <RefreshCw size={12} /> 刷新邀请码
            </button>
            <button onClick={copyCode} className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition ${copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制邀请码</>}
            </button>
          </div>
          <p className="text-xs text-gray-400 w-full">工人在小程序端输入此邀请码即可加入公司，旧码刷新后立即失效</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '在册工人', value: workers.length,  color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: '累计下发', value: totalAssigned,   color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: '累计完成', value: totalCompleted,  color: 'text-green-700', bg: 'bg-green-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 待审批工人 */}
      {pendingWorkers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-800">待审批申请</span>
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingWorkers.length}</span>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingWorkers.map((w) => (
              <div key={w.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={w.name} avatarUrl={w.avatarUrl} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{w.name}</p>
                    <p className="text-xs text-gray-400">申请时间：{w.joinedAt}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReject(w)} className="h-8 px-3 rounded-lg border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition">拒绝</button>
                  <button onClick={() => handleApprove(w)} className="h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition">批准</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 flex justify-center">
          <p className="text-sm text-gray-400">加载中...</p>
        </div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-400">
          <UserCircle2 size={40} className="mb-2 opacity-30" />
          <p className="text-sm">暂无工人，分享邀请码让工人加入</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['工人', '加入时间', '已分配闪卡', '已完成', '操作'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workers.map((w) => {
                const pct = w.assignedCards > 0 ? Math.round((w.completedCards / w.assignedCards) * 100) : 0;
                return (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={w.name} avatarUrl={w.avatarUrl} />
                        <span className="text-sm font-semibold text-gray-800">{w.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{w.joinedAt}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-800">{w.assignedCards}</span>
                      <span className="text-xs text-gray-400 ml-1">张</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">{w.completedCards}/{w.assignedCards}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setDeleteTarget(w)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition">
                        <Trash2 size={12} /> 移除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirm name={deleteTarget.name} onConfirm={handleRemove} onClose={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
