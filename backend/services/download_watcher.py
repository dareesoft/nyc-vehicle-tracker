"""
Download Watcher Service
Monitors S3 download status files and triggers scan when downloads complete.

Watches:
- /home/daree/03-Work-sh/NYC/img_download/download_status.json
- /home/daree/03-Work-sh/NYC/img_download/download_status_thumbnails.json

When both files show "status": "completed", waits 1 minute then triggers scan.
"""

import os
import json
import time
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable

logger = logging.getLogger(__name__)

# Status file paths
STATUS_FILES = {
    'images': '/home/daree/03-Work-sh/NYC/img_download/download_status.json',
    'thumbnails': '/home/daree/03-Work-sh/NYC/img_download/download_status_thumbnails.json'
}

# How long to wait after download completes before scanning (seconds)
SCAN_DELAY_SECONDS = 60

# How often to check the status files (seconds)
CHECK_INTERVAL_SECONDS = 30


class DownloadWatcher:
    """Watches download status files and triggers scan when complete."""
    
    def __init__(self, on_download_complete: Optional[Callable] = None):
        """
        Initialize the download watcher.
        
        Args:
            on_download_complete: Callback function to call when downloads complete.
                                  Should trigger the scan and detection process.
        """
        self.on_download_complete = on_download_complete
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_completed_times: dict[str, Optional[str]] = {
            'images': None,
            'thumbnails': None
        }
        self._scan_triggered_for: Optional[str] = None  # Track which completion we triggered for
        
    def _read_status_file(self, path: str) -> Optional[dict]:
        """Read and parse a status JSON file."""
        try:
            if not os.path.exists(path):
                return None
            
            with open(path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Error reading status file {path}: {e}")
            return None
    
    def _get_status(self, name: str) -> tuple[bool, Optional[str]]:
        """
        Check if a download is complete.
        
        Returns:
            Tuple of (is_completed, end_time)
        """
        path = STATUS_FILES.get(name)
        if not path:
            return False, None
            
        status = self._read_status_file(path)
        if not status:
            return False, None
            
        is_completed = status.get('status') == 'completed'
        end_time = status.get('end_time')
        
        return is_completed, end_time
    
    def _check_and_trigger(self):
        """Check status files and trigger scan if both downloads are complete."""
        # Check both status files
        images_complete, images_end_time = self._get_status('images')
        thumbnails_complete, thumbnails_end_time = self._get_status('thumbnails')
        
        if not images_complete or not thumbnails_complete:
            # Not both complete yet
            return
        
        # Both complete - check if this is a new completion
        completion_key = f"{images_end_time}_{thumbnails_end_time}"
        
        if self._scan_triggered_for == completion_key:
            # Already triggered scan for this completion
            return
        
        # Check if the end times are recent (within last hour)
        try:
            # Parse end times
            images_dt = datetime.strptime(images_end_time, "%Y-%m-%d %H:%M:%S")
            thumbnails_dt = datetime.strptime(thumbnails_end_time, "%Y-%m-%d %H:%M:%S")
            
            # Get the later of the two
            latest_completion = max(images_dt, thumbnails_dt)
            now = datetime.now()
            
            # Only trigger if completion was within the last hour
            time_since_completion = (now - latest_completion).total_seconds()
            
            if time_since_completion > 3600:  # More than 1 hour ago
                logger.debug(f"Downloads completed too long ago ({time_since_completion:.0f}s), skipping")
                self._scan_triggered_for = completion_key
                return
                
        except (ValueError, TypeError) as e:
            logger.warning(f"Error parsing end times: {e}")
            return
        
        # New completion detected!
        logger.info(f"Downloads completed! Images: {images_end_time}, Thumbnails: {thumbnails_end_time}")
        logger.info(f"Waiting {SCAN_DELAY_SECONDS} seconds before triggering scan...")
        
        # Wait before triggering
        time.sleep(SCAN_DELAY_SECONDS)
        
        # Mark as triggered
        self._scan_triggered_for = completion_key
        
        # Trigger the callback
        if self.on_download_complete:
            try:
                logger.info("Triggering scan after download completion...")
                self.on_download_complete()
            except Exception as e:
                logger.error(f"Error in download complete callback: {e}")
        else:
            logger.warning("No callback registered for download completion")
    
    def _watch_loop(self):
        """Main watch loop."""
        logger.info(f"Download watcher started. Checking every {CHECK_INTERVAL_SECONDS}s")
        logger.info(f"Watching files: {list(STATUS_FILES.values())}")
        
        while self._running:
            try:
                self._check_and_trigger()
            except Exception as e:
                logger.error(f"Error in watch loop: {e}")
            
            # Wait before next check
            for _ in range(CHECK_INTERVAL_SECONDS):
                if not self._running:
                    break
                time.sleep(1)
        
        logger.info("Download watcher stopped")
    
    def start(self):
        """Start the watcher in a background thread."""
        if self._running:
            logger.warning("Download watcher already running")
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._watch_loop, daemon=True)
        self._thread.start()
        logger.info("Download watcher thread started")
    
    def stop(self):
        """Stop the watcher."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("Download watcher stopped")
    
    def get_status(self) -> dict:
        """Get current watcher status."""
        images_complete, images_end_time = self._get_status('images')
        thumbnails_complete, thumbnails_end_time = self._get_status('thumbnails')
        
        return {
            'is_running': self._running,
            'images': {
                'path': STATUS_FILES['images'],
                'completed': images_complete,
                'end_time': images_end_time
            },
            'thumbnails': {
                'path': STATUS_FILES['thumbnails'],
                'completed': thumbnails_complete,
                'end_time': thumbnails_end_time
            },
            'last_triggered_for': self._scan_triggered_for,
            'check_interval_seconds': CHECK_INTERVAL_SECONDS,
            'scan_delay_seconds': SCAN_DELAY_SECONDS
        }


# Global watcher instance
_watcher: Optional[DownloadWatcher] = None


def get_watcher() -> Optional[DownloadWatcher]:
    """Get the global watcher instance."""
    return _watcher


def start_watcher(on_download_complete: Callable):
    """Start the global download watcher."""
    global _watcher
    if _watcher is not None:
        _watcher.stop()
    
    _watcher = DownloadWatcher(on_download_complete)
    _watcher.start()
    return _watcher


def stop_watcher():
    """Stop the global download watcher."""
    global _watcher
    if _watcher is not None:
        _watcher.stop()
        _watcher = None

