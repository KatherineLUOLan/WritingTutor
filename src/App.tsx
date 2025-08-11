import { useState, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './App.css';

const API_BASE = 'http://10.30.9.1';

/** ----------- 类型 ----------- */
type Role = 'user' | 'assistant' | 'error';

interface Step {
    id: number;
    name: string;
    description: string;
}

interface FirstStepContent {
    type: 'FirstStep';
    text: string;
    steps: Step[];
}
interface SecondStepDropzone {
    type: 'SecondStep';
    dropzone: true;
    text: string;
}
interface SecondStepFile {
    type: 'SecondStep';
    dropzone?: false;
    fileType: 'audio' | 'video';
    fileName: string;
    file: File;
}
interface SuggestionContent {
    type: 'suggestion';
    title: string;
    text: string;
}

type MessageContent =
    | string
    | FirstStepContent
    | SecondStepDropzone
    | SecondStepFile
    | SuggestionContent;

interface ChatMessage {
    role: Role;
    content: MessageContent;
}

/** ----------- 组件 ----------- */
function AudioPlayer({ file }: { file: File }) {
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

/** ----------- 页面 ----------- */
export default function App() {
    const [text, setText] = useState<string>('');
    const [chatInput, setChatInput] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [steps, setSteps] = useState<Step[]>([
        { id: 1, name: 'Hook', description: '吸引听众注意力的开场白' },
        { id: 2, name: 'Exploration', description: '探索和解释研究内容' },
        { id: 3, name: 'Resolution', description: '总结研究的影响和意义' }
    ]);
    const [draggedStep, setDraggedStep] = useState<Step | null>(null);
    const [isExecuted, setIsExecuted] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [hasGivenSuggestions, setHasGivenSuggestions] = useState<boolean>(false);

    const handleStepReorder = (message: string) => {
        const numbers = message.match(/\d+/g);
        if (numbers && numbers.length === 3) {
            const newOrder = numbers.map(num => parseInt(num, 10) - 1);
            const newSteps = newOrder.map(index => steps[index]);
            setSteps(newSteps);
            return `步骤已调整为：\n\n1. ${newSteps[0].name}: ${newSteps[0].description}\n2. ${newSteps[1].name}: ${newSteps[1].description}\n3. ${newSteps[2].name}: ${newSteps[2].description}`;
        }
        return '请按照格式输入要调整的步骤顺序，例如："1 3 2" 表示将第二步和第三步互换位置。';
    };

    const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        setChatHistory(prev => [...prev, { role: 'user', content: chatInput }]);
        const userInput = chatInput;
        setChatInput('');

        // 只在第一次输入后给出建议
        if (!hasGivenSuggestions) {
            setIsLoading(true);
            try {
                const resp = await fetch(`${API_BASE}/api/convert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `请根据以下research内容，分别用如下格式严格给出三类建议，每条建议一行：\nStorytelling: （一句建议）\nMetaphor: （一句建议）\nAnalogy: （一句建议）\n内容：${userInput}\n请严格按照上述格式输出。`
                    })
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                const content: string = data.choices?.[0]?.message?.content || '';

                const story = content.match(/Storytelling[:：](.*)/i)?.[1]?.trim();
                const metaphor = content.match(/Metaphor[:：](.*)/i)?.[1]?.trim();
                const analogy = content.match(/Analogy[:：](.*)/i)?.[1]?.trim();

                let hasAny = false;
                if (story) {
                    setChatHistory(prev => [...prev, { role: 'assistant', content: { type: 'suggestion', title: 'Storytelling 建议', text: story } }]);
                    hasAny = true;
                }
                if (metaphor) {
                    setChatHistory(prev => [...prev, { role: 'assistant', content: { type: 'suggestion', title: 'Metaphor 隐喻建议', text: metaphor } }]);
                    hasAny = true;
                }
                if (analogy) {
                    setChatHistory(prev => [...prev, { role: 'assistant', content: { type: 'suggestion', title: 'Analogy 类比建议', text: analogy } }]);
                    hasAny = true;
                }
                if (!hasAny) {
                    setChatHistory(prev => [...prev, { role: 'assistant', content }]);
                }
                setHasGivenSuggestions(true);
            } catch (err: any) {
                setChatHistory(prev => [...prev, { role: 'error', content: `Error: ${err.message}` }]);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // 处理步骤调整的请求
        if (userInput.toLowerCase().includes('调整步骤')) {
            setChatHistory(prev => [...prev, { role: 'assistant', content: '请输入想要的步骤顺序（例如：1 3 2）：' }]);
            return;
        }

        // 检查是否是步骤顺序输入
        if (/^\d+\s+\d+\s+\d+$/.test(userInput)) {
            const response = handleStepReorder(userInput);
            setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
            return;
        }

        // 处理其他对话
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/api/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: userInput })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            const content: string = data.choices?.[0]?.message?.content ?? '(no content)';
            setChatHistory(prev => [...prev, { role: 'assistant', content }]);
        } catch (err: any) {
            setChatHistory(prev => [...prev, { role: 'error', content: `Error: ${err.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const modules: any = {
        toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ font: [] }],
            [{ size: ['small', false, 'large', 'huge'] }],
            [{ align: [] }],
            ['clean']
        ],
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, step: Step) => {
        setDraggedStep(step);
        e.currentTarget.classList.add('dragging');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('dragging');
        notifyLLMOfStepChange(steps);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, _index: number) => {
        e.preventDefault();
        const stepBoxes = Array.from(document.querySelectorAll<HTMLDivElement>('.step-content-box'));
        const afterElement = stepBoxes.reduce<{ offset: number; element?: HTMLDivElement }>((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (afterElement && draggedStep) {
            const newSteps = [...steps];
            const oldIndex = steps.findIndex(s => s.id === draggedStep.id);
            const newIndex = steps.findIndex(s => s.id === Number(afterElement.dataset.stepId));
            newSteps.splice(oldIndex, 1);
            newSteps.splice(newIndex, 0, draggedStep);
            setSteps(newSteps);
        }
    };

    const notifyLLMOfStepChange = async (newSteps: Step[]) => {
        setIsLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/api/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'steps_reordered',
                    steps: newSteps.map((s, i) => ({
                        position: i + 1,
                        name: s.name,
                        description: s.description
                    }))
                })
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            const content: string | undefined = data.choices?.[0]?.message?.content;
            if (content) {
                setChatHistory(prev => [...prev, { role: 'assistant', content }]);
            }
        } catch (err: any) {
            setChatHistory(prev => [...prev, { role: 'error', content: `Error updating step order: ${err.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModifySteps = () => {
        setChatHistory(prev => [...prev, { role: 'assistant', content: '请拖拽调整步骤顺序。' }]);
    };

    const handleExecute = () => {
        setIsExecuted(true);
        setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: { type: 'SecondStep', dropzone: true, text: '请将音频或视频文件拖拽到这里' }
        }]);
    };

    const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const media = files.filter(f => f.type.startsWith('audio/') || f.type.startsWith('video/'));
        media.forEach(file => {
            setChatHistory(prev => [...prev, {
                role: 'assistant',
                content: {
                    type: 'SecondStep',
                    fileType: file.type.startsWith('audio/') ? 'audio' : 'video',
                    fileName: file.name,
                    file
                } as SecondStepFile
            }]);
        });
    };

    const renderMessage = (msg: ChatMessage) => {
        if (typeof msg.content === 'object') {
            const c: any = msg.content;
            if (c.type === 'FirstStep') {
                return (
                    <div className="first-step">
                        <div className="message-text">{c.text}</div>
                        <div className="steps-container">
                            {c.steps.map((step: Step, index: number) => (
                                <div className="step-box" key={step.id}>
                                    <div className="step-number">Step {index + 1}</div>
                                    <div
                                        className="step-content-box"
                                        draggable
                                        data-step-id={step.id}
                                        onDragStart={(e) => handleDragStart(e, step)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                    >
                                        <div className="step-name">{step.name}</div>
                                        <div className="step-description">{step.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="action-buttons">
                            <button className="action-btn modify" onClick={handleModifySteps}>修改</button>
                            {!isExecuted ? (
                                <button className="action-btn execute" onClick={handleExecute}>执行</button>
                            ) : (
                                <button className="action-btn next" onClick={handleExecute}>下一步</button>
                            )}
                        </div>
                    </div>
                );
            } else if (c.type === 'SecondStep') {
                if (c.dropzone) {
                    return (
                        <div className="second-step">
                            <div className="dropzone"><p>{c.text}</p></div>
                        </div>
                    );
                }
                return (
                    <div className="second-step">
                        {c.fileType === 'audio' ? (
                            <AudioPlayer file={c.file} />
                        ) : (
                            <div className="video-player">
                                <video controls>
                                    <source src={URL.createObjectURL(c.file)} type={c.file.type} />
                                    Your browser does not support the video element.
                                </video>
                            </div>
                        )}
                    </div>
                );
            } else if (c.type === 'suggestion') {
                return (
                    <div className="suggestion-block">
                        <div className="suggestion-title">{c.title}</div>
                        <div className="suggestion-text">{c.text}</div>
                    </div>
                );
            }
            return JSON.stringify(msg.content);
        }
        return msg.content;
    };

    return (
        <div className="App">
            <div className="container">
                <div className="editor-section">
                    <ReactQuill
                        theme="snow"
                        value={text}
                        onChange={setText}
                        modules={modules}
                        className="rich-text-editor"
                        placeholder="Enter your text here..."
                    />
                </div>

                <div
                    className={`chat-section ${isDragging ? 'dragging' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { setIsDragging(false); handleFileDrop(e); }}
                >
                    <div className="chat-history">
                        {chatHistory.map((msg, index) => (
                            <div key={index} className={`chat-message ${msg.role}`}>
                                <div className="message-content">{renderMessage(msg)}</div>
                            </div>
                        ))}
                        {isLoading && <div className="loading">GPT is thinking...</div>}
                    </div>
                    <form onSubmit={handleChatSubmit} className="chat-input-form">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask questions..."
                            className="chat-input"
                        />
                        <button type="submit" className="chat-submit">Send</button>
                    </form>
                </div>
            </div>
        </div>
    );
}
