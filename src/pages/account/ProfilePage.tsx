import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAvatar } from '@/context/AvatarContext';
import { isApiConfigured, ApiError } from '@/services/api';
import {
  getProfile,
  updateProfile,
  changePassword,
  uploadImage,
  getAddresses,
  resendVerificationEmail,
  getGoogleLoginUrl,
  unlinkGoogleAccount,
} from '@/services/backend';
import { addressDtoToSaved } from '@/services/addressMapper';
import type { ProfileDto } from '@/types/api';
import type { SavedAddress } from '@/types';
import AccountSidebar from '@/components/account/AccountSidebar';
import AccountHeader from '@/components/account/AccountHeader';
import AccountFooter from '@/components/account/AccountFooter';
import Breadcrumb from '@/components/common/Breadcrumb';

const PROFILE_STORAGE_KEY = 'techhome_profile';
const PASSWORD_UPDATED_KEY = 'techhome_password_updated';

const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAr-5cpNGoo6_fXpCQEnJFpyIGX4571JMorTIFS1W_oR0yGp1IBTI1_wLO51A6b6JfC_35uve5CoPYM2-is77gcOReXdd7VPBeLws-awri7PskL8u2xh1eUq1gEueTXzsqrp1FazpahCNs2KQX5oD6Y71wxx9yphpqUC_70AN9j0OhuIPUMTQtlrRSkHGsR-Ae0MukU5Jd4FVlVWsEW6CT2kWvy2xncJ-4KiWGLTbYe6MdSfuaEhKi8EN4oTy2OdUS4X6E2bOW0w5E';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

export interface ProfileExtension {
  fullName: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
}

const defaultProfile: ProfileExtension = {
  fullName: '',
  phone: '',
  gender: '',
  dateOfBirth: '',
};

function toProfileExtension(dto: ProfileDto): ProfileExtension {
  return {
    fullName: dto.name ?? '',
    phone: dto.phone ?? '',
    gender: dto.gender ?? '',
    dateOfBirth: dto.dateOfBirth ?? '',
  };
}

const DEFAULT_PASSWORD_UPDATED = '--';

function loadProfile(): ProfileExtension {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...defaultProfile };
    const parsed = JSON.parse(raw);
    return { ...defaultProfile, ...parsed };
  } catch {
    return { ...defaultProfile };
  }
}

function saveProfile(p: ProfileExtension) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
}

function loadPasswordUpdated(): string {
  return localStorage.getItem(PASSWORD_UPDATED_KEY) || DEFAULT_PASSWORD_UPDATED;
}

/** Format ISO date to "dd/MM/yyyy HH:mm" */
function formatPasswordChangedAt(iso: string | null | undefined): string {
  if (!iso) return loadPasswordUpdated();
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return loadPasswordUpdated();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${h}:${m}`;
  } catch {
    return loadPasswordUpdated();
  }
}

function displayValue(value: string, placeholder: string) {
  return value?.trim() ? value : placeholder;
}

type ProfilePageProps = {
  variant?: 'customer' | 'admin';
};

const ProfilePage: React.FC<ProfilePageProps> = ({ variant = 'customer' }) => {
  const { user, isAuthenticated, isInitialized, updateCurrentUser } = useAuth();
  const { avatarUrl, setAvatarUrl } = useAvatar();
  const isAdminProfile = variant === 'admin';
  const [profile, setProfile] = useState<ProfileExtension>(loadProfile);
  const [passwordUpdated, setPasswordUpdated] = useState(loadPasswordUpdated);
  const [apiProfile, setApiProfile] = useState<ProfileDto | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ProfileExtension>({ ...profile });
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [addressBook, setAddressBook] = useState<SavedAddress[]>([]);
  const [addressBookLoading, setAddressBookLoading] = useState(true);
  const [addressBookError, setAddressBookError] = useState<string | null>(null);
  const [verifyResendLoading, setVerifyResendLoading] = useState(false);
  const [verifyResendMsg, setVerifyResendMsg] = useState<string | null>(null);
  const [googleLinkLoading, setGoogleLinkLoading] = useState(false);
  const [googleLinkMsg, setGoogleLinkMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAvatar = avatarUrl ?? DEFAULT_AVATAR;
  const displayName = user?.name ?? profile.fullName;
  const displayEmail = user?.email ?? '-';

  useEffect(() => {
    setProfile(loadProfile());
    setPasswordUpdated(loadPasswordUpdated());
  }, []);

  useEffect(() => {
    if (!isApiConfigured() || !isAuthenticated) return;
    getProfile()
      .then(setApiProfile)
      .catch(() => setApiProfile(null));
  }, [isAuthenticated]);

  const refreshAddressBook = useCallback(async () => {
    if (!isApiConfigured() || !isAuthenticated) {
      setAddressBook([]);
      setAddressBookLoading(false);
      setAddressBookError(null);
      return;
    }
    setAddressBookLoading(true);
    setAddressBookError(null);
    try {
      const list = await getAddresses();
      setAddressBook(list.map(addressDtoToSaved));
    } catch (e) {
      setAddressBook([]);
      setAddressBookError(
        e instanceof ApiError ? e.message : 'Không tải được danh sách địa chỉ. Vui lòng thử lại.'
      );
    } finally {
      setAddressBookLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;
    void refreshAddressBook();
  }, [isInitialized, isAuthenticated, refreshAddressBook]);

  useEffect(() => {
    if (!apiProfile) return;
    // Keep avatar (and header image) in sync with backend.
    setAvatarUrl(apiProfile.avatarUrl ?? null);
    const mapped = toProfileExtension(apiProfile);
    setProfile(mapped);
    saveProfile(mapped);
  }, [apiProfile]);

  const handleUploadClick = () => {
    if (avatarUploading) return;
    setAvatarError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Vui lòng chọn ảnh JPG, PNG hoặc GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Ảnh tối đa 2MB.');
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const url = await uploadImage(file);
      const updated = await updateProfile({ avatarUrl: url });
      setApiProfile(updated);
      setAvatarUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Tải ảnh thất bại';
      setAvatarError(msg);
    } finally {
      setAvatarUploading(false);
    }
  };

  const openEdit = useCallback(() => {
    setEditForm({ ...profile });
    setEditOpen(true);
  }, [profile]);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (isApiConfigured() && isAuthenticated) {
      try {
        const updated = await updateProfile({
          name: editForm.fullName,
          phone: editForm.phone || null,
          gender: editForm.gender || null,
          dateOfBirth: editForm.dateOfBirth || null,
        });
        setApiProfile(updated);
        updateCurrentUser({ name: updated.name, email: updated.email });
      } catch {
        // Fallback local khi API lỗi
      }
    }
    setProfile(editForm);
    saveProfile(editForm);
    setEditOpen(false);
  }, [editForm, isAuthenticated, updateCurrentUser]);

  const displayPasswordUpdated = isApiConfigured() && apiProfile?.passwordChangedAt
    ? formatPasswordChangedAt(apiProfile.passwordChangedAt)
    : passwordUpdated;
  const isGoogleLinked = apiProfile?.authProvider?.toUpperCase() === 'GOOGLE';

  const handleLinkGoogle = useCallback(() => {
    if (googleLinkLoading) return;
    setGoogleLinkMsg(null);
    const redirectUri = `${window.location.origin}/#/oauth/google/callback`;
    window.location.href = getGoogleLoginUrl(redirectUri);
  }, [googleLinkLoading]);

  const handleUnlinkGoogle = useCallback(async () => {
    if (googleLinkLoading) return;
    setGoogleLinkLoading(true);
    setGoogleLinkMsg(null);
    try {
      const updated = await unlinkGoogleAccount();
      setApiProfile(updated);
      setGoogleLinkMsg('Đã hủy liên kết Google.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể hủy liên kết Google.';
      setGoogleLinkMsg(msg);
    } finally {
      setGoogleLinkLoading(false);
    }
  }, [googleLinkLoading]);

  const openPasswordModal = useCallback(() => {
    setChangePasswordError(null);
    setPasswordModalOpen(true);
  }, []);

  const closePasswordModal = useCallback(() => {
    setPasswordModalOpen(false);
    setChangePasswordError(null);
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  }, []);

  const handleSubmitChangePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setChangePasswordError(null);
      const { currentPassword, newPassword, confirmPassword } = pwForm;
      if (!currentPassword.trim()) {
        setChangePasswordError('Vui lòng nhập mật khẩu hiện tại.');
        return;
      }
      if (!newPassword.trim()) {
        setChangePasswordError('Vui lòng nhập mật khẩu mới.');
        return;
      }
      if (newPassword.length < 6) {
        setChangePasswordError('Mật khẩu mới tối thiểu 6 ký tự.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setChangePasswordError('Mật khẩu mới và xác nhận không khớp.');
        return;
      }
      if (!isApiConfigured()) {
        const now = new Date();
        const str = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        localStorage.setItem(PASSWORD_UPDATED_KEY, str);
        setPasswordUpdated(str);
        closePasswordModal();
        return;
      }
      setChangePasswordLoading(true);
      try {
        await changePassword(currentPassword, newPassword);
        const updated = await getProfile();
        setApiProfile(updated);
        closePasswordModal();
      } catch (err: unknown) {
        const msg =
          err instanceof ApiError && err.body?.message
            ? String(err.body.message)
            : err instanceof Error
              ? err.message
              : 'Đổi mật khẩu thất bại. Kiểm tra mật khẩu hiện tại.';
        setChangePasswordError(msg);
      } finally {
        setChangePasswordLoading(false);
      }
    },
    [pwForm, closePasswordModal]
  );

  if (isInitialized && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display">
      {!isAdminProfile && <AccountHeader />}

      <div
        className={
          isAdminProfile
            ? 'max-w-[1440px] mx-auto px-6 sm:px-8 py-10'
            : 'max-w-[1440px] mx-auto px-6 sm:px-8 py-10 flex gap-10'
        }
      >
        {!isAdminProfile && <AccountSidebar />}

        <main
          className={
            isAdminProfile ? 'space-y-8 min-w-0' : 'flex-grow space-y-8 min-w-0'
          }
        >
          <div>
            <Breadcrumb
              items={[
                { label: 'Trang chủ', path: '/' },
                { label: 'Tài khoản', path: isAdminProfile ? '/admin/profile' : '/profile' },
                { label: 'Hồ sơ' },
              ]}
            />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Hồ sơ cá nhân</h1>
            <p className="text-slate-500 mt-1.5">Quản lý thông tin và bảo mật tài khoản.</p>
          </div>

          {!isAdminProfile &&
            isApiConfigured() &&
            isAuthenticated &&
            apiProfile != null &&
            (apiProfile.emailVerifiedAt == null || apiProfile.emailVerifiedAt === '') && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                <p className="font-medium">Email chưa được xác minh</p>
                <p className="mt-1 opacity-90">
                  Kiểm tra hộp thư (và spam) để bấm liên kết xác minh, hoặc gửi lại email.
                </p>
                {verifyResendMsg && <p className="mt-2 text-xs">{verifyResendMsg}</p>}
                <button
                  type="button"
                  disabled={verifyResendLoading}
                  onClick={() => {
                    setVerifyResendMsg(null);
                    setVerifyResendLoading(true);
                    void resendVerificationEmail()
                      .then((r) => setVerifyResendMsg(r.message ?? 'Đã gửi.'))
                      .catch((e: unknown) =>
                        setVerifyResendMsg(e instanceof ApiError ? e.message : 'Không gửi được. Thử lại sau.')
                      )
                      .finally(() => setVerifyResendLoading(false));
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60"
                >
                  {verifyResendLoading ? 'Đang gửi…' : 'Gửi lại email xác minh'}
                </button>
              </div>
            )}

          {/* Avatar */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <span className="material-icons text-primary">photo_camera</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ảnh đại diện</h2>
            </div>
            <div className="p-8 flex items-center gap-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="relative group flex-shrink-0">
                <img
                  alt="Avatar"
                  src={currentAvatar}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-slate-50 dark:ring-slate-800"
                />
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={avatarUploading}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Đổi ảnh"
                >
                  <span className="material-icons text-white">photo_camera</span>
                </button>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-2">JPG, PNG hoặc GIF. Tối đa 2MB.</p>
                {avatarError && <p className="text-sm text-red-500 mb-2">{avatarError}</p>}
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={avatarUploading}
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
                >
                  {avatarUploading ? 'Đang tải...' : 'Tải ảnh lên'}
                </button>
              </div>
            </div>
          </section>

          {/* 1. Thông tin cá nhân */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Thông tin cá nhân</h2>
              <button
                type="button"
                onClick={openEdit}
                className="flex items-center gap-2 text-primary text-sm font-bold hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors"
              >
                <span className="material-icons text-lg">edit</span>
                Cập nhật
              </button>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Họ và tên</p>
                <p className="text-slate-900 dark:text-white font-medium">{displayName}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Số điện thoại</p>
                <p className="text-slate-900 dark:text-white font-medium">{displayValue(profile.phone, '-')}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Giới tính</p>
                <p className="text-slate-900 dark:text-white font-medium">{displayValue(profile.gender, '- (Chưa cập nhật)')}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Email</p>
                <p className="text-slate-900 dark:text-white font-medium">{displayEmail}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Ngày sinh</p>
                <p className="text-slate-900 dark:text-white font-medium">{displayValue(profile.dateOfBirth, '- (Chưa cập nhật)')}</p>
              </div>
            </div>
          </section>

          {/* 2. Sổ địa chỉ — GET /api/addresses */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sổ địa chỉ</h2>
                {isApiConfigured() && !addressBookLoading && addressBookError == null && (
                  <p className="text-xs text-slate-500 mt-1">
                    {addressBook.length === 0
                      ? 'Chưa có địa chỉ lưu trên tài khoản'
                      : `${addressBook.length} địa chỉ đã lưu`}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isApiConfigured() && (
                  <button
                    type="button"
                    onClick={() => void refreshAddressBook()}
                    disabled={addressBookLoading}
                    className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <span className="material-icons text-lg">refresh</span>
                    Làm mới
                  </button>
                )}
                <Link
                  to="/account/addresses"
                  className="flex items-center gap-2 text-primary text-sm font-bold hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors"
                >
                  <span className="material-icons text-lg">add</span>
                  Thêm / Quản lý
                </Link>
              </div>
            </div>

            {!isApiConfigured() && (
              <div className="p-8 text-sm text-slate-500 dark:text-slate-400">
                Bật cấu hình API để đồng bộ địa chỉ với máy chủ. Bạn vẫn có thể{' '}
                <Link to="/account/addresses" className="text-primary font-semibold hover:underline">
                  mở trang sổ địa chỉ
                </Link>
                .
              </div>
            )}

            {isApiConfigured() && addressBookError && (
              <div className="mx-6 mt-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <span>{addressBookError}</span>
                <button
                  type="button"
                  onClick={() => void refreshAddressBook()}
                  className="self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Thử lại
                </button>
              </div>
            )}

            {isApiConfigured() && addressBookLoading && (
              <div className="p-10 text-center text-slate-500 text-sm">Đang tải địa chỉ…</div>
            )}

            {isApiConfigured() && !addressBookLoading && !addressBookError && addressBook.length === 0 && (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                  <span className="material-icons text-6xl text-slate-400 dark:text-slate-500">location_off</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Bạn chưa có địa chỉ nào được tạo</p>
                <p className="text-sm text-slate-500 mt-1 mb-6">Thêm địa chỉ để giao hàng nhanh hơn</p>
                <Link
                  to="/account/addresses"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors"
                >
                  <span className="material-icons">add</span>
                  Thêm địa chỉ
                </Link>
              </div>
            )}

            {isApiConfigured() && !addressBookLoading && !addressBookError && addressBook.length > 0 && (
              <div className="p-6 space-y-4">
                <ul className="space-y-3">
                  {addressBook.slice(0, 3).map((addr) => (
                    <li
                      key={addr.id}
                      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{addr.name}</p>
                          <p className="text-sm text-slate-500">{addr.phone}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {addr.addressLines.join(', ')}
                          </p>
                        </div>
                        {addr.isDefault && (
                          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full">
                            Mặc định
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {addressBook.length > 3 && (
                  <p className="text-xs text-slate-500 text-center">
                    Và {addressBook.length - 3} địa chỉ khác —{' '}
                    <Link to="/account/addresses" className="text-primary font-semibold hover:underline">
                      xem tất cả
                    </Link>
                  </p>
                )}
                <div className="pt-2 text-center">
                  <Link
                    to="/account/addresses"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    Quản lý sổ địa chỉ
                    <span className="material-icons text-base">chevron_right</span>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* 3. Mật khẩu */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mật khẩu</h2>
              <button
                type="button"
                onClick={openPasswordModal}
                className="flex items-center gap-2 text-primary text-sm font-bold hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors"
              >
                <span className="material-icons text-lg">lock</span>
                Thay đổi mật khẩu
              </button>
            </div>
            <div className="p-8 space-y-2">
              <p className="text-slate-600 dark:text-slate-400">
                Mật khẩu: <span className="font-mono font-semibold text-slate-900 dark:text-white">••••••••</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Cập nhật lần cuối lúc: <span className="font-semibold text-slate-900 dark:text-white">{displayPasswordUpdated}</span>
              </p>
            </div>
          </section>

          {/* 4. Tài khoản liên kết */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tài khoản liên kết</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="material-icons text-slate-600 dark:text-slate-400">mail</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Google</p>
                    <p
                      className={`text-sm font-medium ${
                        isGoogleLinked
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isGoogleLinked ? 'Đã liên kết' : 'Chưa liên kết'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={isGoogleLinked ? () => void handleUnlinkGoogle() : handleLinkGoogle}
                  disabled={googleLinkLoading}
                  className={
                    isGoogleLinked
                      ? 'px-4 py-2 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-60'
                      : 'px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-60'
                  }
                >
                  {googleLinkLoading ? 'Đang xử lý...' : isGoogleLinked ? 'Hủy liên kết' : 'Liên kết'}
                </button>
              </div>
              <div className="px-6 py-5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <span className="material-icons text-slate-600 dark:text-slate-400">chat</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Zalo</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Chưa liên kết</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Liên kết
                </button>
              </div>
            </div>
            {googleLinkMsg && (
              <div className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800">
                {googleLinkMsg}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal Cập nhật thông tin */}
      {editOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={closeEdit}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cập nhật thông tin</h3>
              <button type="button" onClick={closeEdit} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <span className="material-icons">close</span>
              </button>
            </div>
            <form
              className="p-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit();
              }}
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Họ và tên</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Giới tính</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Chọn --</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  value={editForm.dateOfBirth}
                  onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors">
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thay đổi mật khẩu */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={closePasswordModal}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thay đổi mật khẩu</h3>
              <button type="button" onClick={closePasswordModal} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <span className="material-icons">close</span>
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={handleSubmitChangePassword}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                  autoComplete="new-password"
                />
              </div>
              {changePasswordError && (
                <p className="text-sm text-red-600 dark:text-red-400">{changePasswordError}</p>
              )}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={changePasswordLoading}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-60"
                >
                  {changePasswordLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isAdminProfile && <AccountFooter />}
    </div>
  );
};

export default ProfilePage;
