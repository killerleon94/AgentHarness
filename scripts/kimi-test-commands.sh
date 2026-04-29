# Kimi Agent 直接测试命令（实际参数）

# 常用工作目录
WORKDIR_BASE="/home/ubuntu/multica_workspaces_user-ffd8723e/e36eef34-fc31-4591-8a55-0e955676e981"

# Session ID（从之前的执行中获取）
SESSION_ID="4a34dc73-a764-46c7-bfe2-287bb2c2ed2f"

# 命令1：通过 multica 创建 issue（分配给 Kimi）
multica issue create --title "做一个简单的自我介绍" --description "做一个简单的自我介绍"
multica issue assign <issue_id> --to <kimi_agent_id>

# 命令2：直接执行 Kimi（模拟 daemon 调用）
# 需要替换 <issue_id> 为实际 issue ID

# 初始触发 - 新 issue
kimi --print --output-format stream-json --yolo \
  --work-dir /home/ubuntu/multica_workspaces_user-ffd8723e/e36eef34-fc31-4591-8a55-0e955676e981/fdaf2513/workdir \
  --prompt "You are running as a local coding agent for a Multica workspace. Your assigned issue ID is: <issue_id>. Start by running 'multica issue get <issue_id> --output json' to understand your task, then complete it. When done, use 'multica issue comment add <issue_id> --content \"...\"' to post results."

# 追问触发 - 评论回复（需要带 session 参数）
kimi --print --output-format stream-json --yolo \
  --work-dir /home/ubuntu/multica_workspaces_user-ffd8723e/e36eef34-fc31-4591-8a55-0e955676e981/fdaf2513/workdir \
  --session 4a34dc73-a764-46c7-bfe2-287bb2c2ed2f \
  --prompt "You are running as a local coding agent for a Multica workspace. Your assigned issue ID is: <issue_id>. This task was triggered by a comment (ID: <trigger_comment_id>). Run 'multica issue get <issue_id> --output json' to understand context, then reply with 'multica issue comment add <issue_id> --parent <trigger_comment_id> --content \"...\"'"