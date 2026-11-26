import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Save,
  ShieldCheck,
  Clock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { GateState, OperatorProfile } from '../types';
import {
  fetchOperatorProfile,
  updateOperatorProfile,
  changeOperatorPassword,
  setSessionToken,
  getTokenExpiryMs
} from '../lib/api';

interface ProfileTabProps {
  gates: GateState[];
  profile: OperatorProfile | null;
  onProfileUpdated: (profile: OperatorProfile) => void;
  onLogout: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  gates,
  profile,
  onProfileUpdated,
  onLogout
}) => {
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(() => getTokenExpiryMs());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    fetchOperatorProfile()
      .then((res) => {
        if (res.user) {
          onProfileUpdated(res.user);
        }
        if (res.sessionExpiresAt) {
          setExpiresAtMs(res.sessionExpiresAt);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const originalEmail = (profile?.email || '').trim().toLowerCase();
  const normalizedInputEmail = email.trim().toLowerCase();
  const isEmailChanged = Boolean(originalEmail && normalizedInputEmail !== originalEmail);

  const minutesRemaining = expiresAtMs
    ? Math.max(0, Math.round((expiresAtMs - nowMs) / 60000))
    : null;

  const passwordStrength =
    newPassword.length === 0
      ? 0
      : newPassword.length < 6
      ? 1
      : /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) && newPassword.length >= 10
      ? 3
      : 2;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!normalizedInputEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInputEmail)) {
      setProfileError('Please enter a valid email address.');
      return;
    }
    if (phone.trim() && phone.replace(/[^0-9]/g, '').length < 7) {
      setProfileError('Please enter a valid phone number (at least 7 digits).');
      return;
    }
    if (isEmailChanged && !emailConfirmPassword) {
      setProfileError('Enter your current password to confirm an email address change.');
      return;
    }

    setProfileSaving(true);
    try {
      const res = await updateOperatorProfile({
        displayName: displayName.trim(),
        email: normalizedInputEmail,
        phone: phone.trim(),
        currentPassword: isEmailChanged ? emailConfirmPassword : undefined
      });
      if (res.token) {
        setSessionToken(res.token);
        setExpiresAtMs(getTokenExpiryMs());
      }
      onProfileUpdated(res.user);
      setEmailConfirmPassword('');
      setProfileSuccess(
        isEmailChanged
          ? 'Email and profile updated. Your session token was refreshed automatically.'
          : 'Operator profile details saved.'
      );
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await changeOperatorPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSuccess('Password updated successfully.');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Summary */}
      <div className="flat-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#18e299]/10 border border-[#18e299]/30 flex items-center justify-center text-[#18e299] shrink-0">
            <User className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">
              {profile?.displayName || profile?.email || 'Operator Profile'}
            </h1>
            <p className="text-xs text-neutral-400">
              Manage your login email, alert contact phone, password, and active session status.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#18e299]/30 bg-[#18e299]/10 text-[#18e299] font-medium tabular-nums">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{minutesRemaining !== null ? `Session: ${minutesRemaining}m left` : 'Session Active'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-neutral-300 tabular-nums">
            <ShieldCheck className="w-3.5 h-3.5 text-[#18e299]" aria-hidden="true" />
            <span>{gates.length} assigned gates</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Profile Form */}
        <div className="flat-panel p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Operator Details &amp; Email</h2>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-medium text-neutral-300 mb-1">
                Display Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="profile-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Temple Control Lead"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-white focus:outline-none focus:border-[#18e299]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-email" className="block text-xs font-medium text-neutral-300 mb-1">
                Login Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="profile-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-white focus:outline-none focus:border-[#18e299]"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Updating your email automatically transfers ownership of all your gates.
              </p>
            </div>

            <div>
              <label htmlFor="profile-phone" className="block text-xs font-medium text-neutral-300 mb-1">
                Emergency Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-white focus:outline-none focus:border-[#18e299]"
                />
              </div>
            </div>

            {isEmailChanged && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                <label htmlFor="profile-email-pw" className="block text-xs font-medium text-amber-300">
                  Current Password (required to change email)
                </label>
                <input
                  id="profile-email-pw"
                  type="password"
                  value={emailConfirmPassword}
                  onChange={(e) => setEmailConfirmPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-surface-base border border-amber-500/40 rounded text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {profileError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded p-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 text-xs text-[#18e299] bg-[#18e299]/10 border border-[#18e299]/30 rounded p-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 disabled:opacity-50 text-[#08090a] text-xs font-semibold transition-colors"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{profileSaving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>

        {/* Change Password & Session */}
        <div className="space-y-6">
          <div className="flat-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Change Password</h2>
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label htmlFor="pw-current" className="block text-xs font-medium text-neutral-300 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="pw-current"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-white focus:outline-none focus:border-[#18e299]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pw-new" className="block text-xs font-medium text-neutral-300 mb-1">
                  New Password
                </label>
                <input
                  id="pw-new"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-white focus:outline-none focus:border-[#18e299]"
                />
                {newPassword.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {[1, 2, 3].map((lvl) => (
                      <span
                        key={lvl}
                        className={`h-1 flex-1 rounded-full ${
                          passwordStrength >= lvl
                            ? lvl === 3
                              ? 'bg-[#18e299]'
                              : lvl === 2
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="pw-confirm" className="block text-xs font-medium text-neutral-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="pw-confirm"
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-surface-base border border-border-strong rounded text-white focus:outline-none focus:border-[#18e299]"
                />
              </div>

              {passwordError && (
                <div role="alert" className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSuccess && (
                <div className="flex items-center gap-2 text-xs text-[#18e299] bg-[#18e299]/10 border border-[#18e299]/30 rounded p-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordSaving}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                <Lock className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
                <span>{passwordSaving ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </form>
          </div>

          <div className="flat-panel p-5 flex items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-semibold text-white">Operator Session Security</div>
              <div className="text-neutral-400 mt-0.5">
                2h JWT stored in sessionStorage only.
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-text text-xs font-semibold hover:opacity-90 shrink-0"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
