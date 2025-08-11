import AudioPlayer from './AudioPlayer';
import { ChatMessage, Step } from '../types/chat';

type Props = {
    msg: ChatMessage;
    isExecuted: boolean;
    onModifySteps: () => void;
    onExecute: () => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, step: Step) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
};

export default function MessageRenderer({
                                            msg,
                                            isExecuted,
                                            onModifySteps,
                                            onExecute,
                                            onDragStart,
                                            onDragEnd,
                                            onDragOver,
                                        }: Props) {
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
                                    onDragStart={(e) => onDragStart(e, step)}
                                    onDragEnd={onDragEnd}
                                    onDragOver={(e) => onDragOver(e, index)}
                                >
                                    <div className="step-name">{step.name}</div>
                                    <div className="step-description">{step.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="action-buttons">
                        <button className="action-btn modify" onClick={onModifySteps}>修改</button>
                        {!isExecuted ? (
                            <button className="action-btn execute" onClick={onExecute}>执行</button>
                        ) : (
                            <button className="action-btn next" onClick={onExecute}>下一步</button>
                        )}
                    </div>
                </div>
            );
        }

        if (c.type === 'SecondStep') {
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
        }

        if (c.type === 'suggestion') {
            return (
                <div className="suggestion-block">
                    <div className="suggestion-title">{c.title}</div>
                    <div className="suggestion-text">{c.text}</div>
                </div>
            );
        }

        return <>{JSON.stringify(msg.content)}</>;
    }
    return <>{msg.content}</>;
}
