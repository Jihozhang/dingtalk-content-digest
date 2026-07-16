"""定时任务调度器：基于 APScheduler，注册每日/每周汇总与消息回填任务。"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.services.mongo_client import get_groups_collection

_settings = get_settings()

CN_TZ = timezone(timedelta(hours=8))

_scheduler: Optional[BackgroundScheduler] = None


def _active_group_ids() -> list:
    groups = get_groups_collection().find({"is_active": True}, {"conversation_id": 1})
    return [g["conversation_id"] for g in groups if g.get("conversation_id")]


def run_daily_digest():
    """每日汇总任务：为每个激活群生成当天摘要。"""
    from app.services.ai_digest import get_digest_generator
    today = datetime.now(CN_TZ).strftime("%Y-%m-%d")
    generator = get_digest_generator()
    group_ids = _active_group_ids()
    print(f"[Scheduler] Running daily digest for {len(group_ids)} groups ({today})")
    for conv_id in group_ids:
        try:
            generator.run_sync(conv_id, today, today, period_type="daily")
        except Exception as e:
            print(f"[Scheduler] Daily digest failed for {conv_id}: {e}")


def run_weekly_digest():
    """每周汇总任务：为每个激活群生成过去 7 天摘要。"""
    from app.services.ai_digest import get_digest_generator
    now = datetime.now(CN_TZ)
    end = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    start = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    generator = get_digest_generator()
    group_ids = _active_group_ids()
    print(f"[Scheduler] Running weekly digest for {len(group_ids)} groups ({start} ~ {end})")
    for conv_id in group_ids:
        try:
            generator.run_sync(conv_id, start, end, period_type="weekly")
        except Exception as e:
            print(f"[Scheduler] Weekly digest failed for {conv_id}: {e}")


def run_backfill():
    """定时回填任务。"""
    from app.services.message_backfill import backfill_all_groups
    try:
        backfill_all_groups()
    except Exception as e:
        print(f"[Scheduler] Backfill failed: {e}")


def start_scheduler():
    """启动调度器并注册任务。"""
    global _scheduler
    if _scheduler is not None:
        return
    if not _settings.ENABLE_SCHEDULER:
        print("[Scheduler] Disabled by config (ENABLE_SCHEDULER=false)")
        return

    _scheduler = BackgroundScheduler(timezone=CN_TZ)

    # 每日汇总
    try:
        _scheduler.add_job(
            run_daily_digest,
            CronTrigger.from_crontab(_settings.DIGEST_DAILY_CRON, timezone=CN_TZ),
            id="daily_digest",
            replace_existing=True,
        )
    except Exception as e:
        print(f"[Scheduler] Invalid DIGEST_DAILY_CRON '{_settings.DIGEST_DAILY_CRON}': {e}")

    # 每周汇总
    try:
        _scheduler.add_job(
            run_weekly_digest,
            CronTrigger.from_crontab(_settings.DIGEST_WEEKLY_CRON, timezone=CN_TZ),
            id="weekly_digest",
            replace_existing=True,
        )
    except Exception as e:
        print(f"[Scheduler] Invalid DIGEST_WEEKLY_CRON '{_settings.DIGEST_WEEKLY_CRON}': {e}")

    # 定时回填
    if _settings.BACKFILL_INTERVAL_MINUTES and _settings.BACKFILL_INTERVAL_MINUTES > 0:
        _scheduler.add_job(
            run_backfill,
            "interval",
            minutes=_settings.BACKFILL_INTERVAL_MINUTES,
            id="backfill",
            replace_existing=True,
        )

    _scheduler.start()
    jobs = [j.id for j in _scheduler.get_jobs()]
    print(f"[Scheduler] Started with jobs: {jobs}")


def stop_scheduler():
    """停止调度器。"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        print("[Scheduler] Stopped")


def get_scheduler_status() -> dict:
    """返回调度器状态与下次运行时间。"""
    if _scheduler is None:
        return {"running": False, "jobs": []}
    jobs = []
    for j in _scheduler.get_jobs():
        jobs.append({
            "id": j.id,
            "next_run_time": j.next_run_time.isoformat() if j.next_run_time else None,
        })
    return {"running": True, "jobs": jobs}
