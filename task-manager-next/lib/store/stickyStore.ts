import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FloatingSticky {
    id: string;
    text: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isPoppedOut?: boolean;
}

interface StickyState {
    stickies: FloatingSticky[];
    addSticky: () => void;
    updateSticky: (id: string, updates: Partial<FloatingSticky>) => void;
    removeSticky: (id: string) => void;
}

const COLORS = [
    '#fef9c3', // Yellow
    '#dbeafe', // Blue
    '#dcfce7', // Green
    '#fce7f3', // Pink
    '#f3e8ff', // Purple
];

export const useStickyStore = create<StickyState>()(
    persist(
        (set) => ({
            stickies: [],

            addSticky: () => set((state) => ({
                stickies: [
                    ...state.stickies,
                    {
                        id: `sticky-${Date.now()}`,
                        text: '',
                        color: COLORS[Math.floor(Math.random() * COLORS.length)],
                        x: 100 + (state.stickies.length * 20),
                        y: 100 + (state.stickies.length * 20),
                        width: 200,
                        height: 200,
                    }
                ]
            })),

            updateSticky: (id, updates) => set((state) => ({
                stickies: state.stickies.map((s) => s.id === id ? { ...s, ...updates } : s)
            })),

            removeSticky: (id) => set((state) => ({
                stickies: state.stickies.filter((s) => s.id !== id)
            })),
        }),
        {
            name: 'global-stickies-storage',
        }
    )
);
