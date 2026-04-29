'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatAPI, userAPI } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  MessageSquareText,
  Paperclip,
  Phone,
  Search,
  SendHorizontal,
  Sparkles,
  Video,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';

const formatClock = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatConversationDate = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return formatClock(date);

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  });
};

const getInitials = (name?: string) => {
  if (!name) return 'CU';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const getDisplayName = (user?: any) => {
  return (
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    'Customer'
  );
};

const getMessageText = (message?: any) => {
  return (
    message?.inquiry?.detailedRequirements?.trim() ||
    message?.text?.trim() ||
    ''
  );
};

const getMessagePreview = (message?: any) => {
  const content = getMessageText(message);
  if (content) return content;

  const attachmentCount = Array.isArray(message?.attachments)
    ? message.attachments.length
    : 0;

  if (attachmentCount > 0) {
    return attachmentCount === 1
      ? 'Sent an attachment'
      : `Sent ${attachmentCount} attachments`;
  }

  return 'No messages yet';
};

const getMessageLabel = (message?: any) => {
  if (message?.messageCategory === 'inquiry') return 'Inquiry';
  if (message?.askPrice || message?.messageCategory === 'price_request') {
    return 'Price Request';
  }
  return null;
};

const renderAttachment = (attachment: any, isOwnMessage: boolean) => {
  const mimeType = attachment?.mimeType || '';
  const url = attachment?.url;
  if (!url) return null;

  const mediaFrameClass = cn(
    'overflow-hidden rounded-2xl border',
    isOwnMessage ? 'border-white/20 bg-white/10' : 'border-[#E9DFCF] bg-white',
  );

  if (mimeType.startsWith('image/')) {
    return (
      <div className={mediaFrameClass}>
        <img
          src={url}
          alt={attachment?.fileName || 'Image'}
          className="max-h-64 w-full object-cover"
        />
      </div>
    );
  }

  if (mimeType.startsWith('video/')) {
    return (
      <div className={mediaFrameClass}>
        <video className="max-h-72 w-full" controls>
          <source src={url} type={mimeType} />
        </video>
      </div>
    );
  }

  if (mimeType.startsWith('audio/')) {
    return (
      <div className={mediaFrameClass}>
        <audio className="w-full p-3" controls>
          <source src={url} type={mimeType} />
        </audio>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium underline-offset-4 hover:underline',
        isOwnMessage
          ? 'bg-white/15 text-white'
          : 'bg-slate-100 text-slate-700',
      )}
    >
      {attachment?.fileName || 'File attachment'}
    </a>
  );
};

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [search, setSearch] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const { data: profileData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => userAPI.getProfile(),
    select: (response) => response.data.data,
  });

  const { data: chatsData, isLoading: chatsLoading } = useQuery({
    queryKey: ['my-customers'],
    queryFn: () => chatAPI.getMyCustomers(),
    select: (response) => response.data.data,
  });

  const chats = Array.isArray(chatsData) ? chatsData : [];

  const { data: selectedChatData, isLoading: chatLoading } = useQuery({
    queryKey: ['chat', selectedChatId],
    queryFn: () => chatAPI.getChatById(selectedChatId as string),
    select: (response) => response.data.data,
    enabled: !!selectedChatId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: () =>
      chatAPI.sendMessage(selectedChatId as string, message.trim(), attachments),
    onSuccess: () => {
      setMessage('');
      setAttachments([]);
      queryClient.invalidateQueries({ queryKey: ['my-customers'] });
      queryClient.invalidateQueries({ queryKey: ['chat', selectedChatId] });
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.message || 'Failed to send message';
      toast.error(errorMessage);
    },
  });

  const activeChat = selectedChatData || null;
  const activeMessages = activeChat?.messages || [];
  const myUserId = profileData?._id;
  const activeCustomer = activeChat?.user || null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (socketRef.current) return;

    const baseUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/api\/v1\/?$/, '') ||
      window.location.origin;

    socketRef.current = io(baseUrl, {
      transports: ['websocket'],
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (socketRef.current && myUserId) {
      socketRef.current.emit('joinChatRoom', myUserId);
    }
  }, [myUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !myUserId) return;

    const handleCallRequest = (payload: any) => {
      const fromName = payload?.fromName || 'Caller';
      const callType = payload?.callType === 'video' ? 'video' : 'audio';
      const confirmCall = window.confirm(
        `${fromName} is calling (${callType}). Accept?`,
      );

      socket.emit(confirmCall ? 'call:answer' : 'call:reject', {
        ...payload,
        toUserId: payload?.fromUserId,
        fromUserId: myUserId,
      });
    };

    const handleCallAnswer = () => {
      toast.success('Call accepted. Start your WebRTC flow.');
    };

    const handleCallReject = () => {
      toast.error('Call rejected.');
    };

    const handleCallEnd = () => {
      toast('Call ended.');
    };

    const handleIncomingMessage = (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ['my-customers'] });
      if (payload?.chatId) {
        queryClient.invalidateQueries({ queryKey: ['chat', payload.chatId] });
      }
    };

    socket.on('call:request', handleCallRequest);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:reject', handleCallReject);
    socket.on('call:end', handleCallEnd);
    socket.on('newMassage', handleIncomingMessage);

    return () => {
      socket.off('call:request', handleCallRequest);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:reject', handleCallReject);
      socket.off('call:end', handleCallEnd);
      socket.off('newMassage', handleIncomingMessage);
    };
  }, [myUserId, queryClient]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId, activeMessages.length]);

  const handleSend = () => {
    if (!selectedChatId) {
      toast.error('Select a customer to chat');
      return;
    }
    if (!message.trim() && attachments.length === 0) {
      return;
    }
    sendMessageMutation.mutate();
  };

  const handleCall = (callType: 'audio' | 'video') => {
    if (!activeChat?.user?._id) {
      toast.error('Select a customer to call');
      return;
    }
    if (!socketRef.current) {
      toast.error('Call connection not ready');
      return;
    }

    socketRef.current.emit('call:request', {
      chatId: activeChat._id,
      fromUserId: myUserId,
      fromName:
        profileData?.storeName ||
        profileData?.name ||
        profileData?.firstName ||
        'Seller',
      toUserId: activeChat.user._id,
      callType,
      createdAt: new Date().toISOString(),
    });

    toast.success(
      `${callType === 'audio' ? 'Audio' : 'Video'} call request sent`,
    );
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const listItems = useMemo(() => {
    return chats
      .map((chat: any) => {
        const latestMessage = chat.messages?.[0];
        const displayName = getDisplayName(chat.user || chat);
        return {
          id: chat._id,
          name: displayName,
          avatar: chat.user?.avatar?.url || '',
          lastMessage: getMessagePreview(latestMessage),
          label: getMessageLabel(latestMessage),
          updatedAt: latestMessage?.date || chat.updatedAt,
          raw: chat,
        };
      })
      .filter((item) =>
        item.name.toLowerCase().includes(search.trim().toLowerCase()),
      );
  }, [chats, search]);

  useEffect(() => {
    if (!selectedChatId && listItems.length > 0) {
      setSelectedChatId(listItems[0].id);
      return;
    }

    if (
      selectedChatId &&
      listItems.length > 0 &&
      !listItems.some((item) => item.id === selectedChatId)
    ) {
      setSelectedChatId(listItems[0].id);
    }
  }, [listItems, selectedChatId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Messages
        </h1>
        <p className="mt-1 text-slate-500">Dashboard &gt; Messages</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="overflow-hidden rounded-[30px] border-[#EADFCF] bg-white shadow-[0_24px_80px_-48px_rgba(148,90,24,0.45)]">
          <div className="border-b border-[#F0E6D6] bg-[radial-gradient(circle_at_top_left,_rgba(245,186,89,0.20),_transparent_42%),linear-gradient(180deg,#fffdfa_0%,#ffffff_100%)] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0D8] text-[#B7791F] shadow-inner">
                <MessageSquareText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Customers
                </h2>
                <p className="text-sm text-slate-500">
                  Recent conversations and product inquiries
                </p>
              </div>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer"
                className="h-12 rounded-2xl border-[#E8DCC7] bg-white pl-11 shadow-sm"
              />
            </div>
          </div>

          <CardContent className="p-4">
            {chatsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-3xl" />
                <Skeleton className="h-24 rounded-3xl" />
                <Skeleton className="h-24 rounded-3xl" />
              </div>
            ) : listItems.length > 0 ? (
              <ScrollArea className="h-[560px] pr-3">
                <div className="space-y-3">
                  {listItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedChatId(item.id)}
                      className={cn(
                        'w-full rounded-[28px] border p-4 text-left transition-all duration-200',
                        selectedChatId === item.id
                          ? 'border-[#F1A642] bg-[linear-gradient(180deg,#fff8ed_0%,#fffdf8_100%)] shadow-[0_18px_40px_-30px_rgba(201,138,46,0.8)]'
                          : 'border-[#EFE5D7] bg-white hover:border-[#F1C27B] hover:bg-[#fffdfa]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12 border border-[#EFE5D7]">
                          <AvatarImage src={item.avatar} alt={item.name} />
                          <AvatarFallback className="bg-[#FFF0D8] text-[#9C6310]">
                            {getInitials(item.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate text-base font-semibold text-slate-900">
                              {item.name}
                            </p>
                            <span className="shrink-0 text-xs text-slate-400">
                              {formatConversationDate(item.updatedAt)}
                            </span>
                          </div>

                          {item.label ? (
                            <Badge className="mt-2 rounded-full bg-[#FFF1DE] px-2.5 py-1 text-[11px] font-medium text-[#B56C10] hover:bg-[#FFF1DE]">
                              {item.label}
                            </Badge>
                          ) : null}

                          <p className="mt-2 truncate text-sm text-slate-500">
                            {item.lastMessage}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-[420px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#EBDDC7] bg-[#FFFDF9] px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF1DE] text-[#B7791F]">
                  <MessageSquareText className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-800">
                  No conversations yet
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Customer chats and product inquiries will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[30px] border-[#EADFCF] bg-white shadow-[0_24px_80px_-48px_rgba(148,90,24,0.45)]">
          <div className="border-b border-[#F0E6D6] bg-[radial-gradient(circle_at_top_right,_rgba(245,186,89,0.18),_transparent_38%),linear-gradient(180deg,#fffdfa_0%,#ffffff_100%)] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {activeChat ? (
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-[#F2E1C8] shadow-sm">
                    <AvatarImage
                      src={activeCustomer?.avatar?.url || ''}
                      alt={getDisplayName(activeCustomer)}
                    />
                    <AvatarFallback className="bg-[#FFF0D8] text-[#9C6310]">
                      {getInitials(getDisplayName(activeCustomer))}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-slate-900">
                        {getDisplayName(activeCustomer)}
                      </h2>
                      <Badge className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50">
                        Active conversation
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Manage messages, product inquiries, and supplier follow-up.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Chat</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select a customer to start chatting
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-2xl border-[#E8DCC7] bg-white text-slate-700 hover:border-[#F1C27B] hover:bg-[#FFF8EE]"
                  onClick={() => handleCall('audio')}
                  disabled={!activeChat?.user?._id || sendMessageMutation.isPending}
                  title="Start audio call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-2xl border-[#E8DCC7] bg-white text-slate-700 hover:border-[#F1C27B] hover:bg-[#FFF8EE]"
                  onClick={() => handleCall('video')}
                  disabled={!activeChat?.user?._id || sendMessageMutation.isPending}
                  title="Start video call"
                >
                  <Video className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-5">
            {chatLoading && selectedChatId ? (
              <div className="space-y-4">
                <Skeleton className="h-28 rounded-[28px]" />
                <Skeleton className="ml-auto h-24 w-2/3 rounded-[28px]" />
                <Skeleton className="h-24 w-3/4 rounded-[28px]" />
              </div>
            ) : activeChat ? (
              <div className="flex flex-col gap-4">
                <div className="relative overflow-hidden rounded-[28px] border border-[#EADFCF] bg-[linear-gradient(180deg,#FFFDF9_0%,#FFF6E8_100%)] p-3">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(255,214,153,0.45),_transparent_60%)]" />

                  <ScrollArea className="relative h-[58vh] min-h-[420px] pr-4">
                    <div className="space-y-4 p-2">
                      {activeMessages.length > 0 ? (
                        activeMessages.map((msg: any) => {
                          const isOwnMessage = msg.user?._id === myUserId;
                          const messageText = getMessageText(msg);
                          const isInquiry =
                            msg.messageCategory === 'inquiry' ||
                            Boolean(msg.inquiry?.detailedRequirements);
                          const isPriceRequest =
                            msg.askPrice ||
                            msg.messageCategory === 'price_request';

                          return (
                            <div
                              key={msg._id}
                              className={cn(
                                'flex',
                                isOwnMessage ? 'justify-end' : 'justify-start',
                              )}
                            >
                              <div
                                className={cn(
                                  'max-w-[88%] rounded-[28px] px-4 py-4 shadow-sm sm:max-w-[76%]',
                                  isOwnMessage
                                    ? 'bg-[linear-gradient(135deg,#B87309_0%,#E48B18_100%)] text-white'
                                    : isInquiry
                                      ? 'border border-[#F1D7A8] bg-white text-slate-800 shadow-[0_18px_40px_-30px_rgba(201,138,46,0.65)]'
                                      : 'border border-[#E8DCC7] bg-white text-slate-800',
                                )}
                              >
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  {isInquiry ? (
                                    <Badge
                                      className={cn(
                                        'rounded-full px-2.5 py-1 text-[11px] font-medium',
                                        isOwnMessage
                                          ? 'bg-white/15 text-white hover:bg-white/15'
                                          : 'bg-[#FFF1DE] text-[#B56C10] hover:bg-[#FFF1DE]',
                                      )}
                                    >
                                      Inquiry
                                    </Badge>
                                  ) : null}

                                  {isPriceRequest ? (
                                    <Badge
                                      className={cn(
                                        'rounded-full px-2.5 py-1 text-[11px] font-medium',
                                        isOwnMessage
                                          ? 'bg-white/15 text-white hover:bg-white/15'
                                          : 'bg-sky-50 text-sky-700 hover:bg-sky-50',
                                      )}
                                    >
                                      Price Request
                                    </Badge>
                                  ) : null}

                                  {msg.productId?.title ? (
                                    <div
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                                        isOwnMessage
                                          ? 'bg-white/15 text-white'
                                          : 'bg-slate-100 text-slate-700',
                                      )}
                                    >
                                      <Package className="h-3.5 w-3.5" />
                                      <span className="max-w-[180px] truncate">
                                        {msg.productId.title}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>

                                {messageText ? (
                                  <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">
                                    {messageText}
                                  </p>
                                ) : null}

                                {isInquiry &&
                                msg.inquiry?.recommendMatchingSuppliers ? (
                                  <div
                                    className={cn(
                                      'mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium',
                                      isOwnMessage
                                        ? 'bg-white/15 text-white'
                                        : 'bg-emerald-50 text-emerald-700',
                                    )}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Recommend matching suppliers
                                  </div>
                                ) : null}

                                {Array.isArray(msg.attachments) &&
                                msg.attachments.length > 0 ? (
                                  <div className="mt-3 space-y-2">
                                    {msg.attachments.map(
                                      (attachment: any, index: number) => (
                                        <div
                                          key={
                                            attachment.public_id ||
                                            attachment.url ||
                                            index
                                          }
                                        >
                                          {renderAttachment(
                                            attachment,
                                            isOwnMessage,
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                ) : null}

                                <div
                                  className={cn(
                                    'mt-3 flex items-center justify-end gap-2 text-[11px]',
                                    isOwnMessage
                                      ? 'text-white/75'
                                      : 'text-slate-400',
                                  )}
                                >
                                  <span>{formatClock(msg.date)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#B7791F] shadow-sm">
                            <MessageSquareText className="h-8 w-8" />
                          </div>
                          <p className="mt-4 text-lg font-semibold text-slate-800">
                            No messages yet
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            Send a reply to start this conversation.
                          </p>
                        </div>
                      )}
                      <div ref={messageEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                <div className="rounded-[28px] border border-[#EADFCF] bg-white p-4 shadow-[0_18px_48px_-40px_rgba(148,90,24,0.55)]">
                  {attachments.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-2 rounded-full border border-[#E8DCC7] bg-[#FFF8EE] px-3 py-1.5 text-xs text-slate-700"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-[#B7791F]" />
                          <span className="max-w-[180px] truncate">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="font-medium text-slate-500 hover:text-slate-700"
                            disabled={sendMessageMutation.isPending}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Type your message or respond to the inquiry..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        disabled={sendMessageMutation.isPending}
                        className="min-h-[92px] rounded-[24px] border-[#E8DCC7] bg-[#FFFDF9] px-4 py-3 shadow-inner focus-visible:ring-[#F3D29B]"
                      />
                      <p className="mt-2 text-xs text-slate-400">
                        Press Enter to send, Shift + Enter for a new line.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E8DCC7] bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-[#F1C27B] hover:bg-[#FFF8EE]">
                        <Paperclip className="h-4 w-4 text-[#B7791F]" />
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                          onChange={handleFilesChange}
                          className="hidden"
                          disabled={sendMessageMutation.isPending}
                        />
                        Attach
                      </label>

                      <Button
                        onClick={handleSend}
                        className="h-12 rounded-2xl bg-[linear-gradient(135deg,#B87309_0%,#E48B18_100%)] px-5 text-white hover:opacity-95"
                        disabled={sendMessageMutation.isPending}
                      >
                        <SendHorizontal className="mr-2 h-4 w-4" />
                        {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[620px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#EBDDC7] bg-[linear-gradient(180deg,#FFFDF9_0%,#FFF7EA_100%)] px-6 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-[#B7791F] shadow-sm">
                  <MessageSquareText className="h-10 w-10" />
                </div>
                <p className="mt-5 text-2xl font-semibold text-slate-900">
                  Select a conversation
                </p>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Open a customer thread to review inquiry details, attachments,
                  and respond with pricing or shipping information.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
