'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { ChatMessage, User } from '@/lib/types';
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { io, Socket } from 'socket.io-client';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { Send, MessageSquare, Check, CheckCheck, Users, ChevronUp, AtSign, Hand } from 'lucide-react';

export default function ChatPage() {
    return (
        <ProtectedRoute>
            <ChatContent />
        </ProtectedRoute>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`;
}

function formatDateDivider(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_BG = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-pink-500'];
const AVATAR_TEXT = ['text-violet-600', 'text-blue-600', 'text-emerald-600', 'text-rose-600', 'text-amber-600', 'text-cyan-600', 'text-pink-600'];

function colorIdx(name: string) {
    let h = 0;
    for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
    return Math.abs(h) % AVATAR_BG.length;
}

// ─── Notification Sound via Web Audio API ────────────────────────────────────
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Note 1
        const o1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        o1.connect(g1); g1.connect(ctx.destination);
        o1.type = 'sine';
        o1.frequency.setValueAtTime(880, ctx.currentTime);
        g1.gain.setValueAtTime(0.3, ctx.currentTime);
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 0.15);

        // Note 2 (slightly higher, offset)
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = 'sine';
        o2.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        g2.gain.setValueAtTime(0.25, ctx.currentTime + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o2.start(ctx.currentTime + 0.1); o2.stop(ctx.currentTime + 0.35);
    } catch { /* silently ignore if audio context unavailable */ }
}

// ─── Read receipt icon ────────────────────────────────────────────────────────
function ReadReceipt({ message, totalUsers }: { message: ChatMessage; totalUsers: number }) {
    const readByOthers = (message.readBy || []).filter(id => id !== message.userId);
    const allRead = totalUsers > 1 && readByOthers.length >= totalUsers - 1;
    if (readByOthers.length === 0) return <Check className="w-3 h-3 text-primary-foreground/60" />;
    if (allRead) return <CheckCheck className="w-3 h-3 text-blue-300" />;
    return <CheckCheck className="w-3 h-3 text-primary-foreground/60" />;
}

// ─── Render message content with @mentions highlighted ───────────────────────
function MessageContent({ content, users }: { content: string; users: User[] }) {
    // Build regex from actual user names (longest first to avoid partial matches)
    const mentionRegex = users.length > 0
        ? new RegExp(
            `(@(?:${users
                .map(u => u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .sort((a, b) => b.length - a.length)
                .join('|')}))`,
            'g'
        )
        : null;

    if (!mentionRegex) {
        return <p className="whitespace-pre-wrap">{content}</p>;
    }

    const parts = content.split(mentionRegex);
    return (
        <p className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                const mentionedUser = part.startsWith('@') ? users.find(u => `@${u.name}` === part) : null;
                if (mentionedUser) {
                    const ci = colorIdx(mentionedUser.name);
                    return (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 align-middle mx-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600 text-white"
                            title={mentionedUser.name}
                        >
                            <span className="w-3.5 h-3.5 rounded-full bg-white/30 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                                {getInitials(mentionedUser.name)}
                            </span>
                            {mentionedUser.name}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </p>
    );
}

// ─── Main Chat Component ──────────────────────────────────────────────────────
function ChatContent() {
    const currentUser = useAuthStore(state => state.user);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // @mention state
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [cursorPos, setCursorPos] = useState(0);

    const socketRef = useRef<Socket | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isPageVisible = useRef(true);

    const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.getUsers });

    // Members matching the @mention query
    const mentionMatches = mentionQuery
        ? users.filter(u => u.id !== currentUser?.id && u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
        : users.filter(u => u.id !== currentUser?.id);

    // ── Fetch messages ──
    const fetchMessages = useCallback(async (beforeId?: number) => {
        try {
            const url = beforeId ? `/api/chat/messages?limit=50&before=${beforeId}` : '/api/chat/messages?limit=50';
            const res = await api.get<ChatMessage[]>(url);
            return res.data;
        } catch { return []; }
    }, []);

    useEffect(() => {
        fetchMessages().then(msgs => {
            setMessages(msgs);
            if (msgs.length < 50) setHasMore(false);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
            if (msgs.length > 0) markRead(msgs[msgs.length - 1].id);
        });
    }, []);

    // ── Socket.io ──
    useEffect(() => {
        if (!currentUser) return;
        const socket = io({ path: '/socket.io' });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join', currentUser.id);
            socket.emit('chat:join', currentUser.id);
        });

        socket.on('chat:message', (msg: ChatMessage) => {
            setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);

            // Play sound only for messages from others
            if (msg.userId !== currentUser.id) {
                playNotificationSound();
                // Also trigger browser notification if page is not visible
                if (!isPageVisible.current && Notification.permission === 'granted') {
                    new Notification(`${msg.userName}`, { body: msg.content, icon: '/favicon.ico' });
                }
            }

            if (isPageVisible.current) markRead(msg.id);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        });

        socket.on('chat:read', ({ userId, upToId }: { userId: number; upToId: number }) => {
            setMessages(prev => prev.map(m =>
                m.id <= upToId && !(m.readBy || []).includes(userId)
                    ? { ...m, readBy: [...(m.readBy || []), userId] }
                    : m
            ));
        });

        return () => { socket.disconnect(); };
    }, [currentUser]);

    // ── Page visibility ──
    useEffect(() => {
        const handler = () => {
            isPageVisible.current = document.visibilityState === 'visible';
            if (isPageVisible.current && messages.length > 0)
                markRead(messages[messages.length - 1].id);
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [messages]);

    // Request browser notification permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    async function markRead(upToId: number) {
        try { await api.post('/api/chat/messages/read', { upToId }); } catch { }
    }

    async function handleLoadMore() {
        if (!hasMore || loadingMore || messages.length === 0) return;
        setLoadingMore(true);
        const older = await fetchMessages(messages[0].id);
        if (older.length < 50) setHasMore(false);
        setMessages(prev => [...older, ...prev]);
        setLoadingMore(false);
    }

    // ── @mention input handler ──
    function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const val = e.target.value;
        const pos = e.target.selectionStart || 0;
        setInput(val);
        setCursorPos(pos);

        // Find @mention trigger
        const textBefore = val.slice(0, pos);
        const match = textBefore.match(/@(\w*)$/);
        if (match) {
            setMentionQuery(match[1]);
            setMentionOpen(true);
            setMentionIndex(0);
        } else {
            setMentionOpen(false);
            setMentionQuery('');
        }

        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }

    function insertMention(user: User) {
        const pos = cursorPos;
        const textBefore = input.slice(0, pos);
        const textAfter = input.slice(pos);
        // Replace the @<partial> with @FullName
        const replaced = textBefore.replace(/@(\w*)$/, `@${user.name} `);
        setInput(replaced + textAfter);
        setMentionOpen(false);
        setMentionQuery('');
        setTimeout(() => {
            textareaRef.current?.focus();
            const newPos = replaced.length;
            textareaRef.current?.setSelectionRange(newPos, newPos);
        }, 0);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (mentionOpen && mentionMatches.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionMatches.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionMatches[mentionIndex]); return; }
            if (e.key === 'Escape') { setMentionOpen(false); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    }

    async function sendMessage() {
        const content = input.trim();
        if (!content || sending) return;
        setSending(true);
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = '24px';
        try { await api.post('/api/chat/messages', { content }); }
        catch { setInput(content); }
        finally { setSending(false); textareaRef.current?.focus(); }
    }

    // ── Group by date ──
    const grouped: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of messages) {
        const dateKey = new Date(msg.createdAt).toDateString();
        const last = grouped[grouped.length - 1];
        if (last && last.date === dateKey) last.messages.push(msg);
        else grouped.push({ date: dateKey, messages: [msg] });
    }

    // ── Render ──
    return (
        <div className="h-full flex flex-col bg-background overflow-hidden rounded-xl border border-border shadow-sm">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-card border-b border-border flex-none">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-foreground font-semibold text-[15px]">Team Chat</h1>
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Users className="w-3 h-3" />
                        <span>{users.length} members</span>
                        {users.filter(u => u.isWorking).length > 0 && (
                            <><span>·</span><span className="text-emerald-500 font-medium">{users.filter(u => u.isWorking).length} online</span></>
                        )}
                    </div>
                </div>
                <div className="flex -space-x-2">
                    {users.slice(0, 5).map(u => (
                        <div key={u.id} className={`w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${AVATAR_BG[colorIdx(u.name)]}`} title={u.name}>
                            {getInitials(u.name)}
                        </div>
                    ))}
                    {users.length > 5 && (
                        <div className="w-7 h-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold">+{users.length - 5}</div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 custom-scrollbar bg-muted/10">
                {hasMore && (
                    <div className="flex justify-center py-2">
                        <button onClick={handleLoadMore} disabled={loadingMore}
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card hover:bg-accent px-4 py-1.5 rounded-full border border-border shadow-sm transition-colors">
                            <ChevronUp className="w-3 h-3" />
                            {loadingMore ? 'Loading…' : 'Load older messages'}
                        </button>
                    </div>
                )}

                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-20 opacity-50">
                        <MessageSquare className="w-12 h-12 text-muted-foreground" />
                        <p className="text-muted-foreground text-sm">No messages yet. Say hello! <Hand className="w-4 h-4 inline-block text-amber-400 rotate-12" /></p>
                    </div>
                )}

                {grouped.map(group => (
                    <div key={group.date}>
                        {/* Date divider */}
                        <div className="flex items-center justify-center my-4 gap-3">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[11px] text-muted-foreground font-medium px-3 bg-card border border-border rounded-full py-0.5 shadow-sm">
                                {formatDateDivider(group.messages[0].createdAt)}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        {group.messages.map((msg, idx) => {
                            const isOwn = msg.userId === currentUser?.id;
                            const prevMsg = group.messages[idx - 1];
                            const isSameAuthor = prevMsg?.userId === msg.userId;
                            const ci = colorIdx(msg.userName);

                            return (
                                <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isSameAuthor ? 'mt-0.5' : 'mt-3'}`}>

                                    {/* Other avatar */}
                                    {!isOwn && (
                                        <div className="w-8 flex-shrink-0 flex items-end pb-1">
                                            {!isSameAuthor
                                                ? <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${AVATAR_BG[ci]}`}>{getInitials(msg.userName)}</div>
                                                : <div className="w-8" />}
                                        </div>
                                    )}

                                    <div className={`max-w-[65%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                        {!isOwn && !isSameAuthor && (
                                            <span className={`text-[11px] font-semibold mb-0.5 px-1 ${AVATAR_TEXT[ci]}`}>{msg.userName}</span>
                                        )}

                                        {/* Bubble */}
                                        <div
                                            className={`relative px-3.5 py-2 rounded-2xl shadow-sm text-sm leading-relaxed break-words ${isOwn
                                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                                : 'bg-card text-card-foreground border border-border rounded-bl-sm'}`}
                                            style={{ minWidth: '80px' }}
                                        >
                                            <MessageContent content={msg.content} users={users} />

                                            {/* Date + Time + receipt */}
                                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                    {formatDateTime(msg.createdAt)}
                                                </span>
                                                {isOwn && <ReadReceipt message={msg} totalUsers={users.length} />}
                                            </div>
                                        </div>

                                        {/* Seen by */}
                                        {isOwn && (msg.readBy || []).length > 1 && (
                                            <div className="text-[9px] text-muted-foreground mt-0.5 text-right px-1">
                                                Seen by {(msg.readBy || [])
                                                    .filter(id => id !== currentUser?.id)
                                                    .map(id => users.find(u => u.id === id)?.name?.split(' ')[0])
                                                    .filter(Boolean).join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Own avatar */}
                                    {isOwn && (
                                        <div className="w-8 flex-shrink-0 flex items-end pb-1">
                                            {!isSameAuthor
                                                ? <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-[11px] font-bold text-white">{getInitials(currentUser?.name || 'Me')}</div>
                                                : <div className="w-8" />}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}

                <div ref={bottomRef} className="h-1" />
            </div>

            {/* Input bar */}
            <div className="relative flex items-end gap-3 px-4 py-3 bg-card border-t border-border flex-none">

                {/* @mention dropdown */}
                {mentionOpen && mentionMatches.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150">
                        <div className="px-3 py-2 border-b border-border">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                                <AtSign className="w-3 h-3" /> Mention a member
                            </p>
                        </div>
                        {mentionMatches.slice(0, 6).map((u, i) => (
                            <button
                                key={u.id}
                                onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === mentionIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground'}`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${AVATAR_BG[colorIdx(u.name)]}`}>
                                    {getInitials(u.name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{u.name}</p>
                                    {u.title && <p className="text-[10px] text-muted-foreground truncate">{u.title}</p>}
                                </div>
                                {u.isAvailable && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Available" />}
                            </button>
                        ))}
                    </div>
                )}

                {/* @ trigger button */}
                <button
                    type="button"
                    onClick={() => {
                        setInput(prev => prev + '@');
                        setMentionOpen(true);
                        setMentionQuery('');
                        textareaRef.current?.focus();
                    }}
                    className="w-9 h-9 rounded-full bg-muted hover:bg-accent border border-border flex items-center justify-center transition-colors flex-shrink-0"
                    title="Mention someone (@)"
                >
                    <AtSign className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Text input */}
                <div className="flex-1 bg-background border border-border rounded-2xl px-4 py-2.5 flex items-end gap-2 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message… or @ to mention"
                        className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm outline-none resize-none leading-relaxed max-h-[120px] overflow-y-auto"
                        style={{ height: '24px' }}
                    />
                </div>

                {/* Send */}
                <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-md"
                >
                    <Send className="w-4 h-4 text-primary-foreground" />
                </button>
            </div>
        </div>
    );
}
