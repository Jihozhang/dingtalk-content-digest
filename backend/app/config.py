import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # DingTalk
    DINGTALK_APP_KEY: str = Field(default="", description="钉钉应用 AppKey")
    DINGTALK_APP_SECRET: str = Field(default="", description="钉钉应用 AppSecret")
    DINGTALK_ROBOT_CODE: str = Field(default="", description="钉钉机器人 Code")

    # MongoDB
    MONGODB_URI: str = Field(default="mongodb://localhost:27017", description="MongoDB 连接地址")
    MONGODB_DB_NAME: str = Field(default="dingtalk_daily_reports", description="MongoDB 数据库名")

    # Backend
    SECRET_KEY: str = Field(default="change-me-in-production", description="JWT 密钥")
    ADMIN_USERNAME: str = Field(default="admin", description="管理员账号")
    ADMIN_PASSWORD: str = Field(default="admin123", description="管理员密码")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=480, description="Token 过期时间(分钟)")

    # CORS
    CORS_ORIGINS: list[str] = Field(default=["http://localhost:5177", "http://127.0.0.1:5177"])

    # DeepSeek AI
    DEEPSEEK_API_KEY: str = Field(default="", description="DeepSeek API Key")
    DEEPSEEK_API_BASE: str = Field(default="https://api.deepseek.com", description="DeepSeek API 基础地址")
    DEEPSEEK_MODEL: str = Field(default="deepseek-chat", description="DeepSeek 模型名称")

    # 定时智能汇总
    DIGEST_DAILY_CRON: str = Field(default="0 19 * * *", description="每日汇总 cron 表达式")
    DIGEST_WEEKLY_CRON: str = Field(default="0 9 * * 1", description="每周汇总 cron 表达式")
    DIGEST_PUSH_TO_GROUP: bool = Field(default=False, description="是否将汇总回推到群聊")
    ENABLE_SCHEDULER: bool = Field(default=True, description="是否启用定时任务调度器")

    # 消息回填
    BACKFILL_INTERVAL_MINUTES: int = Field(default=30, description="消息回填间隔(分钟)，0 表示关闭")
    BACKFILL_MAX_RESULTS: int = Field(default=500, description="单次回填最大消息数")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
