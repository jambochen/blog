---
title: 'Isaac Sim 5 與 ROS2 機械臂模擬教學'
description: '在 Isaac Sim 5 導入機械臂並以 ROS2 鍵盤控制。'
pubDate: '2025-07-17'
tags: [isaac-sim, ros2, robotics]
---

本教程將指導您在 Isaac Sim 5 中導入機械臂模型並與 ROS2 整合，實現機械臂的仿真控制。

## 資料來源
本教程基於以下資源製作：

- 影片教程：[B站影片教程](https://www.bilibili.com/video/BV1sZKfzgEAG)
- 開源專案：[TheRobotStudio SO-ARM100 機械臂模型](https://github.com/TheRobotStudio/SO-ARM100)
- 官方文件：[Isaac Sim 5](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/index.html)

## 前提條件

開始前，請確保已安裝以下軟體：

1. **Isaac Sim 5**：參考 [官方安裝指南](https://github.com/isaac-sim/IsaacSim) 安裝
2. **ROS2**：參考 [Isaac Sim ROS2 安裝文件](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/installation/install_ros.html) 配置 ROS2 環境

## 第一步：取得機械臂模型

TheRobotStudio 開源 SO-ARM101 機械臂，提供完整 URDF 文件：

```bash
git clone https://github.com/TheRobotStudio/SO-ARM100.git
```

> **提示**：URDF（統一機器人描述格式）包含機械臂的幾何結構、關節資訊和物理屬性。

## 第二步：啟動 Isaac Sim

開啟終端，導航至 Isaac Sim 安裝目錄並啟動：

```bash
cd <Isaac Sim 路徑>
./isaac-sim.sh
```

> **注意**：請將 `<Isaac Sim 路徑>` 替換為實際安裝路徑。

## 第三步：導入機械臂模型

1. 在 Isaac Sim 介面點擊 `File` -> `Import`
2. 在文件選擇對話框中，導航至 `<SO-ARM100 路徑>/Simulation/SO101/so101_new_calib.urdf`
3. 選擇 URDF 文件並點擊導入

導入成功後，應可在 Isaac Sim 的 3D 視窗中看到完整機械臂模型。

## 第四步：添加仿真環境

為進行仿真，需為機械臂添加地面：

1. 點擊 `Create` -> `Physics` -> `Ground Plane`
2. 將在場景中添加物理地面

## 第五步：配置 ROS2 介面

為機械臂添加 ROS2 通信介面，實現外部控制。

### 5.1 建立 Joint States 節點

1. 點擊 `Tools` -> `Robotics` -> `ROS 2 OmniGraphs` -> `Joint States`

### 5.2 配置 Articulation Root

在對話框中：

1. 點擊 `Articulation Root` 輸入框右側選擇按鈕
2. 在場景樹中選擇 `so101_new_calib` 下的 `root_joint`

> `Articulation Root` 是機械臂的根關節，定義基礎座標系與物理屬性。

### 5.3 啟用發布與訂閱

1. 勾選 `Publisher`（發布關節狀態至 ROS2）
2. 勾選 `Subscriber`（接收 ROS2 控制命令）
3. 點擊 `OK` 確認

## 第六步：完善控制圖

### 6.1 開啟 Action Graph

1. 在 `Stage` 視窗找到 `ROS_JointStates` 節點
2. 右鍵點擊，選擇 `Open Graph`
3. 檢查是否有 `Articulation Controller` 節點。若已自動建立，跳至第七步；若無，依以下步驟手動建立。

### 6.2 添加 Articulation Controller

在 `Action Graph` 視窗中：

1. 在 `Nodes` 面板搜索 `Articulation Controller`
2. 將節點拖曳至畫布

> `Articulation Controller` 是控制機械臂關節運動的核心組件。

### 6.3 建立節點連線

將 `ROS2 Subscribe Joint State` 的以下輸出埠連接到 `Articulation Controller` 的對應輸入埠：

- `Joint Names`（關節名稱）
- `Position Command`（位置命令）
- `Exec Out` -> `Exec In`

## 第七步：啟動仿真

點擊 Isaac Sim 介面左側 `Play` 按鈕開始仿真，機械臂將發布狀態資訊至 ROS2，並準備接收控制命令。

## 第八步：驗證 ROS2 通信

### 8.1 啟動 ROS2 環境

開啟新終端並啟動 ROS2 環境：

```bash
source /opt/ros/jazzy/setup.sh
```

> **注意**：請根據您的 ROS2 版本調整路徑，如 `humble`、`iron` 等。

### 8.2 查看 ROS2 主題

使用以下命令查看可用 ROS2 主題：

```bash
ros2 topic list
```

應看到以下輸出：

```
/joint_command
/joint_states
/parameter_events
/rosout
```

### 8.3 監控關節狀態

使用以下命令即時查看機械臂關節狀態：

```bash
ros2 topic echo /joint_states
```

將顯示每個關節的位置、速度和力矩資訊。

## 第九步：編寫控制腳本

以下為基礎鍵盤控制範例：

```python
#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import JointState
import sys
import termios
import tty
import select

class JointKeyboardControl(Node):
    def __init__(self):
        super().__init__('joint_keyboard_control')
        self.publisher_ = self.create_publisher(JointState, '/joint_command', 10)
        
        # 關節名稱（與 /joint_states 一致）
        self.joint_names = [
            'shoulder_pan',
            'shoulder_lift',
            'elbow_flex',
            'wrist_flex',
            'wrist_roll',
            'gripper'
        ]
        
        # 當前關節位置（初始為0）
        self.joint_positions = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        
        # 當前選中關節索引（預設第一個）
        self.selected_joint = 0
        
        # 關節調整步長
        self.step_size = 0.01
        
        # 保存終端設定
        self.old_settings = termios.tcgetattr(sys.stdin)
        
        # 操作提示
        self.print_instructions()
    
    def print_instructions(self):
        print("\n=== 機械臂鍵盤控制 ===")
        print("1-6: 選擇關節")
        print("a/d: 調整關節位置（a=減小, d=增大）")
        print("q: 退出程式")
        print("當前關節:", self.joint_names[self.selected_joint])
        print("當前位置:", self.joint_positions[self.selected_joint])
    
    def get_key(self):
        # 非阻塞讀取鍵盤輸入
        if select.select([sys.stdin], [], [], 0) == ([sys.stdin], [], []):
            return sys.stdin.read(1)
        return None
    
    def run(self):
        try:
            # 設置終端為非阻塞模式
            tty.setcbreak(sys.stdin.fileno())
            
            while rclpy.ok():
                key = self.get_key()
                if key is not None:
                    # 選擇關節（1-6）
                    if key in ['1', '2', '3', '4', '5', '6']:
                        self.selected_joint = int(key) - 1
                        print("\n當前關節:", self.joint_names[self.selected_joint])
                        print("當前位置:", self.joint_positions[self.selected_joint])
                    
                    # 調整關節位置（a=減小, d=增大）
                    elif key == 'a':
                        self.joint_positions[self.selected_joint] -= self.step_size
                        self.publish_joint_command()
                        print("位置 -:", self.joint_positions[self.selected_joint])
                    
                    elif key == 'd':
                        self.joint_positions[self.selected_joint] += self.step_size
                        self.publish_joint_command()
                        print("位置 +:", self.joint_positions[self.selected_joint])
                    
                    # 退出程式（q）
                    elif key == 'q':
                        print("\n退出程式...")
                        break
                
                # 短暫休眠，避免CPU過高
                rclpy.spin_once(self, timeout_sec=0.01)
        
        finally:
            # 恢復終端設定
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.old_settings)
    
    def publish_joint_command(self):
        msg = JointState()
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.name = self.joint_names
        msg.position = self.joint_positions
        self.publisher_.publish(msg)

def main(args=None):
    rclpy.init(args=args)
    joint_keyboard_control = JointKeyboardControl()
    
    try:
        joint_keyboard_control.run()
    except KeyboardInterrupt:
        pass
    finally:
        joint_keyboard_control.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
```

### 執行控制腳本

將程式碼儲存為 `joint_keyboard_control.py`，然後執行：

```bash
python3 joint_keyboard_control.py
```

您可在終端使用鍵盤控制機械臂運動，同時觀察 Isaac Sim 中機械臂的即時回應。
