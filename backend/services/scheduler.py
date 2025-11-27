"""
Scheduler Service for NYC Vehicle Surveillance System
Schedules daily data scans and manages automatic updates.
"""
import asyncio
from datetime import datetime, time
from typing import Callable, Optional
import pytz

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger


# Korea Standard Time
KST = pytz.timezone('Asia/Seoul')

# Default scan time: 10:00 PM KST (22:00) = UTC 13:00
DEFAULT_SCAN_HOUR = 22
DEFAULT_SCAN_MINUTE = 0


class ScanScheduler:
    """Manages scheduled scanning tasks."""
    
    def __init__(
        self,
        scan_callback: Callable,
        hour: int = DEFAULT_SCAN_HOUR,
        minute: int = DEFAULT_SCAN_MINUTE,
        timezone: str = 'Asia/Seoul'
    ):
        """
        Initialize the scheduler.
        
        Args:
            scan_callback: Async function to call when scan is triggered
            hour: Hour to run the scan (in local timezone)
            minute: Minute to run the scan
            timezone: Timezone for scheduling
        """
        self.scan_callback = scan_callback
        self.hour = hour
        self.minute = minute
        self.timezone = pytz.timezone(timezone)
        self.scheduler = AsyncIOScheduler(timezone=self.timezone)
        self._job_id = 'daily_scan'
        self._is_running = False
    
    def start(self):
        """Start the scheduler."""
        if self._is_running:
            return
        
        # Add the daily scan job
        self.scheduler.add_job(
            self._run_scan,
            CronTrigger(
                hour=self.hour,
                minute=self.minute,
                timezone=self.timezone
            ),
            id=self._job_id,
            replace_existing=True
        )
        
        self.scheduler.start()
        self._is_running = True
        
        next_run = self.get_next_run_time()
        print(f"[Scheduler] Started. Next scan at: {next_run}")
    
    def stop(self):
        """Stop the scheduler."""
        if not self._is_running:
            return
        
        self.scheduler.shutdown()
        self._is_running = False
        print("[Scheduler] Stopped")
    
    async def _run_scan(self):
        """Internal wrapper to run the scan callback."""
        print(f"[Scheduler] Starting scheduled scan at {datetime.now(self.timezone)}")
        try:
            await self.scan_callback()
            print("[Scheduler] Scheduled scan completed")
        except Exception as e:
            print(f"[Scheduler] Scan failed: {e}")
    
    def trigger_now(self):
        """Trigger a scan immediately."""
        if self.scan_callback:
            asyncio.create_task(self.scan_callback())
            return True
        return False
    
    def get_next_run_time(self) -> Optional[datetime]:
        """Get the next scheduled run time."""
        if not self._is_running:
            return None
        
        job = self.scheduler.get_job(self._job_id)
        if job:
            return job.next_run_time
        return None
    
    def get_status(self) -> dict:
        """Get scheduler status."""
        next_run = self.get_next_run_time()
        return {
            'is_running': self._is_running,
            'next_run': next_run.isoformat() if next_run else None,
            'schedule': f"{self.hour:02d}:{self.minute:02d} {self.timezone}",
            'timezone': str(self.timezone)
        }
    
    def reschedule(self, hour: int, minute: int):
        """Reschedule the daily scan to a new time."""
        if self._is_running:
            self.scheduler.reschedule_job(
                self._job_id,
                trigger=CronTrigger(
                    hour=hour,
                    minute=minute,
                    timezone=self.timezone
                )
            )
            self.hour = hour
            self.minute = minute
            print(f"[Scheduler] Rescheduled to {hour:02d}:{minute:02d}")


# Global scheduler instance
_scheduler: Optional[ScanScheduler] = None


def get_scheduler() -> Optional[ScanScheduler]:
    """Get the global scheduler instance."""
    return _scheduler


def init_scheduler(scan_callback: Callable) -> ScanScheduler:
    """Initialize and start the global scheduler."""
    global _scheduler
    if _scheduler is None:
        _scheduler = ScanScheduler(scan_callback)
        _scheduler.start()
    return _scheduler


def stop_scheduler():
    """Stop the global scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.stop()
        _scheduler = None

