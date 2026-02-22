'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orderAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TableSkeleton } from '@/components/table-skeleton';
import { toast } from 'sonner';
import Image from 'next/image';

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-slate-100 text-slate-700 border-slate-200',
  shipped: 'bg-amber-200 text-amber-900 border-amber-300',
  delivered: 'bg-amber-700 text-white border-amber-700',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'Processing',
  shipped: 'Shipping',
  delivered: 'Completed',
  cancelled: 'Cancelled',
};

const formatOrderDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', '');
};

type PaginationItem = number | 'ellipsis';

const getPaginationItems = (current: number, total: number): PaginationItem[] => {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 'ellipsis', total];
  }

  if (current >= total - 2) {
    return [1, 'ellipsis', total - 2, total - 1, total];
  }

  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const limit = 10;

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['orders', status, page, limit],
    queryFn: () => orderAPI.getOrders(status === 'all' ? undefined : status, page, limit),
    select: (response) => response.data.data ?? response.data,
  });

  const updateStatusMutation = useMutation({
    mutationFn: () =>
      orderAPI.updateOrderStatus(
        selectedOrder?.orderId,
        newStatus,
        trackingNumber || undefined
      ),
    onSuccess: () => {
      toast.success('Order status updated successfully');
      setShowStatusDialog(false);
      refetch();
      setNewStatus('');
      setTrackingNumber('');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update order';
      toast.error(message);
    },
  });

  const ordersPayload = ordersData ?? {};
  const orders = Array.isArray(ordersPayload)
    ? ordersPayload
    : Array.isArray(ordersPayload.orders)
      ? ordersPayload.orders
      : Array.isArray(ordersPayload.data)
        ? ordersPayload.data
        : Array.isArray(ordersPayload.results)
          ? ordersPayload.results
          : Array.isArray(ordersPayload.items)
            ? ordersPayload.items
            : [];
  const pagination =
    !Array.isArray(ordersPayload) ? ordersPayload.pagination || ordersPayload.meta || {} : {};
  const resolvedPage = pagination.page ?? ordersPayload.page ?? page;
  const resolvedLimit =
    pagination.limit ?? pagination.pageSize ?? ordersPayload.limit ?? limit;
  const totalItems =
    pagination.totalItems ??
    pagination.totalResults ??
    pagination.total ??
    ordersPayload.total ??
    ordersPayload.totalOrders ??
    ordersPayload.totalCount ??
    ordersPayload.count ??
    orders.length;
  const totalPages =
    pagination.totalPages ??
    pagination.pageCount ??
    (resolvedLimit ? Math.max(1, Math.ceil(totalItems / resolvedLimit)) : 1);
  const startIndex =
    totalItems === 0 ? 0 : (resolvedPage - 1) * resolvedLimit + 1;
  const endIndex =
    totalItems === 0 ? 0 : Math.min(resolvedPage * resolvedLimit, totalItems);
  const pageItems = getPaginationItems(resolvedPage, totalPages);

  const handleUpdateStatus = () => {
    if (!newStatus) {
      toast.error('Please select a status');
      return;
    }
    updateStatusMutation.mutate();
  };

  const openStatusDialog = (order: any) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setTrackingNumber(order.trackingNumber || '');
    setShowStatusDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Order</h1>
        <p className="text-sm text-slate-500">Dashboard / Order</p>
      </div>

      {/* Status Filter */}
      <Card className="border border-[#ede7dd] bg-[#faf8f5]">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-[#efe7dd] py-4">
          <div>
            <CardTitle className="text-base font-semibold text-[#3a342f]">
              Sales History
            </CardTitle>
          </div>
          <Select
            value={status}
            onValueChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 border-[#e5dbcf] bg-white text-sm">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={10} columns={6} />
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-[#f5f1ec]">
                  <TableRow className="border-b border-[#efe7dd]">
                    <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-[#6f6963]">
                      Customer
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-[#6f6963]">
                      Product
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-[#6f6963]">
                      Order ID
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-[#6f6963]">
                      Total Price
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-[#6f6963]">
                      Date
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold uppercase tracking-wide text-[#6f6963]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => {
                    const statusLabel =
                      STATUS_LABELS[order.status] ||
                      order.status.replace('_', ' ');
                    return (
                      <TableRow
                        key={order._id}
                        className="border-b border-[#efe7dd] bg-transparent transition-colors hover:bg-[#f7f3ee]"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-[#e9dfd3]">
                              <AvatarFallback className="bg-[#efe7dd] text-xs font-semibold text-[#6f6963]">
                                {order.customer?.name?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-[#2f2a25]">
                                {order.customer?.name}
                              </p>
                              <p className="text-xs text-[#8c867e]">
                                {order.customer?.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            {order.items?.[0]?.product?.photos?.[0] && (
                              <Image
                                src={
                                  order.items[0].product.photos[0].url ||
                                  '/placeholder.svg'
                                }
                                alt={order.items[0].product.title}
                                width={44}
                                height={44}
                                className="rounded-md border border-[#e9dfd3] object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <span className="text-sm text-[#3a342f]">
                              {order.items?.[0]?.product?.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-sm font-semibold text-[#3a342f]">
                          {order.orderId}
                        </TableCell>
                        <TableCell className="py-4 text-sm font-semibold text-[#3a342f]">
                          ${order.totalAmount}
                        </TableCell>
                        <TableCell className="py-4 text-sm text-[#6f6963]">
                          {formatOrderDate(order.createdAt)}
                        </TableCell>
                        <TableCell className="py-4">
                          <button
                            type="button"
                            onClick={() => openStatusDialog(order)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_BADGE_STYLES[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
                          >
                            {statusLabel}
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                              className="opacity-70"
                            >
                              <path
                                fill="currentColor"
                                d="M5 7l5 6 5-6H5z"
                              />
                            </svg>
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">No orders found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {orders.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#efe7dd] bg-[#faf8f5] px-4 py-3">
          <span className="text-sm text-[#6f6963]">
            Showing {startIndex} to {endIndex} of {totalItems} results
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, resolvedPage - 1))}
              disabled={resolvedPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5dbcf] bg-white text-[#8c867e] transition hover:bg-[#f4ede4] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M12.5 4.5L7 10l5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-1 text-sm text-[#8c867e]">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`h-7 min-w-[28px] rounded-md border px-2 text-xs font-semibold transition ${
                    item === resolvedPage
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-[#e5dbcf] bg-white text-[#6f6963] hover:bg-[#f4ede4]'
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, resolvedPage + 1))}
              disabled={resolvedPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e5dbcf] bg-white text-[#8c867e] transition hover:bg-[#f4ede4] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M7.5 4.5L13 10l-5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Order ID: {selectedOrder?.orderId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="status" className="text-sm font-medium">
                Status
              </Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newStatus === 'shipped' && (
              <div>
                <Label htmlFor="tracking" className="text-sm font-medium">
                  Tracking Number
                </Label>
                <Input
                  id="tracking"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="mt-2 border-2 border-amber-300"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowStatusDialog(false)}
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                disabled={updateStatusMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
