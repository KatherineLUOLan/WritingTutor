import { useRef, useState } from 'react';
import '../App.css';

export default function AudioPlayer({ file }: { file: File }) {
    const [duration, setDuration] = useState('00:00');
    const [currentTime, setCurrentTime] = useState('00:00');
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) setDuration(formatTime(audioRef.current.duration));
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(formatTime(audioRef.current.currentTime));
    };

    const togglePlay = () => {
        const el = audioRef.current;
        if (!el) return;
        if (isPlaying) el.pause();
        else el.play();
        setIsPlaying(p => !p);
    };

    const handleDownload = () => {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const pct =
        audioRef.current && audioRef.current.duration
            ? (audioRef.current.currentTime / audioRef.current.duration) * 100
            : 0;

    return (
        <div className="audio-player">
            <div className="audio-progress">
                <div className="time-info">
                    <span className="current-time">{currentTime}</span>
                    <span className="duration">{duration}</span>
                </div>
                <div className="progress-bar-container">
                    <input
                        type="range"
                        className="progress-bar"
                        value={pct}
                        onChange={(e) => {
                            const el = audioRef.current;
                            if (!el) return;
                            const next = (Number(e.currentTarget.value) / 100) * el.duration;
                            el.currentTime = next;
                        }}
                    />
                    <div className="audio-controls">
                        <button
                            className={`control-btn ${isPlaying ? 'pause' : 'play'}`}
                            onClick={togglePlay}
                            title={isPlaying ? '暂停' : '播放'}
                        >
                            {isPlaying ? '⏸' : '▶'}
                        </button>
                        <button className="control-btn download" onClick={handleDownload} title="下载">
                            ⬇
                        </button>
                    </div>
                </div>
            </div>
            <audio
                ref={audioRef}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
            >
                <source src={URL.createObjectURL(file)} type={file.type} />
                Your browser does not support the audio element.
            </audio>
        </div>
    );
}
