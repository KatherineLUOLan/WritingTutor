import { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';  // 引入样式
import './App.css';

function App() {
  const [text, setText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState([
    { id: 1, name: 'Hook', description: '吸引听众注意力的开场白' },
    { id: 2, name: 'Exploration', description: '探索和解释研究内容' },
    { id: 3, name: 'Resolution', description: '总结研究的影响和意义' }
  ]);
  const [draggedStep, setDraggedStep] = useState(null);
  const [isExecuted, setIsExecuted] = useState(false);
  const [audioFiles, setAudioFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [hasGivenSuggestions, setHasGivenSuggestions] = useState(false);

  const handleStepReorder = (message) => {
    const numbers = message.match(/\d+/g);
    if (numbers && numbers.length === 3) {
      const newOrder = numbers.map(num => parseInt(num) - 1);
      const newSteps = newOrder.map(index => steps[index]);
      setSteps(newSteps);
      return `步骤已调整为：\n\n1. ${newSteps[0].name}: ${newSteps[0].description}\n2. ${newSteps[1].name}: ${newSteps[1].description}\n3. ${newSteps[2].name}: ${newSteps[2].description}`;
    }
    return '请按照格式输入要调整的步骤顺序，例如："1 3 2" 表示将第二步和第三步互换位置。';
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    setChatHistory(prev => [...prev, { role: 'user', content: chatInput }]);
    const userInput = chatInput;
    setChatInput('');

    // 只在第一次输入后给出建议
    if (!hasGivenSuggestions) {
      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:5000/api/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `请根据以下research内容，分别用如下格式严格给出三类建议，每条建议一行：\nStorytelling: （一句建议）\nMetaphor: （一句建议）\nAnalogy: （一句建议）\n内容：${userInput}\n请严格按照上述格式输出。`
          })
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        const content = data.choices?.[0]?.message?.content || '';
        console.log('LLM返回内容:', content);
        // 尝试提取三类建议
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
          // 如果三类都没提取到，直接显示原始内容
          setChatHistory(prev => [...prev, { role: 'assistant', content }]);
        }
        setHasGivenSuggestions(true);
      } catch (error) {
        setChatHistory(prev => [...prev, { role: 'error', content: `Error: ${error.message}` }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 处理步骤调整的请求
    if (userInput.toLowerCase().includes('调整步骤')) {
      const response = '请输入想要的步骤顺序（例如：1 3 2）：';
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
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
      const response = await fetch('http://localhost:5000/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: userInput })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: data.choices[0].message.content 
      }]);
    } catch (error) {
      console.error('Error details:', error);
      setChatHistory(prev => [...prev, { 
        role: 'error', 
        content: `Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],  // 标题大小
      ['bold', 'italic', 'underline', 'strike'],  // 加粗、斜体、下划线、删除线
      [{ 'color': [] }, { 'background': [] }],  // 文字颜色、背景颜色
      [{ 'font': [] }],  // 字体
      [{ 'size': ['small', false, 'large', 'huge'] }],  // 字号
      [{ 'align': [] }],  // 对齐方式
      ['clean']  // 清除格式
    ],
  };

  const handleDragStart = (e, step) => {
    setDraggedStep(step);
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    // 在拖拽结束时通知 LLM
    notifyLLMOfStepChange(steps);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    const dragBox = document.querySelector('.dragging');
    const stepBoxes = [...document.querySelectorAll('.step-content-box')];
    const afterElement = stepBoxes.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = e.clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;

    if (afterElement) {
      const newSteps = [...steps];
      const oldIndex = steps.findIndex(s => s.id === draggedStep.id);
      const newIndex = steps.findIndex(s => s.id === parseInt(afterElement.dataset.stepId));
      newSteps.splice(oldIndex, 1);
      newSteps.splice(newIndex, 0, draggedStep);
      setSteps(newSteps);
    }
  };

  const notifyLLMOfStepChange = async (newSteps) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: 'steps_reordered',
          steps: newSteps.map((step, index) => ({
            position: index + 1,
            name: step.name,
            description: step.description
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // 添加 LLM 的反馈到对话历史
      if (data.choices && data.choices[0].message) {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: data.choices[0].message.content 
        }]);
      }
    } catch (error) {
      console.error('Error notifying LLM:', error);
      setChatHistory(prev => [...prev, { 
        role: 'error', 
        content: `Error updating step order: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifySteps = () => {
    setChatHistory(prev => [...prev, {
      role: 'assistant',
      content: '请拖拽调整步骤顺序。'
    }]);
  };

  const handleExecute = () => {
    setIsExecuted(true);
    
    // 添加拖拽提示消息
    setChatHistory(prev => [...prev, {
      role: 'assistant',
      content: {
        type: 'SecondStep',
        dropzone: true,
        text: '请将音频或视频文件拖拽到这里'
      }
    }]);
  };

  const handleNext = () => {
    setChatHistory(prev => [...prev, {
      role: 'assistant',
      content: '接下来，请在左侧编辑框输入你的演讲内容。'
    }]);
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || file.type.startsWith('video/')
    );
    
    setAudioFiles(prev => [...prev, ...audioFiles]);
    
    // 为每个文件添加消息
    audioFiles.forEach(file => {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: {
          type: 'SecondStep',
          fileType: file.type.startsWith('audio/') ? 'audio' : 'video',
          fileName: file.name,
          file: file
        }
      }]);
    });
  };

  const AudioPlayer = ({ file }) => {
    const [duration, setDuration] = useState('00:00');
    const [currentTime, setCurrentTime] = useState('00:00');
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);

    const formatTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleLoadedMetadata = () => {
      setDuration(formatTime(audioRef.current.duration));
    };

    const handleTimeUpdate = () => {
      setCurrentTime(formatTime(audioRef.current.currentTime));
    };

    const togglePlay = () => {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    };

    const handleDownload = () => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

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
              value={audioRef.current ? (audioRef.current.currentTime / audioRef.current.duration) * 100 : 0}
              onChange={(e) => {
                const time = (e.target.value / 100) * audioRef.current.duration;
                audioRef.current.currentTime = time;
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
              <button 
                className="control-btn download" 
                onClick={handleDownload}
                title="下载"
              >
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
  };

  const renderStepBox = (step, index) => (
    <div className="step-box" key={step.id}>
      <div className="step-number">Step {index + 1}</div>
      <div 
        className="step-content-box"
        draggable="true"
        data-step-id={step.id}
        onDragStart={(e) => handleDragStart(e, step)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, index)}
      >
        <div className="step-name">{step.name}</div>
        <div className="step-description">{step.description}</div>
      </div>
    </div>
  );

  const renderMessage = (msg) => {
    if (typeof msg.content === 'object') {
      if (msg.content.type === 'FirstStep') {
        return (
          <div className="first-step">
            <div className="message-text">{msg.content.text}</div>
            <div className="steps-container">
              {msg.content.steps.map((step, index) => renderStepBox(step, index))}
            </div>
            <div className="action-buttons">
              <button className="action-btn modify" onClick={handleModifySteps}>
                修改
              </button>
              {!isExecuted ? (
                <button className="action-btn execute" onClick={handleExecute}>
                  执行
                </button>
              ) : (
                <button className="action-btn next" onClick={handleExecute}>
                  下一步
                </button>
              )}
            </div>
          </div>
        );
      } else if (msg.content.type === 'SecondStep') {
        // 如果是拖拽提示消息
        if (msg.content.dropzone) {
          return (
            <div className="second-step">
              <div className="dropzone">
                <p>{msg.content.text}</p>
              </div>
            </div>
          );
        }
        // 如果是音频/视频文件
        return (
          <div className="second-step">
            {msg.content.fileType === 'audio' ? (
              <AudioPlayer file={msg.content.file} />
            ) : (
              <div className="video-player">
                <video controls>
                  <source src={URL.createObjectURL(msg.content.file)} type={msg.content.file.type} />
                  Your browser does not support the video element.
                </video>
              </div>
            )}
          </div>
        );
      } else if (msg.content.type === 'suggestion') {
        return (
          <div className="suggestion-block">
            <div className="suggestion-title">{msg.content.title}</div>
            <div className="suggestion-text">{msg.content.text}</div>
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
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            setIsDragging(false);
            handleFileDrop(e);
          }}
        >
          <div className="chat-history">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                <div className="message-content">
                  {renderMessage(msg)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="loading">GPT is thinking...</div>
            )}
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

export default App;

