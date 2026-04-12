"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_OF_WEEK = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MIN_YEAR = 1900;
const MAX_YEAR = 2099;

type CalView = "days" | "months" | "years";

interface DatePickerFieldProps {
  label: string;
  value: string; // YYYY-MM-DD or ""
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>; // compat — unused internally
  wrapperClassName?: string;
  variant?: string; // compat — ignored, unified style
  min?: string; // YYYY-MM-DD — e.g., today to block past (appointments)
  max?: string; // YYYY-MM-DD — e.g., today to block future (birth/visit dates)
}

/** "2026-04-11" → "11-APR-2026" */
function toDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  const mon = MONTHS_SHORT[parseInt(m) - 1]?.toUpperCase() ?? m;
  return `${d}-${mon}-${y}`;
}

export function DatePickerField({
  label,
  value,
  onChange,
  wrapperClassName,
  min,
  max,
}: DatePickerFieldProps) {
  // ── Mode ─────────────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);

  // ── Calendar state ────────────────────────────────────────────────────────
  const [showCal, setShowCal]   = useState(false);
  const [calView, setCalView]   = useState<CalView>("days");
  const [navYear, setNavYear]   = useState(new Date().getFullYear());
  const [navMonth, setNavMonth] = useState(new Date().getMonth());

  // ── Segment display state (for rendering) ─────────────────────────────────
  const [dd,   setDd]   = useState("");
  const [mm,   setMm]   = useState("");
  const [yyyy, setYyyy] = useState("");

  // ── Refs: always hold the latest typed value, avoiding stale closures ─────
  const ddR   = useRef("");
  const mmR   = useRef("");
  const yyyyR = useRef("");

  const dayRef  = useRef<HTMLInputElement>(null);
  const monRef  = useRef<HTMLInputElement>(null);
  const yrRef   = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const blurTmr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync external value → segments + nav
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      ddR.current = d;   setDd(d);
      mmR.current = m;   setMm(m);
      yyyyR.current = y; setYyyy(y);
      setNavYear(parseInt(y));
      setNavMonth(parseInt(m) - 1);
    } else {
      ddR.current = "";   setDd("");
      mmR.current = "";   setMm("");
      yyyyR.current = ""; setYyyy("");
    }
  }, [value]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const todayISO = new Date().toISOString().split("T")[0];

  function isDisabled(iso: string) {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  }

  function tryEmit(d: string, m: string, y: string) {
    if (d.length !== 2 || m.length !== 2 || y.length !== 4) return;
    const dN = parseInt(d), mN = parseInt(m), yN = parseInt(y);
    if (yN < MIN_YEAR || yN > MAX_YEAR || mN < 1 || mN > 12 || dN < 1 || dN > 31) return;
    const iso = `${y}-${m}-${d}`;
    if (!isDisabled(iso)) {
      onChange(iso);
      setNavYear(yN);
      setNavMonth(mN - 1);
    }
  }

  // ── Segment input handlers ────────────────────────────────────────────────
  function handleDayChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    ddR.current = v;
    setDd(v);
    const n = parseInt(v);
    if (v.length === 2 && n >= 1 && n <= 31) {
      // Only advance to MM when the day value is valid (1–31)
      setTimeout(() => { monRef.current?.select(); monRef.current?.focus(); }, 0);
    }
    tryEmit(v, mmR.current, yyyyR.current);
  }

  function handleMonChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2);
    mmR.current = v;
    setMm(v);
    const n = parseInt(v);
    if (v.length === 2 && n >= 1 && n <= 12) {
      // Only advance to YYYY when the month value is valid (1–12)
      setTimeout(() => { yrRef.current?.select(); yrRef.current?.focus(); }, 0);
    }
    tryEmit(ddR.current, v, yyyyR.current);
  }

  function handleYrChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    yyyyR.current = v;
    setYyyy(v);
    tryEmit(ddR.current, mmR.current, v);
  }

  // ── Focus / blur — controls edit↔display mode ─────────────────────────────
  function onPartFocus() {
    clearTimeout(blurTmr.current);
    setIsEditing(true);
  }

  function onPartBlur() {
    blurTmr.current = setTimeout(() => {
      // Pad and clamp values when leaving the entire picker
      let d = ddR.current, m = mmR.current, y = yyyyR.current;

      if (d.length === 1) { d = d.padStart(2, "0"); ddR.current = d; setDd(d); }
      if (m.length === 1) { m = m.padStart(2, "0"); mmR.current = m; setMm(m); }

      if      (y.length === 1) y = "200" + y;
      else if (y.length === 2) y = "20" + y;
      else if (y.length === 3) y = "2" + y;
      if (y !== yyyyR.current) { yyyyR.current = y; setYyyy(y); }

      const yN = parseInt(y);
      if (y.length === 4 && !isNaN(yN)) {
        if (yN < MIN_YEAR) { y = String(MIN_YEAR); yyyyR.current = y; setYyyy(y); }
        if (yN > MAX_YEAR) { y = String(MAX_YEAR); yyyyR.current = y; setYyyy(y); }
      }

      tryEmit(d, m, y);
      setIsEditing(false);
      setShowCal(false);
    }, 150);
  }

  // Prevent calendar clicks from triggering blur → mode switch
  function onCalMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    clearTimeout(blurTmr.current);
  }

  // ── Calendar day selection ────────────────────────────────────────────────
  function selectDay(d: number) {
    const m   = String(navMonth + 1).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    const y   = String(navYear);
    const iso = `${y}-${m}-${day}`;
    if (isDisabled(iso)) return;
    onChange(iso);
    ddR.current = day;   setDd(day);
    mmR.current = m;     setMm(m);
    yyyyR.current = y;   setYyyy(y);
    setShowCal(false);
    setIsEditing(false);
  }

  function prevMonth() {
    if (navMonth === 0) { setNavYear(y => y - 1); setNavMonth(11); }
    else setNavMonth(m => m - 1);
  }
  function nextMonth() {
    if (navMonth === 11) { setNavYear(y => y + 1); setNavMonth(0); }
    else setNavMonth(m => m + 1);
  }

  const selParsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").map(Number) as [number, number, number]
    : null;

  const accent = { background: "hsl(var(--accent-hue) var(--accent-sat) 44%)", color: "#fff" };

  // ── Calendar: days view ───────────────────────────────────────────────────
  function renderDays() {
    const total = new Date(navYear, navMonth + 1, 0).getDate();
    const start = new Date(navYear, navMonth, 1).getDay();
    const cells: React.ReactNode[] = [];
    for (let i = 0; i < start; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= total; d++) {
      const iso = `${navYear}-${String(navMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const isSel = selParsed && selParsed[0] === navYear && selParsed[1] === navMonth + 1 && selParsed[2] === d;
      const isToday = iso === todayISO;
      const dis = isDisabled(iso);
      cells.push(
        <button key={d} type="button" disabled={dis} onClick={() => selectDay(d)}
          style={isSel && !dis ? accent : undefined}
          className={[
            "h-9 w-9 rounded-full text-sm font-medium transition-colors flex items-center justify-center",
            dis    ? "text-slate-300 cursor-not-allowed" :
            isSel  ? "" :
            isToday? "bg-violet-100 text-violet-700 font-bold hover:bg-violet-200" :
                     "hover:bg-slate-100 text-slate-700",
          ].join(" ")}
        >{d}</button>
      );
    }
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-lg leading-none">‹</button>
          <button type="button" onClick={() => setCalView("months")} className="font-semibold text-sm hover:bg-slate-100 px-3 py-1 rounded-lg text-slate-800">
            {MONTHS_LONG[navMonth]} {navYear}
          </button>
          <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-lg leading-none">›</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAYS_OF_WEEK.map(d => <div key={d} className="h-9 w-9 flex items-center justify-center text-xs text-slate-400 font-semibold">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">{cells}</div>
      </>
    );
  }

  // ── Calendar: months view ─────────────────────────────────────────────────
  function renderMonths() {
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setNavYear(y => y - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-lg leading-none">‹</button>
          <button type="button" onClick={() => setCalView("years")} className="font-semibold text-sm hover:bg-slate-100 px-3 py-1 rounded-lg text-slate-800">{navYear}</button>
          <button type="button" onClick={() => setNavYear(y => y + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-lg leading-none">›</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_SHORT.map((m, i) => {
            const isSel = selParsed && selParsed[0] === navYear && selParsed[1] === i + 1;
            return (
              <button key={m} type="button" onClick={() => { setNavMonth(i); setCalView("days"); }}
                style={isSel ? accent : undefined}
                className={["py-2.5 rounded-xl text-sm font-semibold transition-colors", isSel ? "" : "hover:bg-slate-100 text-slate-700"].join(" ")}
              >{m}</button>
            );
          })}
        </div>
      </>
    );
  }

  // ── Calendar: years/decade view ───────────────────────────────────────────
  function renderYears() {
    const dec = Math.floor(navYear / 10) * 10;
    const years = Array.from({ length: 12 }, (_, i) => dec - 1 + i);
    return (
      <>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setNavYear(y => y - 10)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-lg leading-none">‹</button>
          <span className="font-semibold text-sm text-slate-800">{dec}–{dec + 9}</span>
          <button type="button" onClick={() => setNavYear(y => y + 10)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-lg leading-none">›</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {years.map(y => {
            const isSel = selParsed && selParsed[0] === y;
            const out = y < dec || y > dec + 9;
            const ok = y >= MIN_YEAR && y <= MAX_YEAR;
            return (
              <button key={y} type="button" disabled={!ok} onClick={() => { setNavYear(y); setCalView("months"); }}
                style={isSel && ok ? accent : undefined}
                className={[
                  "py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  !ok  ? "text-slate-300 cursor-not-allowed" :
                  isSel? "" :
                  out  ? "text-slate-400 hover:bg-slate-100" : "hover:bg-slate-100 text-slate-700",
                ].join(" ")}
              >{y}</button>
            );
          })}
        </div>
      </>
    );
  }

  // ── Icon ──────────────────────────────────────────────────────────────────
  const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const displayVal = toDisplay(value);

  return (
    <div ref={rootRef} className={wrapperClassName || "grid gap-1"}>
      {label && <span className="text-sm text-slate-700">{label}</span>}
      <div className="relative">

        {isEditing ? (
          /* ── Edit mode: segmented typed inputs ── */
          <div className="input-standard flex items-center gap-0.5">
            <input ref={dayRef} type="text" inputMode="numeric" placeholder="DD"
              value={dd} onChange={handleDayChange} onFocus={onPartFocus} onBlur={onPartBlur}
              className="w-8 bg-transparent outline-none text-center placeholder:text-slate-400 text-sm"
              maxLength={2}
            />
            <span className="text-slate-400 text-sm select-none">-</span>
            <input ref={monRef} type="text" inputMode="numeric" placeholder="MM"
              value={mm} onChange={handleMonChange} onFocus={onPartFocus} onBlur={onPartBlur}
              className="w-8 bg-transparent outline-none text-center placeholder:text-slate-400 text-sm"
              maxLength={2}
            />
            <span className="text-slate-400 text-sm select-none">-</span>
            <input ref={yrRef} type="text" inputMode="numeric" placeholder="YYYY"
              value={yyyy} onChange={handleYrChange} onFocus={onPartFocus} onBlur={onPartBlur}
              className="w-12 bg-transparent outline-none text-center placeholder:text-slate-400 text-sm"
              maxLength={4}
            />
            <button type="button" tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); clearTimeout(blurTmr.current); setShowCal(s => !s); if (!showCal) setCalView("days"); }}
              className="ml-auto pl-2 text-slate-400 hover:text-slate-600 flex-shrink-0"
            ><CalIcon /></button>
          </div>
        ) : (
          /* ── Display mode: formatted DD-MMM-YYYY ── */
          <div
            className="input-standard flex items-center cursor-pointer"
            onClick={() => {
              setIsEditing(true);
              setTimeout(() => { dayRef.current?.focus(); dayRef.current?.select(); }, 10);
            }}
          >
            <span className={`text-sm flex-1 select-none ${displayVal ? "text-slate-800" : "text-slate-400"}`}>
              {displayVal || "DD-MMM-YYYY"}
            </span>
            <button type="button" tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowCal(true); setCalView("days"); setTimeout(() => dayRef.current?.focus(), 10); }}
              className="text-slate-400 hover:text-slate-600"
            ><CalIcon /></button>
          </div>
        )}

        {/* Calendar dropdown */}
        {showCal && (
          <div
            onMouseDown={onCalMouseDown}
            className="absolute left-0 mt-1.5 bg-white rounded-2xl border border-slate-100 z-50 p-4"
            style={{ minWidth: 300, top: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)" }}
          >
            {calView === "days"   && renderDays()}
            {calView === "months" && renderMonths()}
            {calView === "years"  && renderYears()}
          </div>
        )}
      </div>
    </div>
  );
}
