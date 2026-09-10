import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, PhoneCall, Clock, Check } from 'lucide-react';

interface CallTimerWidgetProps {
  onLogCompletedCall: (durationMinutes: number) => void;
  scammerName: string;
}

export const CallTimerWidget: React.FC<CallTimerWidgetProps> = ({ onLogCompletedCall, scammerName }) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const handleStart = () => setIsActive(true);
  const handlePause = () => setIsActive(false);
  const handleReset = () => {
    setIsActive(false);
    setSeconds(0);
  };

  const handleSave = () => {
    setIsActive(false);
    // Convert to whole minutes (at least 1 min if > 0 seconds)
    const minutes = Math.max(1, Math.round(seconds / 60));
    onLogCompletedCall(minutes);
    setSeconds(0);
  };

  const formatStopwatch = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${isActive ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
          <PhoneCall className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <span>Live Call Timer</span>
            {isActive && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.2 rounded-full border border-emerald-500/30">Active Bait</span>}
          </div>
          <p className="text-[11px] text-slate-400">Target: {scammerName}</p>
        </div>
      </div>

      {/* Stopwatch Counter */}
      <div className="flex items-center gap-3">
        <div className="font-mono text-xl font-extrabold text-slate-100 tracking-wider bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          {formatStopwatch(seconds)}
        </div>

        <div className="flex items-center gap-1.5">
          {!isActive ? (
            <button
              type="button"
              onClick={handleStart}
              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow text-xs font-semibold flex items-center gap-1.5"
              title="Start Call Stopwatch"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="p-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition shadow text-xs font-semibold flex items-center gap-1.5"
              title="Pause Call Timer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          {seconds > 0 && (
            <>
              <button
                type="button"
                onClick={handleSave}
                className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition shadow text-xs font-semibold flex items-center gap-1.5"
                title="Save time to call logs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to Log ({Math.max(1, Math.round(seconds / 60))}m)</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs"
                title="Reset stopwatch"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
