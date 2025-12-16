import React, { useState } from 'react';
import { Trash2, Star, X, CheckSquare, Heart, CircleDashed, LayoutGrid } from 'lucide-react';

interface FloatingActionBarProps {
    // Batch Mode Props
    selectedCount: number;
    onClearSelection: () => void;
    onSelectAll: () => void;
    onDelete: () => void;
    onStar: () => void;

    // Stats Mode Props (Optional)
    mode?: 'admin' | 'client';
    totalRuleSelectedCount?: number;
    unselectedCount?: number; // New prop
    favoritesCount?: number;
    starredCount?: number;
    activeFilter?: string;
    onFilter?: (filter: string) => void;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
    selectedCount,
    onClearSelection,
    onSelectAll,
    onDelete,
    onStar,
    mode = 'admin',
    totalRuleSelectedCount = 0,
    unselectedCount = 0,
    favoritesCount = 0,
    starredCount = 0,
    activeFilter,
    onFilter
}) => {

    // Track if user has interacted to hide the hint permanently
    const [hasInteracted, setHasInteracted] = useState(false);

    // Wrapper to track interaction
    const handleFilterClick = (filterType: string) => {
        setHasInteracted(true);
        if (onFilter) onFilter(filterType);
    };

    // --- MODE 1: BATCH ACTIONS (Admin/Editor) ---
    if (selectedCount > 0) {
        return (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out">
                <div className="bg-gray-900 text-white pl-4 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-4 border border-gray-700/50 backdrop-blur-md">

                    {/* Counter & Close */}
                    <div className="flex items-center gap-3 border-r border-gray-700 pr-4">
                        <div className="flex items-center justify-center bg-white text-gray-900 text-xs font-bold w-5 h-5 rounded-full">
                            {selectedCount}
                        </div>
                        <span className="text-sm font-medium">Seçildi</span>
                        <button
                            onClick={onClearSelection}
                            className="p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pr-2">
                        <button
                            onClick={onSelectAll}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium"
                            title="Tümünü Seç"
                        >
                            <CheckSquare size={16} />
                            <span className="hidden sm:inline">Tümünü Seç</span>
                        </button>

                        <button
                            onClick={onStar}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 rounded-lg transition-colors text-sm font-medium group"
                            title="Seçilenleri Yıldızla"
                        >
                            <Star size={16} className="group-hover:text-amber-400 transition-colors" />
                            <span className="hidden sm:inline">Yıldızla</span>
                        </button>

                        <button
                            onClick={onDelete}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-sm font-medium text-gray-300"
                            title="Seçilenleri Sil"
                        >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Sil</span>
                        </button>
                    </div>

                </div>
            </div>
        );
    }

    // --- MODE 2: STATS & NAVIGATION (Client View - when no batch selection) ---
    // Only render if we are in client mode or have stats to show
    if (mode === 'client' && onFilter) {

        // VISIBILITY RULE:
        // Only show if there is at least one "interaction" (Selection, Favorite, or Photographer Star).
        const shouldShow = totalRuleSelectedCount > 0 || favoritesCount > 0 || starredCount > 0;
        const isFilterActive = activeFilter && activeFilter !== 'all';

        // Show hint only if user has NEVER interacted AND no filter is currently active
        const showHint = !hasInteracted && !isFilterActive;

        if (!shouldShow) return null;

        return (
            <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out pointer-events-auto flex flex-col items-center">

                {/* Elegant Speech Bubble Hint - Disappears forever after interaction */}
                <div className={`mb-2 transition-all duration-500 ease-out transform origin-bottom ${showHint ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-4 pointer-events-none'}`}>
                    <div className="relative bg-white text-gray-900 px-4 py-2 rounded-xl shadow-xl border border-gray-100 flex items-center gap-2.5 animate-bounce">
                        {/* Pulsing Dot */}
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
                        </span>
                        <span className="text-[11px] font-bold tracking-wide">Filtrelemek için dokunun</span>

                        {/* Triangle Arrow */}
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 
                    border-l-[6px] border-l-transparent
                    border-r-[6px] border-r-transparent
                    border-t-[6px] border-t-white"
                        ></div>
                    </div>
                </div>

                {/* Elegant Backdrop Glow/Shadow Container */}
                <div className="relative">
                    {/* Soft blurred background for separation */}
                    <div className="absolute -inset-1 bg-black/20 blur-lg rounded-full" />

                    {/* Main Bar - Added transition-all for smooth width resizing */}
                    <div className="relative bg-gray-900/95 text-white p-1.5 rounded-full shadow-2xl flex items-center gap-1 border border-gray-700/50 backdrop-blur-xl ring-1 ring-white/10 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">

                        {/* 0. VIEW ALL (Only Visible when filtered) - SMOOTH EXPAND/COLLAPSE */}
                        <div
                            className={`flex items-center overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                ${isFilterActive ? 'max-w-[100px] opacity-100 mr-1' : 'max-w-0 opacity-0 mr-0'}
              `}
                        >
                            <button
                                onClick={() => handleFilterClick('all')}
                                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-white/10 transition-all text-gray-300 hover:text-white group whitespace-nowrap"
                                title="Filtreyi Temizle / Tümü"
                            >
                                <LayoutGrid size={18} className="group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold uppercase tracking-wide">Tümü</span>
                            </button>
                            <div className="w-px h-5 bg-gray-700 mx-1 shrink-0"></div>
                        </div>

                        {/* 1. TOTAL SELECTED (Left Pill) */}
                        {totalRuleSelectedCount > 0 && (
                            <button
                                onClick={() => handleFilterClick('selected')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all border
                    ${activeFilter === 'selected'
                                        ? 'bg-white text-gray-900 border-white shadow-lg scale-105'
                                        : 'bg-transparent text-white border-transparent hover:bg-white/10'}
                    `}
                            >
                                <div className={`flex items-center justify-center text-xs font-bold w-5 h-5 rounded-full ${activeFilter === 'selected' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
                                    {totalRuleSelectedCount}
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wide">Seçildi</span>
                            </button>
                        )}

                        {/* 2. UNSELECTED (Only show if selections exist) */}
                        {totalRuleSelectedCount > 0 && (
                            <>
                                <div className="w-px h-5 bg-gray-700 mx-1"></div>
                                <button
                                    onClick={() => handleFilterClick('unselected')}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all group
                        ${activeFilter === 'unselected'
                                            ? 'bg-gray-700 text-white shadow-inner'
                                            : 'text-gray-400 hover:text-white hover:bg-white/10'}
                        `}
                                    title="Henüz seçilmemiş fotoğraflar"
                                >
                                    <CircleDashed size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                                    <span className="text-xs font-bold">Seçilmeyenler ({unselectedCount})</span>
                                </button>
                            </>
                        )}

                        {totalRuleSelectedCount > 0 && <div className="w-px h-5 bg-gray-700 mx-1"></div>}

                        {/* 3. FAVORITES */}
                        <button
                            onClick={() => handleFilterClick('favorites')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all group
                    ${activeFilter === 'favorites' ? 'bg-red-500 text-white shadow-lg scale-105' : 'hover:bg-white/10'}
                `}
                        >
                            <Heart size={18} fill={favoritesCount > 0 || activeFilter === 'favorites' ? "currentColor" : "none"} className={`transition-transform group-hover:scale-110 ${activeFilter === 'favorites' ? '' : (favoritesCount > 0 ? 'text-red-500' : 'text-gray-400')}`} />
                            <span className="text-xs font-bold">
                                {favoritesCount > 0 ? `${favoritesCount} Favori` : 'Favori'}
                            </span>
                        </button>

                        {/* 4. PHOTOGRAPHER PICKS (Conditional) */}
                        {starredCount > 0 && (
                            <>
                                <div className="w-px h-5 bg-gray-700 mx-1"></div>
                                <button
                                    onClick={() => handleFilterClick('starred')}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all group
                        ${activeFilter === 'starred' ? 'bg-amber-500 text-white shadow-lg scale-105' : 'hover:bg-white/10'}
                    `}
                                    title="Fotoğrafçı Önerisi"
                                >
                                    <Star size={18} fill="currentColor" className={`transition-transform group-hover:rotate-[72deg] ${activeFilter === 'starred' ? 'text-white' : 'text-amber-400'}`} />
                                    <span className="text-xs font-bold whitespace-nowrap">Öneriler ({starredCount})</span>
                                </button>
                            </>
                        )}

                    </div>
                </div>
            </div>
        );
    }

    return null;
};
