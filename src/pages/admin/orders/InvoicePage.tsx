import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminGetOrder, downloadAdminOrderInvoicePdf } from '@/services/backend';
import { ApiError } from '@/services/api';
import type { AdminOrderDto } from '@/types/api';
import { formatVND } from '@/utils';

type InvoiceParty = {
  name: string;
  address: string;
};

type InvoiceItem = { id: number; description: string; quantity: number; unitPrice: number; lineTotal: number };

type InvoiceData = {
  from: InvoiceParty;
  to: InvoiceParty;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};

const InvoicePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const autoprint = searchParams.get('autoprint') === '1';

  const [adminOrder, setAdminOrder] = React.useState<AdminOrderDto | null>(null);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  useEffect(() => {
    if (!orderId) return;
    void adminGetOrder(orderId)
      .then((dto) => setAdminOrder(dto))
      .catch(() => setAdminOrder(null));
  }, [orderId]);

  const invoice: InvoiceData = useMemo(() => {
    if (!adminOrder) {
      return {
        from: { name: 'TechHome', address: 'TechHome Warehouse' },
        to: { name: '—', address: '—' },
        invoiceDate: '—',
        dueDate: '—',
        items: [],
        subtotal: 0,
        discount: 0,
        shipping: 0,
        total: 0,
      };
    }

    const subtotal = Number(adminOrder.subtotal ?? 0);
    const discount = Number(adminOrder.discountAmount ?? 0);
    const shipping = Number(adminOrder.shippingCost ?? 0);
    const fallbackTotal = adminOrder.items.reduce((sum, it) => sum + Number(it.lineTotal ?? (it.quantity * it.priceAtOrder)), 0);
    const total = Number(adminOrder.totalPrice ?? (subtotal - discount + shipping || fallbackTotal));

    return {
      from: { name: 'TechHome', address: 'TechHome Warehouse' },
      to: { name: adminOrder.customerName ?? 'Khách hàng', address: adminOrder.shippingAddressSummary ?? '—' },
      invoiceDate: adminOrder.createdAt ? new Date(adminOrder.createdAt).toLocaleDateString('en-GB') : '—',
      dueDate: '—',
      items: adminOrder.items.map((it, idx) => ({
        id: idx + 1,
        description: it.productName,
        quantity: it.quantity,
        unitPrice: Number(it.priceAtOrder),
        lineTotal: Number(it.lineTotal ?? (it.quantity * it.priceAtOrder)),
      })),
      subtotal,
      discount,
      shipping,
      total,
    };
  }, [adminOrder]);

  useEffect(() => {
    if (!autoprint) return;
    const t = window.setTimeout(() => {
      window.print();
    }, 400);
    return () => window.clearTimeout(t);
  }, [autoprint]);

  const rows = useMemo(() => invoice.items, [invoice.items]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleServerPdf = () => {
    if (!orderId) return;
    void (async () => {
      setPdfLoading(true);
      try {
        await downloadAdminOrderInvoicePdf(orderId);
      } catch (e) {
        window.alert(e instanceof ApiError ? e.message : 'Không tải được PDF từ máy chủ.');
      } finally {
        setPdfLoading(false);
      }
    })();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-[32px] leading-[44px] font-semibold tracking-tight text-[#202224]">Hóa đơn</h1>
          {orderId && (
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Mã đơn: <span className="text-slate-800">{orderId}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!orderId || pdfLoading}
            onClick={handleServerPdf}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="material-icons text-[18px]">picture_as_pdf</span>
            {pdfLoading ? 'Đang tải…' : 'Tải PDF'}
          </button>
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="material-icons text-[18px]">arrow_back</span>
            Quay lại danh sách đơn hàng
          </Link>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4 md:p-7 lg:p-8 print:border-0 print:shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-500">Bên bán :</p>
            <p className="text-base font-semibold text-slate-900">{invoice.from.name}</p>
            <p className="text-sm font-medium text-slate-500">{invoice.from.address}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-slate-500">Bên mua :</p>
            <p className="text-base font-semibold text-slate-900">{invoice.to.name}</p>
            <p className="text-sm font-medium text-slate-500">{invoice.to.address}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-500">Ngày hóa đơn :</span>
              <span className="font-semibold text-slate-900">{invoice.invoiceDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-500">Hạn thanh toán :</span>
              <span className="font-semibold text-slate-900">{invoice.dueDate}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-100/90">
                <th className="text-left text-xs md:text-sm font-semibold text-slate-600 px-5 py-3">STT</th>
                <th className="text-left text-xs md:text-sm font-semibold text-slate-600 px-5 py-3">Mô tả</th>
                <th className="text-right text-xs md:text-sm font-semibold text-slate-600 px-5 py-3">Số lượng</th>
                <th className="text-right text-xs md:text-sm font-semibold text-slate-600 px-5 py-3">Đơn giá</th>
                <th className="text-right text-xs md:text-sm font-semibold text-slate-600 px-5 py-3 rounded-r-xl">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 text-sm text-slate-700 border-b border-slate-100">{item.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-800 border-b border-slate-100">{item.description}</td>
                  <td className="px-5 py-4 text-sm text-right text-slate-700 border-b border-slate-100">{item.quantity}</td>
                  <td className="px-5 py-4 text-sm text-right text-slate-700 border-b border-slate-100">{formatVND(item.unitPrice)}</td>
                  <td className="px-5 py-4 text-sm text-right text-slate-800 font-semibold border-b border-slate-100">
                    {formatVND(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 space-y-2 text-sm max-w-xs ml-auto">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Tạm tính</span>
            <span className="font-medium tabular-nums">{formatVND(invoice.subtotal)}</span>
          </div>
          {invoice.discount > 0 ? (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Giảm giá</span>
              <span className="font-medium tabular-nums text-emerald-700">-{formatVND(invoice.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Phí vận chuyển</span>
            <span className="font-medium tabular-nums">{invoice.shipping === 0 ? 'Miễn phí' : formatVND(invoice.shipping)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-2 border-t border-slate-200 text-base">
            <span className="font-bold">Tổng thanh toán</span>
            <span className="font-bold text-primary tabular-nums">{formatVND(invoice.total)}</span>
          </div>
        </div>

        <div className="mt-8 flex justify-end items-center gap-3 print:hidden">
          <button
            type="button"
            disabled={!orderId || pdfLoading}
            onClick={handleServerPdf}
            className="w-11 h-11 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors inline-flex items-center justify-center shadow-sm disabled:opacity-50"
            aria-label="Tải PDF"
          >
            <span className="material-icons text-[20px]">picture_as_pdf</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center shadow-sm"
            aria-label="In hóa đơn"
          >
            <span className="material-icons text-[20px]">print</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default InvoicePage;
