'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, Copy, Check, Pencil, X, Eye, EyeOff, Download, KeyRound, Building2 } from 'lucide-react';

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function QRCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: 200, margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    });
  }, [value]);
  return <canvas ref={canvasRef} className="rounded-lg" />;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!oldPw) { setError('请输入旧密码'); return; }
    if (newPw.length < 6) { setError('新密码至少 6 位'); return; }
    if (newPw !== confirmPw) { setError('两次输入的新密码不一致'); return; }
    setSuccess(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">修改密码</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {success ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-700">密码修改成功</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: '旧密码',   val: oldPw,     set: setOldPw,     show: showOld,     toggle: () => setShowOld(v => !v) },
              { label: '新密码',   val: newPw,     set: setNewPw,     show: showNew,     toggle: () => setShowNew(v => !v) },
              { label: '确认新密码', val: confirmPw, set: setConfirmPw, show: showConfirm, toggle: () => setShowConfirm(v => !v) },
            ].map(({ label, val, set, show, toggle }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} value={val} onChange={(e) => set(e.target.value)}
                    autoComplete="new-password"
                    className="w-full h-10 pl-3 pr-9 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={label} />
                  <button type="button" onClick={toggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            ))}
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">取消</button>
              <button type="submit" className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition">确认修改</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function CompanyPage() {
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/company')
      .then((r) => r.json())
      .then((data) => {
        setCompanyId(data.id ?? '');
        setCompanyName(data.name ?? '');
        setInviteCode(data.inviteCode ?? '');
      })
      .catch((err) => console.error('[company]', err))
      .finally(() => setLoading(false));
  }, []);

  function startEditName() { setDraftName(companyName); setEditingName(true); }
  function cancelEditName() { setEditingName(false); }

  async function saveName() {
    if (!draftName.trim() || !companyId) return;
    setSaving(true);
    try {
      await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: companyId, name: draftName.trim() }),
      });
      setCompanyName(draftName.trim());
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      console.error('[company] 保存名称失败', err);
    } finally {
      setSaving(false);
    }
  }

  async function refreshCode() {
    if (!companyId) return;
    const newCode = randomCode();
    setSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: companyId, inviteCode: newCode }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 重新 GET 确认 DB 里的真实值（加时间戳绕过浏览器缓存）
      const confirmed = await fetch(`/api/company?t=${Date.now()}`).then(r => r.json());
      if (confirmed.inviteCode !== newCode) {
        throw new Error(`DB 返回值不匹配：期望 ${newCode}，实际 ${confirmed.inviteCode}`);
      }
      setInviteCode(newCode);
      setShowQR(false);
    } catch (err) {
      console.error('[company] 刷新邀请码失败', err);
      alert(`邀请码更新失败，请重试。\n错误：${err}`);
    } finally {
      setSaving(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const qrValue = `工程闪卡邀请码：${inviteCode}`;
  const downloadQR = useCallback(async () => {
    const url = await QRCode.toDataURL(qrValue, { width: 600, margin: 3, color: { dark: '#111827', light: '#ffffff' } });
    const a = document.createElement('a');
    a.href = url; a.download = `invite-qr-${inviteCode}.png`; a.click();
  }, [qrValue, inviteCode]);

  if (loading) {
    return (
      <div className="space-y-5 max-w-2xl">
        <div><h1 className="text-xl font-bold text-gray-900">公司设置</h1></div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-32 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">公司设置</h1>
        <p className="text-sm text-gray-400 mt-0.5">管理公司基本信息与工人邀请</p>
      </div>

      <SectionCard title="公司信息">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Building2 size={16} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-1">公司名称</p>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelEditName(); }}
                  className="flex-1 h-9 px-3 rounded-lg border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={saveName} disabled={saving}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50">
                  {saving ? '保存中...' : '保存'}
                </button>
                <button onClick={cancelEditName} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <span className="text-sm font-semibold text-gray-800">{companyName}</span>
                <button onClick={startEditName}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                  <Pencil size={13} />
                </button>
                {nameSaved && (
                  <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12} /> 已保存</span>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="公司邀请码">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-4xl font-black text-gray-900 tracking-widest">{inviteCode || '------'}</span>
          <div className="flex gap-2 flex-wrap">
            <button onClick={refreshCode}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition">
              <RefreshCw size={12} /> 刷新邀请码
            </button>
            <button onClick={copyCode}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition ${
                copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}>
              {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制邀请码</>}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">工人在小程序端输入此邀请码即可加入公司，旧码刷新后立即失效</p>
      </SectionCard>

      <SectionCard title="邀请二维码">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex flex-col items-center gap-3">
            {showQR ? (
              <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                <QRCanvas value={qrValue} />
              </div>
            ) : (
              <button onClick={() => setShowQR(true)}
                className="w-[208px] h-[208px] rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition text-sm">
                点击生成二维码
              </button>
            )}
            <div className="flex gap-2">
              {!showQR && (
                <button onClick={() => setShowQR(true)}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition">
                  生成二维码
                </button>
              )}
              {showQR && (
                <button onClick={downloadQR}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium transition">
                  <Download size={12} /> 下载二维码
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2 pt-1">
            <p className="text-sm font-medium text-gray-700">工人如何使用</p>
            {['打开微信，扫描左侧二维码', '自动跳转至「工程闪卡」小程序', '邀请码自动填入，点击「加入公司」', '或直接在小程序输入邀请码加入'].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-500">{s}</p>
              </div>
            ))}
            <p className="text-xs text-gray-400 pt-1">* 刷新邀请码后，旧二维码失效</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="管理员账号">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-700">管</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">admin</p>
              <p className="text-xs text-gray-400">超级管理员</p>
            </div>
          </div>
          <button onClick={() => setShowPwModal(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition">
            <KeyRound size={12} /> 修改密码
          </button>
        </div>
      </SectionCard>

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
    </div>
  );
}
