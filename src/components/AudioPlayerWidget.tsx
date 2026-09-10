import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Disc } from 'lucide-react';

interface AudioPlayerWidgetProps {
  audioUrl: string;
  audioName?: string | null;
}

export const AudioPlayerWidget: React.FC<AudioPlayerWidgetProps> = ({ audioUrl, audioName }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => console.warn('Audio playback notice:', err));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium truncate max-w-[220px]">
          <Disc className={`w-4 h-4 text-rose-400 shrink-0 ${isPlaying ? 'animate-spin' : ''}`} />
          <span className="truncate">{audioName || 'Call Recording Audio'}</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          {formatTime(currentTime)} / {formatTime(duration || 180)}
        </div>
      </div>

      {/* Progress & Waveform bars simulation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition shrink-0 shadow"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col justify-center">
          <input
            type="range"
            min={0}
            max={duration || 180}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          {/* Animated Waveform Visualizer */}
          <div className="flex items-center gap-0.5 mt-1.5 h-3 overflow-hidden">
            {[4, 8, 12, 6, 14, 10, 16, 7, 11, 15, 9, 13, 5, 8, 12, 16, 6, 10, 14, 8, 4, 12, 7, 15].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-300 ${
                  isPlaying ? 'bg-rose-500/70' : 'bg-slate-700/50'
                }`}
                style={{
                  height: isPlaying ? `${Math.max(3, (h * (i % 3 + 1)) % 14)}px` : `${h / 2}px`,
                }}
              ></div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <a
            href={audioUrl}
            download={audioName || 'recording.wav'}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Download Audio"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
