/** @license SPDX-License-Identifier: Apache-2.0 */

import { FormEvent, useEffect, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { useAuth } from '../auth/AuthGate';
import { apiFetch } from '../../services/apiClient';

interface Invitation { id: string; email: string; displayName: string; status: string; expiresAt: string }
interface Account { id: string; email: string; name: string; role: string; status: string }

export default function AccountAccessPanel({ onShowToast }: { onShowToast: (message: string) => void }) {
  const { role } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [latestUrl, setLatestUrl] = useState('');
  const load = async () => {
    const response = await apiFetch('/api/admin/accounts');
    if (response.ok) { const body = await response.json() as { invitations: Invitation[]; accounts: Account[] }; setInvitations(body.invitations); setAccounts(body.accounts); }
  };
  useEffect(() => { if (role === 'owner') void load(); }, [role]);
  if (role !== 'owner') return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const response = await apiFetch('/api/admin/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, displayName }) });
    if (!response.ok) return onShowToast('邀请创建失败，请确认邮箱未被重复邀请');
    const body = await response.json() as { invitation: { url: string } };
    setLatestUrl(body.invitation.url);
    setEmail(''); setDisplayName('');
    await load();
    onShowToast('邀请已创建，请复制链接后通过邮件发送');
  };
  const createReset = async (account: Account) => {
    const response = await apiFetch(`/api/admin/accounts/${encodeURIComponent(account.id)}/password-reset`, { method: 'POST' });
    if (!response.ok) return onShowToast('重置链接创建失败');
    const { resetUrl } = await response.json() as { resetUrl: string };
    setLatestUrl(resetUrl);
    onShowToast(`已为 ${account.name} 创建 30 分钟有效的重置链接`);
  };
  return <section className="mt-5 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 md:col-span-2 dark:border-emerald-900 dark:bg-emerald-950/20">
    <div><strong className="text-sm text-slate-800 dark:text-slate-100">试用账号与邀请</strong><p className="mt-1 text-xs text-slate-500">每个受邀教师会创建一份全新的独立工作区。邀请链接 72 小时有效且只能使用一次。</p></div>
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="教师邮箱" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"/><input required value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="教师称呼" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"/><button className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"><UserPlus className="h-4 w-4"/>创建邀请</button></form>
    {latestUrl && <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="break-all text-xs text-slate-600">{latestUrl}</p><button type="button" onClick={() => void navigator.clipboard.writeText(latestUrl).then(() => onShowToast('邀请链接已复制'))} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Copy className="h-3.5 w-3.5"/>复制链接</button></div>}
    <div className="space-y-1">{accounts.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs"><span>{item.name} · {item.email} · {item.role === 'owner' ? '管理员' : '教师'}</span><button type="button" onClick={() => void createReset(item)} className="font-bold text-emerald-700">生成密码重置链接</button></div>)}</div>
    <div className="space-y-1">{invitations.slice(0, 8).map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs"><span>{item.displayName} · {item.email}</span><span className="text-slate-400">{item.status === 'pending' ? `待注册，${new Date(item.expiresAt).toLocaleString()} 到期` : item.status === 'consumed' ? '已注册' : '已撤销'}</span></div>)}</div>
  </section>;
}
