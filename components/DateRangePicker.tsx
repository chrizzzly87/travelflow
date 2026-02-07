import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar, ArrowRight } from 'lucide-react';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onChange: (start: string, end: string) => void;
    disabled?: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const [mode, setMode] = useState<'start' | 'end'>('start');
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    
    const containerRef = useRef<HTMLDivElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    // Parse YYYY-MM-DD string to local Date object
    const parseDate = (str: string) => {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    // Format Date to YYYY-MM-DD
    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const sDate = parseDate(startDate);
    const eDate = parseDate(endDate);

    const getViewDateForMode = (targetMode: 'start' | 'end') => {
        if (targetMode === 'end') {
            if (eDate) return new Date(eDate);
            if (sDate) return new Date(sDate);
            return new Date();
        }

        if (sDate) return new Date(sDate);
        return new Date();
    };

    useEffect(() => {
        if (!isOpen) return;
        setViewDate(getViewDateForMode(mode));
    }, [isOpen, mode, startDate, endDate]); 

    // Handle clicks outside (needs to account for Portal)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Check if click is inside container (input) OR inside calendar (portal)
            const inContainer = containerRef.current?.contains(target);
            const inCalendar = calendarRef.current?.contains(target);

            if (!inContainer && !inCalendar) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
             if (isOpen) setIsOpen(false); 
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    // Calculate position synchronous to paint to avoid "flying" effect
    useLayoutEffect(() => {
        if (!isOpen || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const width = 288; // w-72
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

        setPosition({
            // fixed-position portal uses viewport coordinates directly
            top: rect.bottom + 8,
            left
        });
    }, [isOpen, startDate, endDate, mode]);

    useEffect(() => {
        if (!isOpen) return;
        const handleResize = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const width = 288;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            setPosition({ top: rect.bottom + 8, left });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen]);

    const getDaysInMonth = (year: number, month: number) => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        // Monday start logic (0 = Mon, 6 = Sun)
        const startPad = (firstDay.getDay() + 6) % 7;

        // Previous month padding
        const prevMonthLast = new Date(year, month, 0).getDate();
        for (let i = startPad - 1; i >= 0; i--) {
            days.push({ date: new Date(year, month - 1, prevMonthLast - i), isCurrent: false });
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({ date: new Date(year, month, i), isCurrent: true });
        }

        // Next month padding (grid of 42)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: new Date(year, month + 1, i), isCurrent: false });
        }

        return days;
    };

    const handleDateClick = (date: Date) => {
        const strDate = formatDate(date);

        if (mode === 'start') {
            if (eDate && date > eDate) {
                onChange(strDate, addDaysString(date, 7)); 
            } else {
                onChange(strDate, endDate);
            }
            setMode('end'); 
        } else {
            if (date < (sDate || new Date())) {
                onChange(strDate, endDate);
                setMode('end');
            } else {
                onChange(startDate, strDate);
                setIsOpen(false); 
                setMode('start'); 
            }
        }
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setDate(1); // Reset to 1st to avoid month skipping on 31st
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const addDaysString = (date: Date, days: number) => {
        const res = new Date(date);
        res.setDate(res.getDate() + days);
        return formatDate(res);
    };

    const openCalendar = (targetMode: 'start' | 'end') => {
        setMode(targetMode);
        setViewDate(getViewDateForMode(targetMode));
        setIsOpen(true);
    };

    const isSameDay = (a: Date | null, b: Date | null) => {
        if (!a || !b) return false;
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    };

    const shiftDate = (date: Date, days: number) => {
        const shifted = new Date(date);
        shifted.setDate(shifted.getDate() + days);
        return shifted;
    };

    const isDateInRange = (date: Date) => {
        let inRange = false;

        if (sDate && eDate && date > sDate && date < eDate) inRange = true;

        if (mode === 'end' && sDate && hoverDate) {
            if (date > sDate && date <= hoverDate) inRange = true;
            if (eDate && formatDate(date) === endDate && !isSameDay(hoverDate, eDate)) inRange = true;
        }

        return inRange;
    };

    const getDayClass = (date: Date, isCurrent: boolean) => {
        const str = formatDate(date);
        const isStart = str === startDate;
        const isEnd = str === endDate;
        const inRange = isDateInRange(date);
        const connectsRight = isStart && !isEnd && isDateInRange(shiftDate(date, 1));
        const connectsLeft = isEnd && !isStart && isDateInRange(shiftDate(date, -1));

        let base = "group h-9 w-full flex items-center justify-center text-sm relative isolate z-10 cursor-pointer rounded-none transition-colors ";
        
        if (isStart || isEnd) {
            base += "font-medium ";

            if (connectsRight || connectsLeft) {
                base += "before:content-[''] before:absolute before:z-0 before:top-0 before:bottom-0 before:bg-indigo-50 before:pointer-events-none ";
                if (connectsRight) base += "before:right-0 before:w-1/2 ";
                if (connectsLeft) base += "before:left-0 before:w-1/2 ";
            }
        } else if (inRange) {
             // Range State: Indigo text
            base += "bg-indigo-50 text-indigo-700 rounded-none ";
             if (!isCurrent) base += "opacity-40 ";
        } else {
             // Default State
            base += "hover:bg-gray-100 rounded-none ";
            if (!isCurrent) base += "text-gray-300 ";
            else base += "text-gray-700 font-medium ";
        }

        return base;
    };

    const getDayInnerClass = (date: Date) => {
        const str = formatDate(date);
        const isSelected = str === startDate || str === endDate;
        if (!isSelected) return "";
        return "relative z-10 h-9 w-9 flex items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition-colors group-hover:bg-indigo-700";
    };

    const days = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());

    return (
        <div className="relative" ref={containerRef}>
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Calendar size={14} className="text-indigo-500"/> Trip Dates
            </label>

            {/* Input Trigger */}
            <div className={`flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 transition-all ${isOpen ? 'ring-2 ring-indigo-500 bg-white' : ''} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                 <div 
                    className={`flex-1 cursor-pointer ${mode === 'start' && isOpen ? 'text-indigo-600' : ''}`}
                    onClick={() => { if(!disabled) { openCalendar('start'); } }}
                 >
                    <span className="text-xs text-gray-400 font-semibold block">Start</span>
                    <span className="text-sm font-medium text-gray-900 block min-h-[1.25rem]">
                        {sDate ? sDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Select Date'}
                    </span>
                 </div>
                 
                 <div className="px-3 text-gray-300">
                    <ArrowRight size={16} />
                 </div>
                 
                 <div 
                    className={`flex-1 text-right cursor-pointer ${mode === 'end' && isOpen ? 'text-indigo-600' : ''}`}
                    onClick={() => { if(!disabled) { openCalendar('end'); } }}
                 >
                    <span className="text-xs text-gray-400 font-semibold block text-right">End</span>
                    <span className="text-sm font-medium text-gray-900 block min-h-[1.25rem]">
                        {eDate ? eDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Select Date'}
                    </span>
                 </div>
            </div>

            {/* Portal Calendar */}
            {isOpen && createPortal(
                <div 
                    ref={calendarRef}
                    className="fixed bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-72 z-[9999]"
                    style={{ top: position.top, left: position.left }}
                >
                    
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-bold text-gray-800">
                            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 mb-2">
                        {DAYS.map(d => (
                            <div key={d} className="text-xs text-center font-bold text-gray-400 uppercase">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div 
                        className="grid grid-cols-7 gap-y-1"
                        onMouseLeave={() => setHoverDate(null)}
                    >
                        {days.map((d, i) => (
                            <div 
                                key={i} 
                                className={getDayClass(d.date, d.isCurrent)}
                                onClick={() => handleDateClick(d.date)}
                                onMouseEnter={() => setHoverDate(d.date)}
                            >
                                <span className={getDayInnerClass(d.date)}>
                                    {d.date.getDate()}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-center text-gray-500 font-medium">
                        {mode === 'start' ? 'Select start date' : 'Select end date'}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
