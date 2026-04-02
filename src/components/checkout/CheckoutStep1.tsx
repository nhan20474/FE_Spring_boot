import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCheckout } from '@/context/CheckoutContext';
import { useAuth } from '@/context/AuthContext';
import { getToken, isApiConfigured, ApiError } from '@/services/api';
import { getAddresses, createAddress, getProfile } from '@/services/backend';
import { addressDtoToSaved } from '@/services/addressMapper';
import type { SavedAddress } from '@/types';
import AddressCard from './AddressCard';

/** Id địa chỉ lưu trên server (POST /api/orders cần số hợp lệ). */
function isServerAddressId(id: string | null | undefined): boolean {
  if (id == null || id === '') return false;
  return /^\d+$/.test(id) && Number(id) > 0;
}

interface CheckoutStep1Props {
  onNext: () => void;
  onBack: () => void;
}

const FORM_INPUT_CLASS =
  'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm text-slate-900 dark:text-slate-100';

type AddressType = 'Home' | 'Office' | 'Other';

const defaultForm = {
  addressType: 'Home' as AddressType,
  fullName: '',
  phone: '',
  street: '',
  apartment: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Việt Nam',
  isDefault: false,
};

const CheckoutStep1: React.FC<CheckoutStep1Props> = ({ onNext, onBack }) => {
  const { checkoutData, updateCheckoutData } = useCheckout();
  const { isAuthenticated, isInitialized } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  const useBackendAddresses = isApiConfigured() && isInitialized && isAuthenticated && Boolean(getToken());

  useEffect(() => {
    if (!isInitialized) return;
    let cancelled = false;

    const run = async () => {
      setContinueError(null);

      if (!useBackendAddresses) {
        setAddressError(null);
        setLoadingAddresses(false);
        return;
      }

      setLoadingAddresses(true);
      setAddressError(null);
      try {
        const [list, profile] = await Promise.all([
          getAddresses(),
          getProfile().catch(() => null),
        ]);
        if (cancelled) return;
        let merged = list.map(addressDtoToSaved);
        if (profile?.defaultAddress) {
          const da = addressDtoToSaved(profile.defaultAddress);
          if (!merged.some((a) => a.id === da.id)) {
            merged = [da, ...merged];
          }
        }
        setAddresses(merged);
        const preferred =
          merged.find(
            (a) =>
              a.id === checkoutData.selectedAddress?.id && isServerAddressId(a.id)
          ) ??
          (profile?.defaultAddress?.id != null
            ? merged.find((a) => a.id === String(profile.defaultAddress.id))
            : undefined) ??
          merged.find((a) => a.isDefault) ??
          merged[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          updateCheckoutData({ selectedAddress: preferred });
        } else {
          setSelectedAddressId(null);
        }
      } catch (e) {
        if (!cancelled) {
          setAddresses([]);
          setSelectedAddressId(null);
          setAddressError(
            e instanceof ApiError ? e.message : 'Không tải được danh sách địa chỉ. Vui lòng thử lại.'
          );
        }
      } finally {
        if (!cancelled) setLoadingAddresses(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ load khi auth / API sẵn sàng
  }, [isInitialized, useBackendAddresses]);

  const retryLoadAddresses = useCallback(async () => {
    setAddressError(null);
    if (!useBackendAddresses) return;
    setLoadingAddresses(true);
    try {
      const [list, profile] = await Promise.all([
        getAddresses(),
        getProfile().catch(() => null),
      ]);
      let merged = list.map(addressDtoToSaved);
      if (profile?.defaultAddress) {
        const da = addressDtoToSaved(profile.defaultAddress);
        if (!merged.some((a) => a.id === da.id)) {
          merged = [da, ...merged];
        }
      }
      setAddresses(merged);
      const preferred = merged.find((a) => a.isDefault) ?? merged[0];
      if (preferred) {
        setSelectedAddressId(preferred.id);
        updateCheckoutData({ selectedAddress: preferred });
      }
    } catch (e) {
      setAddressError(
        e instanceof ApiError ? e.message : 'Không tải được danh sách địa chỉ. Vui lòng thử lại.'
      );
    } finally {
      setLoadingAddresses(false);
    }
  }, [useBackendAddresses, updateCheckoutData]);

  const showAddressLoading = !isInitialized || (useBackendAddresses && loadingAddresses);

  const handleSelectAddress = (addressId: string) => {
    setContinueError(null);
    setSelectedAddressId(addressId);
    const address = addresses.find((a) => a.id === addressId);
    if (address) {
      updateCheckoutData({ selectedAddress: address });
    }
  };

  const handleContinue = () => {
    setContinueError(null);
    if (isApiConfigured() && isAuthenticated) {
      if (!selectedAddressId || !isServerAddressId(selectedAddressId)) {
        setContinueError('Vui lòng chọn hoặc thêm địa chỉ đã lưu trên tài khoản để giao hàng.');
        return;
      }
    }
    if (selectedAddressId) {
      onNext();
    }
  };

  const openModal = useCallback(() => {
    setForm(defaultForm);
    setModalError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setForm(defaultForm);
    setModalError(null);
  }, []);

  const handleSubmitAddress = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setModalError(null);
      const token = getToken();
      if (token) {
        setSavingAddress(true);
        try {
          const dto = await createAddress({
            name: form.fullName.trim(),
            phone: form.phone.trim(),
            street: form.street.trim(),
            apartment: form.apartment.trim() || undefined,
            label: form.addressType,
            city: form.city.trim(),
            state: form.state.trim() || undefined,
            zipCode: form.zipCode.trim() || undefined,
            country: form.country.trim() || undefined,
            isDefault: form.isDefault,
          });
          const mapped = addressDtoToSaved(dto);
          const list = await getAddresses();
          const mappedList = list.map(addressDtoToSaved);
          setAddresses(mappedList);
          setSelectedAddressId(mapped.id);
          updateCheckoutData({ selectedAddress: mapped });
          closeModal();
        } catch (err) {
          setModalError(
            err instanceof ApiError ? err.message : 'Không lưu được địa chỉ. Vui lòng thử lại.'
          );
        } finally {
          setSavingAddress(false);
        }
        return;
      }
      const newAddr: SavedAddress = {
        id: `local-${Date.now()}`,
        label: form.addressType,
        tagIcon: form.addressType === 'Home' ? 'home' : form.addressType === 'Office' ? 'work' : 'add_location',
        tagPrimary: form.addressType === 'Home',
        name: form.fullName,
        phone: form.phone,
        street: form.street,
        apartment: form.apartment,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        country: form.country,
        isDefault: form.isDefault,
        addressLines: [
          form.street,
          form.apartment,
          `${form.city}, ${form.state} ${form.zipCode}`,
          form.country,
        ].filter(Boolean),
      };
      setAddresses((prev) => [...prev, newAddr]);
      setSelectedAddressId(newAddr.id);
      updateCheckoutData({ selectedAddress: newAddr });
      closeModal();
    },
    [form, updateCheckoutData, closeModal]
  );

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Địa chỉ giao hàng</h2>

      {isApiConfigured() && isInitialized && !isAuthenticated && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          <Link to="/login?returnUrl=/checkout" className="text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>{' '}
          để dùng địa chỉ đã lưu trên tài khoản và đồng bộ đơn hàng với hệ thống.
        </p>
      )}

      {useBackendAddresses && !addressError && (
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Danh sách đồng bộ với địa chỉ đã lưu trên <span className="font-medium text-slate-600 dark:text-slate-300">tài khoản</span> của bạn.
        </p>
      )}

      {addressError && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <span>{addressError}</span>
          <button
            type="button"
            onClick={() => void retryLoadAddresses()}
            className="self-start rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {continueError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {continueError}
        </div>
      )}

      <div className="space-y-4 mb-8">
        {showAddressLoading && <p className="text-slate-500 text-sm">Đang tải địa chỉ đã lưu…</p>}
        {!showAddressLoading && addresses.length === 0 && !addressError && (
          <p className="text-slate-500 text-sm">Chưa có địa chỉ. Thêm địa chỉ mới bên dưới.</p>
        )}
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            isSelected={selectedAddressId === address.id}
            onSelect={() => handleSelectAddress(address.id)}
            showActions={false}
          />
        ))}
      </div>

      <div className="mb-8">
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
        >
          <span className="material-icons">add</span>
          Thêm địa chỉ mới
        </button>
      </div>

      <div className="flex justify-between gap-4 pt-8 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Quay lại
        </button>
        <button
          onClick={handleContinue}
          disabled={!selectedAddressId}
          className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Tiếp tục
        </button>
      </div>

      {/* Add New Address Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" aria-hidden onClick={closeModal} />
          <div
            className="relative w-full max-w-[640px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-modal-title"
          >
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <div>
                <h2 id="address-modal-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                  Thêm địa chỉ mới
                </h2>
                <p className="text-sm text-slate-500 mt-1">Thêm địa chỉ giao hàng mới bên dưới.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                aria-label="Đóng"
              >
                <span className="material-icons text-2xl">close</span>
              </button>
            </div>
            <form id="address-form" onSubmit={handleSubmitAddress} className="px-8 py-6 space-y-5">
              {modalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {modalError}
                </div>
              )}
              <div className="flex gap-3 pb-2">
                {(['Home', 'Office', 'Other'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, addressType: type }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all ${
                      form.addressType === type
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="material-icons text-[18px]">{type === 'Home' ? 'home' : type === 'Office' ? 'work' : 'add_location'}</span>
                    {type}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Họ và tên</label>
                  <input
                    className={FORM_INPUT_CLASS}
                    placeholder="VD: Nguyễn Văn A"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Số điện thoại</label>
                  <input
                    className={FORM_INPUT_CLASS}
                    placeholder="0901234567"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Địa chỉ</label>
                <input
                  className={FORM_INPUT_CLASS}
                  placeholder="Số nhà, tên đường"
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">
                  Căn hộ, tòa nhà (tùy chọn)
                </label>
                <input
                  className={FORM_INPUT_CLASS}
                  placeholder="Căn hộ, tòa nhà..."
                  type="text"
                  value={form.apartment}
                  onChange={(e) => setForm((f) => ({ ...f, apartment: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Thành phố / Tỉnh</label>
                  <input
                    className={FORM_INPUT_CLASS}
                    placeholder="Thành phố"
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Quận / Huyện</label>
                  <input
                    className={FORM_INPUT_CLASS}
                    placeholder="Quận / Huyện"
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Mã bưu điện</label>
                  <input
                    className={FORM_INPUT_CLASS}
                    placeholder="Mã bưu điện"
                    type="text"
                    value={form.zipCode}
                    onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-bold text-slate-600 dark:text-slate-400 ml-1">Quốc gia</label>
                <select
                  className={FORM_INPUT_CLASS}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  required
                >
                  <option>Việt Nam</option>
                  <option>United States</option>
                  <option>Canada</option>
                  <option>United Kingdom</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="default-addr"
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 dark:border-slate-700 text-primary focus:ring-primary dark:bg-slate-800"
                />
                <label htmlFor="default-addr" className="text-sm font-medium text-slate-600 dark:text-slate-400 select-none cursor-pointer">
                  Đặt làm địa chỉ giao hàng mặc định
                </label>
              </div>
            </form>
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                form="address-form"
                disabled={savingAddress}
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/25 hover:bg-blue-600 hover:-translate-y-0.5 transition-all disabled:opacity-60"
              >
                {savingAddress ? 'Đang lưu…' : 'Lưu địa chỉ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutStep1;

