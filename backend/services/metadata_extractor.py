"""
EXIF Metadata Extractor for Vehicle Surveillance System
Extracts GPS, timestamp, and link_id from vehicle camera images.
"""
import os
import json
import sqlite3
import asyncio
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from PIL.ExifTags import TAGS


@dataclass
class ImageMetadata:
    """Represents metadata extracted from a vehicle image."""
    file_path: str
    device_id: str
    camera_type: str  # '101' (front) or '32' (left)
    latitude: float
    longitude: float
    timestamp: str
    link_id: Optional[int]
    forward: Optional[bool]
    sequence: int


def dms_to_decimal(dms: Tuple, ref: str) -> float:
    """Convert DMS (degrees, minutes, seconds) to decimal degrees."""
    degrees, minutes, seconds = dms
    decimal = float(degrees) + float(minutes) / 60 + float(seconds) / 3600
    if ref in ['S', 'W']:
        decimal = -decimal
    return decimal


def extract_metadata_from_image(image_path: str, camera_type: str) -> Optional[ImageMetadata]:
    """Extract EXIF metadata from a single image file."""
    try:
        with Image.open(image_path) as img:
            exif = img._getexif()
            if not exif:
                return None
            
            exif_data = {}
            for tag_id, value in exif.items():
                tag = TAGS.get(tag_id, tag_id)
                exif_data[tag] = value
            
            # Extract GPS coordinates
            gps_info = exif_data.get('GPSInfo', {})
            if not gps_info or 2 not in gps_info or 4 not in gps_info:
                return None
            
            lat_ref = gps_info.get(1, 'N')
            lat_dms = gps_info.get(2)
            lon_ref = gps_info.get(3, 'W')
            lon_dms = gps_info.get(4)
            
            latitude = dms_to_decimal(lat_dms, lat_ref)
            longitude = dms_to_decimal(lon_dms, lon_ref)
            
            # Extract timestamp
            timestamp = exif_data.get('DateTime', exif_data.get('DateTimeOriginal', ''))
            
            # Extract link_id and forward from ImageDescription
            description = exif_data.get('ImageDescription', '{}')
            try:
                desc_json = json.loads(description)
                link_id = desc_json.get('link_id')
                forward = desc_json.get('forward')
            except (json.JSONDecodeError, TypeError):
                link_id = None
                forward = None
            
            # Parse filename for device_id and sequence
            filename = os.path.basename(image_path)
            parts = filename.replace('.jpg', '').split('_')
            device_id = parts[0] if parts else 'unknown'
            
            # Calculate sequence from path
            path_parts = Path(image_path).parts
            seq_idx = -3  # .../00000/origin/file.jpg
            try:
                sequence = int(path_parts[seq_idx])
            except (ValueError, IndexError):
                sequence = 0
            
            return ImageMetadata(
                file_path=image_path,
                device_id=device_id,
                camera_type=camera_type,
                latitude=latitude,
                longitude=longitude,
                timestamp=timestamp,
                link_id=link_id,
                forward=forward,
                sequence=sequence
            )
    except Exception as e:
        print(f"Error extracting metadata from {image_path}: {e}")
        return None


class MetadataCache:
    """SQLite-based cache for image metadata with thread-local connection pooling."""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()
    
    @contextmanager
    def get_connection(self):
        """Get a thread-local database connection (connection pooling)."""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._local.conn.row_factory = sqlite3.Row
            # Enable WAL mode for better concurrent read performance
            self._local.conn.execute('PRAGMA journal_mode=WAL')
            self._local.conn.execute('PRAGMA synchronous=NORMAL')
            self._local.conn.execute('PRAGMA cache_size=-64000')  # 64MB cache
        yield self._local.conn
    
    def _init_db(self):
        """Initialize the SQLite database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Images table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                device_id TEXT NOT NULL,
                camera_type TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                timestamp TEXT NOT NULL,
                link_id INTEGER,
                forward INTEGER,
                sequence INTEGER,
                detected INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Migration: Add 'detected' column if it doesn't exist
        try:
            cursor.execute('SELECT detected FROM images LIMIT 1')
        except sqlite3.OperationalError:
            print("[Migration] Adding 'detected' column to images table...")
            cursor.execute('ALTER TABLE images ADD COLUMN detected INTEGER DEFAULT 0')
            conn.commit()
        
        # Notifications table for tracking new data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                device_id TEXT,
                date TEXT,
                message TEXT NOT NULL,
                count INTEGER DEFAULT 0,
                read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Detections table for YOLO speed sign detections
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL,
                class_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                bbox_x1 REAL NOT NULL,
                bbox_y1 REAL NOT NULL,
                bbox_x2 REAL NOT NULL,
                bbox_y2 REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (image_id) REFERENCES images(id)
            )
        ''')
        
        # Indexes for images
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_device_id ON images(device_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_timestamp ON images(timestamp)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_camera_type ON images(camera_type)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_link_id ON images(link_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_detected ON images(detected)
        ''')
        
        # Indexes for notifications
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notification_read ON notifications(read)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_notification_type ON notifications(type)
        ''')
        
        # Indexes for detections
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_detection_image ON detections(image_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_detection_class ON detections(class_name)
        ''')
        
        # Composite indexes for common queries (performance optimization)
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_device_timestamp 
            ON images(device_id, timestamp)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_device_camera_timestamp 
            ON images(device_id, camera_type, timestamp)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_trip_lookup 
            ON images(device_id, camera_type, timestamp, file_path)
        ''')
        
        conn.commit()
        conn.close()
    
    def insert_metadata(self, metadata: ImageMetadata):
        """Insert a single metadata record into the cache."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO images 
                (file_path, device_id, camera_type, latitude, longitude, timestamp, link_id, forward, sequence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metadata.file_path,
                metadata.device_id,
                metadata.camera_type,
                metadata.latitude,
                metadata.longitude,
                metadata.timestamp,
                metadata.link_id,
                1 if metadata.forward else 0 if metadata.forward is not None else None,
                metadata.sequence
            ))
            conn.commit()
        finally:
            conn.close()
    
    def insert_batch(self, metadata_list: List[ImageMetadata]):
        """Insert multiple metadata records in a batch."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.executemany('''
                INSERT OR REPLACE INTO images 
                (file_path, device_id, camera_type, latitude, longitude, timestamp, link_id, forward, sequence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', [
                (
                    m.file_path, m.device_id, m.camera_type, m.latitude, m.longitude,
                    m.timestamp, m.link_id, 
                    1 if m.forward else 0 if m.forward is not None else None,
                    m.sequence
                )
                for m in metadata_list
            ])
            conn.commit()
        finally:
            conn.close()
    
    def get_devices(self) -> List[Dict[str, Any]]:
        """Get list of unique devices with image counts."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT device_id, 
                   COUNT(*) as total_images,
                   COUNT(DISTINCT DATE(timestamp)) as total_days,
                   MIN(timestamp) as first_seen,
                   MAX(timestamp) as last_seen
            FROM images
            GROUP BY device_id
            ORDER BY device_id
        ''')
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'device_id': row[0],
                'total_images': row[1],
                'total_days': row[2],
                'first_seen': row[3],
                'last_seen': row[4]
            })
        
        conn.close()
        return results
    
    def get_trips(self, device_id: str) -> List[Dict[str, Any]]:
        """Get list of trips (dates) for a specific device."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Timestamp format is "2025:10:01 12:27:48" - extract date part using substr
        cursor.execute('''
            SELECT REPLACE(SUBSTR(timestamp, 1, 10), ':', '-') as trip_date,
                   COUNT(*) as image_count,
                   MIN(timestamp) as start_time,
                   MAX(timestamp) as end_time,
                   COUNT(DISTINCT link_id) as unique_links
            FROM images
            WHERE device_id = ?
            GROUP BY SUBSTR(timestamp, 1, 10)
            ORDER BY trip_date DESC
        ''', (device_id,))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'date': row[0],
                'image_count': row[1],
                'start_time': row[2],
                'end_time': row[3],
                'unique_links': row[4]
            })
        
        conn.close()
        return results
    
    def get_trip_details(self, device_id: str, date: str) -> List[Dict[str, Any]]:
        """Get detailed metadata for a specific trip."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Convert date format "2025-10-01" back to match stored format "2025:10:01"
        date_pattern = date.replace('-', ':')
        
        query = '''
            SELECT * FROM images
            WHERE device_id = ? AND timestamp LIKE ?
            ORDER BY timestamp ASC, file_path ASC
        '''
        
        cursor.execute(query, (device_id, f'{date_pattern}%'))
        results = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return results
    
    def get_links(self) -> List[Dict[str, Any]]:
        """Get unique link_ids with their GPS coordinates for road network visualization."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT link_id, 
                   AVG(latitude) as center_lat,
                   AVG(longitude) as center_lon,
                   MIN(latitude) as min_lat,
                   MAX(latitude) as max_lat,
                   MIN(longitude) as min_lon,
                   MAX(longitude) as max_lon,
                   COUNT(*) as point_count
            FROM images
            WHERE link_id IS NOT NULL
            GROUP BY link_id
            HAVING COUNT(*) > 1
        ''')
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'link_id': row[0],
                'center': [row[2], row[1]],  # [lng, lat] for GeoJSON
                'bounds': [[row[5], row[3]], [row[6], row[4]]],
                'point_count': row[7]
            })
        
        conn.close()
        return results
    
    def get_link_path(self, link_id: int) -> List[List[float]]:
        """Get GPS path for a specific link_id."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT longitude, latitude
            FROM images
            WHERE link_id = ?
            ORDER BY timestamp ASC, file_path ASC
        ''', (link_id,))
        
        path = [[row[0], row[1]] for row in cursor.fetchall()]
        conn.close()
        return path
    
    def get_image_count(self) -> int:
        """Get total number of images in cache."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM images')
        count = cursor.fetchone()[0]
        conn.close()
        return count
    
    def is_file_cached(self, file_path: str) -> bool:
        """Check if a file is already in the cache."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT 1 FROM images WHERE file_path = ? LIMIT 1', (file_path,))
        exists = cursor.fetchone() is not None
        conn.close()
        return exists
    
    # ==================== Notification Methods ====================
    
    def add_notification(self, type: str, message: str, device_id: str = None, 
                        date: str = None, count: int = 0) -> int:
        """Add a new notification."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO notifications (type, device_id, date, message, count)
            VALUES (?, ?, ?, ?, ?)
        ''', (type, device_id, date, message, count))
        
        notification_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return notification_id
    
    def get_notifications(self, unread_only: bool = False, limit: int = 50) -> List[Dict[str, Any]]:
        """Get notifications, optionally filtered to unread only."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = 'SELECT * FROM notifications'
        if unread_only:
            query += ' WHERE read = 0'
        query += ' ORDER BY created_at DESC LIMIT ?'
        
        cursor.execute(query, (limit,))
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_unread_count(self) -> int:
        """Get count of unread notifications."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM notifications WHERE read = 0')
        count = cursor.fetchone()[0]
        conn.close()
        return count
    
    def mark_notifications_read(self, notification_ids: List[int] = None):
        """Mark notifications as read. If no IDs provided, mark all as read."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if notification_ids:
            placeholders = ','.join('?' * len(notification_ids))
            cursor.execute(f'UPDATE notifications SET read = 1 WHERE id IN ({placeholders})', notification_ids)
        else:
            cursor.execute('UPDATE notifications SET read = 1')
        
        conn.commit()
        conn.close()
    
    # ==================== Detection Methods ====================
    
    def insert_detection(self, image_id: int, class_name: str, confidence: float,
                        bbox: Tuple[float, float, float, float]) -> int:
        """Insert a detection result."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO detections (image_id, class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (image_id, class_name, confidence, bbox[0], bbox[1], bbox[2], bbox[3]))
        
        detection_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return detection_id
    
    def insert_detections_batch(self, detections: List[Dict[str, Any]]):
        """Insert multiple detections in a batch."""
        if not detections:
            return
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.executemany('''
            INSERT INTO detections (image_id, class_name, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', [
            (d['image_id'], d['class_name'], d['confidence'], 
             d['bbox'][0], d['bbox'][1], d['bbox'][2], d['bbox'][3])
            for d in detections
        ])
        
        conn.commit()
        conn.close()
    
    def mark_image_detected(self, image_id: int):
        """Mark an image as having been processed for detection."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('UPDATE images SET detected = 1 WHERE id = ?', (image_id,))
        conn.commit()
        conn.close()
    
    def mark_images_detected_batch(self, image_ids: List[int]):
        """Mark multiple images as detected in batch."""
        if not image_ids:
            return
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(image_ids))
        cursor.execute(f'UPDATE images SET detected = 1 WHERE id IN ({placeholders})', image_ids)
        conn.commit()
        conn.close()
    
    def get_undetected_images(self, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get images that haven't been processed for detection yet."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, file_path, device_id, latitude, longitude, timestamp, link_id
            FROM images
            WHERE detected = 0
            ORDER BY timestamp ASC
            LIMIT ?
        ''', (limit,))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_detections_for_trip(self, device_id: str, date: str) -> List[Dict[str, Any]]:
        """Get all detections for a specific trip with image info."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        date_pattern = date.replace('-', ':')
        
        cursor.execute('''
            SELECT d.*, i.file_path, i.latitude, i.longitude, i.timestamp, i.link_id
            FROM detections d
            JOIN images i ON d.image_id = i.id
            WHERE i.device_id = ? AND i.timestamp LIKE ?
            ORDER BY i.timestamp ASC
        ''', (device_id, f'{date_pattern}%'))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_detection_stats(self) -> Dict[str, Any]:
        """Get overall detection statistics."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Total detections by class
        cursor.execute('''
            SELECT class_name, COUNT(*) as count
            FROM detections
            GROUP BY class_name
        ''')
        by_class = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Total images processed
        cursor.execute('SELECT COUNT(*) FROM images WHERE detected = 1')
        images_processed = cursor.fetchone()[0]
        
        # Total images with detections
        cursor.execute('SELECT COUNT(DISTINCT image_id) FROM detections')
        images_with_detections = cursor.fetchone()[0]
        
        # Total detections
        cursor.execute('SELECT COUNT(*) FROM detections')
        total_detections = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'by_class': by_class,
            'images_processed': images_processed,
            'images_with_detections': images_with_detections,
            'total_detections': total_detections
        }
    
    def get_image_by_id(self, image_id: int) -> Optional[Dict[str, Any]]:
        """Get image info by ID."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM images WHERE id = ?', (image_id,))
        row = cursor.fetchone()
        
        conn.close()
        return dict(row) if row else None
    
    def get_detections_for_image(self, image_id: int) -> List[Dict[str, Any]]:
        """Get all detections for a specific image."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM detections WHERE image_id = ?
        ''', (image_id,))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results


async def scan_and_cache_images(
    data_root: str, 
    cache: MetadataCache, 
    progress_callback=None,
    max_workers: int = 8
) -> Dict[str, int]:
    """
    Scan the data directory and cache all image metadata.
    Uses thread pool for parallel EXIF extraction.
    Returns dict with new_images count and new_trips info.
    """
    image_files = []
    
    # Get existing trips before scan for comparison
    existing_devices = {d['device_id']: set() for d in cache.get_devices()}
    for device_id in existing_devices:
        for trip in cache.get_trips(device_id):
            existing_devices[device_id].add(trip['date'])
    
    # Discover all image files - scan all subdirectories (no camera type distinction)
    # Supports both old structure (101/, 32/) and flat structure
    for root, dirs, files in os.walk(data_root):
        # Exclude thumbnails folder (no EXIF metadata)
        if 'thumbnails' in dirs:
            dirs.remove('thumbnails')
        
        for file in files:
            if file.lower().endswith('.jpg'):
                file_path = os.path.join(root, file)
                if not cache.is_file_cached(file_path):
                    # Detect camera type from path if present, otherwise default to 'all'
                    camera_type = 'all'
                    if '/101/' in file_path or '\\101\\' in file_path:
                        camera_type = '101'
                    elif '/32/' in file_path or '\\32\\' in file_path:
                        camera_type = '32'
                    image_files.append((file_path, camera_type))
    
    total_files = len(image_files)
    if total_files == 0:
        print("No new images to process.")
        return {'new_images': 0, 'new_trips': []}
    
    print(f"Processing {total_files} new images...")
    
    # Process in batches with thread pool
    batch_size = 1000
    processed = 0
    
    def process_image(args):
        file_path, camera_type = args
        return extract_metadata_from_image(file_path, camera_type)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for i in range(0, total_files, batch_size):
            batch = image_files[i:i + batch_size]
            results = list(executor.map(process_image, batch))
            
            # Filter out None results and insert batch
            valid_metadata = [m for m in results if m is not None]
            if valid_metadata:
                cache.insert_batch(valid_metadata)
            
            processed += len(batch)
            if progress_callback:
                progress_callback(processed, total_files)
            else:
                print(f"Progress: {processed}/{total_files} ({100*processed/total_files:.1f}%)")
    
    # Detect new trips after scan
    new_trips = []
    for device in cache.get_devices():
        device_id = device['device_id']
        for trip in cache.get_trips(device_id):
            if device_id not in existing_devices or trip['date'] not in existing_devices[device_id]:
                new_trips.append({'device_id': device_id, 'date': trip['date'], 'count': trip['image_count']})
    
    print(f"Completed. Total images in cache: {cache.get_image_count()}")
    print(f"New trips found: {len(new_trips)}")
    
    return {'new_images': total_files, 'new_trips': new_trips}


if __name__ == '__main__':
    # CLI for manual cache building
    import sys
    
    DATA_ROOT = '/mnt/sata_2025/NYC/Test_data_2025_11_24'
    DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'metadata_cache.db')
    
    cache = MetadataCache(DB_PATH)
    
    print(f"Data root: {DATA_ROOT}")
    print(f"Database: {DB_PATH}")
    print(f"Current cache size: {cache.get_image_count()} images")
    
    asyncio.run(scan_and_cache_images(DATA_ROOT, cache))

