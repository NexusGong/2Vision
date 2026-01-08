"""
最简单的视频生成测试函数
确保能成功获取视频URL
"""
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

# 从环境变量获取配置
API_KEY = os.getenv("ARK_API_KEY")
BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
MODEL = os.getenv("VIDEO_MODEL_NAME", "doubao-seedance-1-5-pro-251215")

def test_video_generation():
    """最简单的视频生成测试"""
    print("=" * 50)
    print("开始视频生成测试")
    print("=" * 50)
    
    # 1. 创建视频生成任务
    print("\n1. 创建视频生成任务...")
    create_url = f"{BASE_URL}/contents/generations/tasks"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # 最简单的prompt，不包含duration参数（因为doubao-seedance-1-5-pro不支持）
    prompt = "一只可爱的小猫在花园里玩耍"
    
    request_body = {
        "model": MODEL,
        "content": [{
            "text": f"{prompt} --ratio 16:9",
            "type": "text"
        }]
    }
    
    print(f"请求URL: {create_url}")
    print(f"模型: {MODEL}")
    print(f"Prompt: {prompt}")
    
    response = requests.post(create_url, json=request_body, headers=headers, timeout=30)
    print(f"响应状态码: {response.status_code}")
    
    if not response.ok:
        print(f"创建任务失败: {response.text}")
        return
    
    response_data = response.json()
    print(f"响应数据: {response_data}")
    
    # 提取任务ID
    task_id = response_data.get("id")
    if not task_id:
        print("错误：无法从响应中获取任务ID")
        return
    
    print(f"\n✓ 任务创建成功，任务ID: {task_id}")
    
    # 2. 轮询查询任务状态
    print("\n2. 开始轮询任务状态...")
    query_url = f"{BASE_URL}/contents/generations/tasks/{task_id}"
    
    max_wait = 600  # 10分钟
    poll_interval = 5  # 5秒
    start_time = time.time()
    poll_count = 0
    
    while time.time() - start_time < max_wait:
        poll_count += 1
        print(f"\n第 {poll_count} 次查询...")
        
        response = requests.get(query_url, headers=headers, timeout=30)
        if not response.ok:
            print(f"查询失败: {response.status_code} - {response.text}")
            time.sleep(poll_interval)
            continue
        
        response_data = response.json()
        status = response_data.get("status")
        print(f"任务状态: {status}")
        
        # 检查是否完成
        if status == "succeeded":
            print("\n✓ 任务完成！")
            
            # 提取视频URL - 根据文档，在 content.video_url
            content = response_data.get("content")
            video_url = None
            
            if content:
                # content可能是对象或字典
                if isinstance(content, dict):
                    video_url = content.get("video_url")
                elif hasattr(content, 'video_url'):
                    video_url = content.video_url
                else:
                    # 尝试从content中提取
                    print(f"Content类型: {type(content)}")
                    print(f"Content内容: {content}")
            
            if video_url:
                print(f"\n✓✓✓ 成功获取视频URL: {video_url}")
                print(f"\n完整响应数据:")
                import json
                print(json.dumps(response_data, indent=2, ensure_ascii=False))
                return video_url
            else:
                print(f"\n✗ 未找到视频URL")
                print(f"完整响应: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
                return None
                
        elif status == "failed":
            error = response_data.get("error")
            print(f"\n✗ 任务失败: {error}")
            return None
        
        # 继续等待
        time.sleep(poll_interval)
    
    print(f"\n✗ 超时：等待超过 {max_wait} 秒")
    return None


if __name__ == "__main__":
    try:
        video_url = test_video_generation()
        if video_url:
            print("\n" + "=" * 50)
            print("测试成功！视频URL已获取")
            print("=" * 50)
        else:
            print("\n" + "=" * 50)
            print("测试失败：未能获取视频URL")
            print("=" * 50)
    except Exception as e:
        print(f"\n测试异常: {str(e)}")
        import traceback
        traceback.print_exc()
