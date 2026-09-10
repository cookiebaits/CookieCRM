import React, { useState } from 'react';
import {
  Phone,
  Clock,
  Radio,
  AlertTriangle,
  ShieldAlert,
  Mic,
  DollarSign,
  ChevronRight,
  MoreVertical,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { Scammer, PipelineStatus } from '../types.ts';

interface PipelineBoardProps {
  scammers: Scammer[];
  onSelectScammer: (scammer: Scammer) => void;
  onMovePipeline: (scammerId: string, newStatus: PipelineStatus) => void;
  onQuickAdd: () => void;
}

const PIPELINE_COLUMNS: {
  status: PipelineStatus;
  title: string;
  badgeColor: string;
  borderColor: string;
  description: string;
}[] = [
  {
    status: 'New Scammer',
    title: 'New Scammer',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    borderColor: 'border-amber-500/20',
    description: 'Fresh incoming numbers & unverified bait targets',
  },
  {
    status: 'Actively baiting',
    title: 'Actively baiting',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    borderColor: 'border-emerald-500/30',
    description: 'Live active calls & ongoing honeypot sessions',
  },
  {
    status: 'Payment Pending',
    title: 'Payment Pending',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    borderColor: 'border-purple-500/30',
    description: 'Stalling at bank, ATM, gift card, or wire phase',
  },
  {
    status: 'Revealed / Reported',
    title: 'Revealed / Reported',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    borderColor: 'border-rose-500/30',
    description: 'Bait concluded, reported to IC3/FTC/banks',
  },
];

export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  scammers,
  onSelectScammer,
  onMovePipeline,
  onQuickAdd,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PipelineStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: PipelineStatus) => {
    e.preventDefault();
    if (dragOverCol !== colStatus) {
      setDragOverCol(colStatus);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: PipelineStatus) => {
    e.preventDefault();
    const scammerId = e.dataTransfer.getData('text/plain') || draggedId;
    if (scammerId) {
      onMovePipeline(scammerId, targetStatus);
    }
    setDraggedId(null);
    setDragOverCol(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {PIPELINE_COLUMNS.map((col) => {
        const columnScammers = scammers.filter((s) => s.status === col.status);
        const totalMinutesInCol = columnScammers.reduce((sum, s) => sum + s.totalTimeSpent, 0);
        const isDragTarget = dragOverCol === col.status;

        return (
          <div
            key={col.status}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
            className={`bg-slate-900/70 border rounded-2xl p-3.5 flex flex-col min-h-[540px] transition duration-200 ${
              isDragTarget
                ? 'border-rose-500 bg-slate-850 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30'
                : col.borderColor
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${col.badgeColor}`}
                >
                  {col.title}
                </span>
                <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                  {columnScammers.length}
                </span>
              </div>

              {col.status === 'New Scammer' && (
                <button
                  type="button"
                  id="col-quick-add-btn"
                  onClick={onQuickAdd}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition"
                  title="Add new scammer to pipeline"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Column Description / Meta */}
            <div className="text-[11px] text-slate-400 mb-3 flex items-center justify-between px-0.5">
              <span className="truncate">{col.description}</span>
              <span className="shrink-0 font-mono text-slate-400 font-medium">
                {(totalMinutesInCol / 60).toFixed(1)}h total
              </span>
            </div>

            {/* Scammer Cards in Column */}
            <div className="space-y-3 flex-1">
              {columnScammers.length === 0 ? (
                <div className="h-36 border border-dashed border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-xs text-slate-500 p-4 text-center select-none">
                  <span>Drop scammers here</span>
                  <span className="text-[10px] text-slate-600 mt-1">or move from card menu</span>
                </div>
              ) : (
                columnScammers.map((scammer) => {
                  const hasAudio = scammer.calls.some((c) => c.audioRecordingUrl);
                  const todayTime = scammer.todayTimeSpent || 0;

                  return (
                    <div
                      key={scammer.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, scammer.id)}
                      onClick={() => onSelectScammer(scammer)}
                      className="bg-slate-950/90 border border-slate-800/90 hover:border-slate-700 rounded-xl p-3.5 cursor-grab active:cursor-grabbing hover:shadow-xl hover:shadow-black/40 transition duration-150 relative group select-none space-y-2.5"
                    >
                      {/* Top Row: Name, Alias & Flag Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="font-bold text-sm text-slate-100 truncate group-hover:text-rose-400 transition">
                            {scammer.fullName}
                          </h4>
                          {scammer.alias && (
                            <p className="text-xs text-amber-400 font-mono truncate">
                              &quot;{scammer.alias}&quot;
                            </p>
                          )}
                        </div>

                        {scammer.flagged && (
                          <span
                            className="shrink-0 text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-1"
                            title="Flagged Fraudulent Account"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Flagged
                          </span>
                        )}
                      </div>

                      {/* Phone & Carrier */}
                      <div className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{scammer.phoneNumber}</span>
                      </div>

                      {scammer.carrier && (
                        <div className="text-[11px] text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800/80 truncate flex items-center gap-1">
                          <Radio className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate">{scammer.carrier}</span>
                        </div>
                      )}

                      {/* Dynamic Efficiency Metric: Today's Time + Total Time */}
                      <div className="pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span
                            className={`font-semibold ${
                              todayTime > 0 ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            Today: {todayTime}m
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 font-mono">
                          Tot: {scammer.totalTimeSpent}m
                        </span>
                      </div>

                      {/* Bottom Footer Indicators */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <div className="flex items-center gap-2">
                          {hasAudio && (
                            <span
                              className="text-rose-400 flex items-center gap-0.5"
                              title="Audio recording attached"
                            >
                              <Mic className="w-3 h-3" />
                            </span>
                          )}

                          {scammer.fraudAccounts.length > 0 && (
                            <span
                              className="text-amber-400 flex items-center gap-0.5"
                              title={`${scammer.fraudAccounts.length} fraud accounts flagged`}
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>{scammer.fraudAccounts.length}</span>
                            </span>
                          )}

                          {scammer.calls.length > 0 && (
                            <span className="text-slate-400">
                              {scammer.calls.length} {scammer.calls.length === 1 ? 'call' : 'calls'}
                            </span>
                          )}
                        </div>

                        {/* Quick Move Dropdown */}
                        <div
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={scammer.status}
                            onChange={(e) =>
                              onMovePipeline(scammer.id, e.target.value as PipelineStatus)
                            }
                            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white cursor-pointer focus:outline-none"
                          >
                            <option value="New Scammer">Move: New</option>
                            <option value="Actively baiting">Move: Baiting</option>
                            <option value="Payment Pending">Move: Payment</option>
                            <option value="Revealed / Reported">Move: Revealed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
