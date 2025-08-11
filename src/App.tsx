import { useState } from 'react';
import './App.css';
import RichEditor from './components/RichEditor';
import MessageRenderer from './components/MessageRenderer';
import { postConvert } from './lib/api';
import {
    ChatMessage, Step, SecondStepFile
} from './types/chat';

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

        if (!hasGivenSuggestions) {
            setIsLoading(true);
            try {
                const data = await postConvert({
                    text: `请根据以下research内容，分别用如下格式严格给出三类建议，每条建议一行：\nStorytelling: （一句建议）\nMetaphor: （一句建议）\nAnalogy: （一句建议）\n内容：${userInput}\n请严格按照上述格式输出。`
                });

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

        if (userInput.toLowerCase().includes('调整步骤')) {
            setChatHistory(prev => [...prev, { role: 'assistant', content: '请输入想要的步骤顺序（例如：1 3 2）：' }]);
            return;
        }

        if (/^\d+\s+\d+\s+\d+$/.test(userInput)) {
            const response = handleStepReorder(userInput);
            setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
            return;
        }

        setIsLoading(true);
        try {
            const data = await postConvert({ text: userInput });
            const content: string = data.choices?.[0]?.message?.content ?? '(no content)';
            setChatHistory(prev => [...prev, { role: 'assistant', content }]);
        } catch (err: any) {
            setChatHistory(prev => [...prev, { role: 'error', content: `Error: ${err.message}` }]);
        } finally {
            setIsLoading(false);
        }
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
            const data = await postConvert({
                text: 'steps_reordered',
                steps: newSteps.map((s, i) => ({
                    position: i + 1,
                    name: s.name,
                    description: s.description
                }))
            });
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

    return (
        <div className="App">
            <div className="container">
                <div className="editor-section">
                    <RichEditor value={text} onChange={setText} />
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
                                <div className="message-content">
                                    <MessageRenderer
                                        msg={msg}
                                        isExecuted={isExecuted}
                                        onModifySteps={handleModifySteps}
                                        onExecute={handleExecute}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={handleDragOver}
                                    />
                                </div>
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
