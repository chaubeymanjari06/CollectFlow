import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, CheckCircle, Trash2, AlertCircle } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { dbService } from '../../services/dbService';
import { tenantService } from '../../services/tenantService';
import { TenantMembership, UserRole } from '../../types';

export const TeamManagementPage: React.FC = () => {
  const { activeTenant, isOwner, isAdmin } = useTenant();
  const { currentUser } = useAuth();
  const [members, setMembers] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('EXECUTIVE');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const data = await dbService.get<Record<string, TenantMembership>>(`memberships/${activeTenant.tenantId}`);
      if (data) {
        setMembers(Object.values(data));
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeTenant?.tenantId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !currentUser) return;
    setInviteError(null);
    setSubmitting(true);

    try {
      await tenantService.inviteUser(
        activeTenant.tenantId,
        currentUser.uid,
        targetUserId.trim(),
        selectedRole
      );
      setShowInviteModal(false);
      setTargetUserId('');
      await fetchMembers();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to add team member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: UserRole) => {
    if (!activeTenant) return;
    try {
      await tenantService.updateMemberRole(activeTenant.tenantId, memberUserId, newRole);
      await fetchMembers();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!activeTenant) return;
    if (confirm('Are you sure you want to remove this member from the company?')) {
      try {
        await tenantService.removeMember(activeTenant.tenantId, memberUserId);
        await fetchMembers();
      } catch (err) {
        console.error('Failed to remove member:', err);
      }
    }
  };

  const roleColors: Record<UserRole, string> = {
    OWNER: 'bg-purple-50 text-purple-700 border-purple-200',
    ADMIN: 'bg-blue-50 text-blue-700 border-blue-200',
    MANAGER: 'bg-teal-50 text-teal-700 border-teal-200',
    EXECUTIVE: 'bg-amber-50 text-amber-700 border-amber-200',
    PARTNER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    VIEWER: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team & Permissions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage who has access to {activeTenant?.name} and assign role-based permissions
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition flex items-center gap-2 self-start"
          >
            <UserPlus className="w-4 h-4" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Role Definitions Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-600" />
          Role Capabilities in CollectFlow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-purple-700">OWNER / ADMIN:</span>
            <p className="text-slate-500 mt-1">Full control over invoices, payments, Tally sync, billing, and user management.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-teal-700">MANAGER / EXECUTIVE:</span>
            <p className="text-slate-500 mt-1">Can review aging, trigger WhatsApp reminders, record PTPs, and manage customers.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-bold text-indigo-700">PARTNER / VIEWER:</span>
            <p className="text-slate-500 mt-1">Auditors, CAs, or read-only viewers with ledger statement and report viewing access.</p>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Current Members ({members.length})</h3>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No members found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const isSelf = member.userId === currentUser?.uid;
              return (
                <div
                  key={member.userId}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
                      {member.userId.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                        User ID: {member.userId}
                        {isSelf && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        Status: {member.status}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isAdmin && !isSelf && member.role !== 'OWNER' ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as UserRole)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="EXECUTIVE">EXECUTIVE</option>
                        <option value="PARTNER">PARTNER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      <span
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${roleColors[member.role]}`}
                      >
                        {member.role}
                      </span>
                    )}

                    {isOwner && !isSelf && member.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">Add Team Member</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add an existing user to <span className="font-semibold">{activeTenant?.name}</span>
            </p>

            {inviteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2 text-xs text-rose-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  User ID (Firebase UID)
                </label>
                <input
                  type="text"
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="e.g. 5xZ18uPqwL918..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Assignment
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
                >
                  <option value="ADMIN">ADMIN (Full management)</option>
                  <option value="MANAGER">MANAGER (Follow-ups & reconciliations)</option>
                  <option value="EXECUTIVE">EXECUTIVE (Reminders & PTP entry)</option>
                  <option value="PARTNER">PARTNER (CA / Accountant read-only)</option>
                  <option value="VIEWER">VIEWER (View reports)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
