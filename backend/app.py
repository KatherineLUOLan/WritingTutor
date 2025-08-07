from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os
import time

# 加载环境变量
load_dotenv()

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# API配置
API_URL = os.getenv('API_URL')
API_KEY = os.getenv('API_KEY')

# 配置重试策略
retry_strategy = Retry(
    total=3,  # 最大重试次数
    backoff_factor=1,  # 重试间隔
    status_forcelist=[429, 500, 502, 503, 504]  # 需要重试的HTTP状态码
)
adapter = HTTPAdapter(max_retries=retry_strategy)
http = requests.Session()
http.mount("https://", adapter)
http.mount("http://", adapter)

@app.route('/api/convert', methods=['POST'])
def convert_text():
    try:
        data = request.json
        text = data.get('text')
        steps = data.get('steps')

        if text == 'steps_reordered' and steps:
            # 处理步骤重排序的情况
            steps_text = "\n".join([f"{step['position']}. {step['name']}: {step['description']}" 
                                  for step in steps])
            
            response = http.post(
                API_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": API_KEY
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are helping to analyze the structure of a 3MT presentation."
                        },
                        {
                            "role": "user",
                            "content": f"The steps have been reordered to:\n\n{steps_text}\n\nPlease provide feedback on this structure."
                        }
                    ]
                },
                timeout=30
            )
        else:
            # 处理普通对话
            if not text:
                return jsonify({"error": "No text provided"}), 400

            print("Received text:", text)  # 打印接收到的文本

            response = http.post(
                API_URL,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": API_KEY
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {
                            "role": "system",
                            "content": """You are acting as a general audience member who is not familiar with the topic. 
                            Your role is to:
                            1. Ask clarifying questions if something is unclear
                            2. Point out parts that are hard to understand
                            3. Suggest where more explanation might be needed
                            4. Help make the explanation more accessible to a general audience
                            
                            Keep your responses conversational and focused on understanding the topic better."""
                        },
                        {
                            "role": "user",
                            "content": f"Here's the topic I'm explaining:\n\n{text}\n\nAs someone unfamiliar with this topic, what questions or suggestions do you have?"
                        }
                    ]
                },
                timeout=30
            )
        
        response.raise_for_status()
        return jsonify(response.json())

    except requests.exceptions.RequestException as e:
        error_message = f"API request failed: {str(e)}"
        print("Request Exception:", error_message)  # 打印请求异常
        return jsonify({"error": error_message}), 500
    except Exception as e:
        error_message = f"Error: {str(e)}"
        print(error_message)
        return jsonify({"error": error_message}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 