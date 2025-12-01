"""
NYC Vehicle Surveillance System - FastAPI Backend
Provides REST API for vehicle tracking data and image serving.
"""
import os
import asyncio
import secrets
import hashlib
import json
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

from services.metadata_extractor import MetadataCache, scan_and_cache_images
from services.trip_builder import (
    build_geojson_route,
    build_link_network_geojson,
    calculate_trip_stats,
    build_3d_path_data
)

# Import sign detector (may not be available)
try:
    from services.sign_detector import run_detection_on_images, YOLO_AVAILABLE
except ImportError:
    YOLO_AVAILABLE = False
    run_detection_on_images = None

# Import scheduler
from services.scheduler import init_scheduler, get_scheduler, stop_scheduler

# Import download watcher
from services.download_watcher import start_watcher, stop_watcher, get_watcher

# Import coverage analysis services
from services.kml_parser import parse_nyc_speed_signs, signs_to_geojson, get_sign_stats
from services.coverage_analyzer import (
    analyze_coverage, cluster_detections, result_to_geojson, get_coverage_stats
)

# Coverage cache for fast repeated queries
import time
from typing import Dict, Any, Tuple

class CoverageCache:
    """LRU-style cache for coverage analysis results."""
    def __init__(self, ttl_seconds: int = 600):  # 10 minutes TTL
        self.cache: Dict[Tuple[int, int, str], Dict[str, Any]] = {}
        self.timestamps: Dict[Tuple[int, int, str], float] = {}
        self.ttl = ttl_seconds
        self.precomputed = False
    
    def get(self, radius: int, cluster_radius: int, algorithm: str = 'greedy_nearest') -> Optional[Dict[str, Any]]:
        key = (radius, cluster_radius, algorithm)
        if key in self.cache:
            if time.time() - self.timestamps[key] < self.ttl:
                return self.cache[key]
            else:
                # Expired
                del self.cache[key]
                del self.timestamps[key]
        return None
    
    def set(self, radius: int, cluster_radius: int, algorithm: str, data: Dict[str, Any]):
        key = (radius, cluster_radius, algorithm)
        self.cache[key] = data
        self.timestamps[key] = time.time()
        # Keep only last 20 entries (more algorithms = more entries)
        if len(self.cache) > 20:
            oldest_key = min(self.timestamps, key=self.timestamps.get)
            del self.cache[oldest_key]
            del self.timestamps[oldest_key]
    
    def clear(self):
        self.cache.clear()
        self.timestamps.clear()

coverage_cache = CoverageCache()

# Supported matching algorithms
MATCHING_ALGORITHMS = ['greedy_nearest', 'hungarian', 'mutual_nearest']

# Configuration
DATA_ROOT = os.environ.get('DATA_ROOT', '/mnt/sata_2025/NYC/Test_data_2025_11_24')
DB_PATH = os.environ.get('DB_PATH', '/home/daree/02-Work-dh/nyc-vehicle-tracker/backend/data/metadata_cache.db')
NYC_KML_PATH = os.environ.get('NYC_KML_PATH', '/home/daree/02-Work-dh/nyc-vehicle-tracker/backend/data/nyc_sls_2025-10-24.kml')

# Cached NYC signs (loaded once at startup)
_nyc_signs_cache = None

# Authentication configuration
AUTH_USERS = {
    "daree": "riaas0110!"
}
AUTH_TOKEN_EXPIRY_HOURS = 24 * 7  # 7 days

# Active tokens storage (in production, use Redis or database)
active_tokens: dict[str, dict] = {}

# Ensure data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Global cache instance
cache: Optional[MetadataCache] = None
is_scanning = False
is_detecting = False
scan_progress = {"current": 0, "total": 0, "status": "idle"}
detection_progress = {"current": 0, "total": 0, "status": "idle"}


async def precompute_coverage():
    """Pre-compute coverage analysis with default parameters for all algorithms."""
    global coverage_cache
    try:
        print("Pre-computing coverage analysis (radius=50m, cluster=30m)...")
        
        # Get NYC signs
        nyc_signs = get_nyc_signs()
        if not nyc_signs:
            print("Warning: NYC signs data not available for precomputation")
            return
        
        # Get detections
        if not cache:
            print("Warning: Cache not initialized for precomputation")
            return
            
        import sqlite3
        conn = sqlite3.connect(cache.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT d.id, d.class_name, d.confidence,
                   d.bbox_x1, d.bbox_y1, d.bbox_x2, d.bbox_y2,
                   i.latitude, i.longitude, i.file_path, i.timestamp
            FROM detections d
            JOIN images i ON d.image_id = i.id
            WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL
        ''')
        
        our_detections = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        if not our_detections:
            print("Warning: No detections found for precomputation")
            return
        
        # Cluster once, use for all algorithms
        clustered = cluster_detections(our_detections, 30.0)
        
        # Precompute for default algorithm (greedy_nearest)
        default_algo = 'greedy_nearest'
        result = analyze_coverage(nyc_signs, clustered, 50.0, algorithm=default_algo)
        
        # Cache the result
        geojson = result_to_geojson(result)
        stats = get_coverage_stats(result)
        
        coverage_cache.set(50, 30, default_algo, {
            "geojson": geojson,
            "stats": stats,
            "parameters": {
                "match_radius_meters": 50.0,
                "cluster_radius_meters": 30.0,
                "algorithm": default_algo,
                "raw_detection_count": len(our_detections),
                "clustered_detection_count": len(clustered)
            }
        })
        coverage_cache.precomputed = True
        
        print(f"Coverage pre-computed ({default_algo}): {stats['matched']} matched, "
              f"{stats['undetected']} undetected, {stats['new_findings']} new findings "
              f"(took {stats.get('processing_time_ms', 0):.1f}ms)")
        
    except Exception as e:
        print(f"Error during coverage precomputation: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app."""
    global cache
    print(f"Initializing metadata cache at {DB_PATH}")
    cache = MetadataCache(DB_PATH)
    
    # Check if we need to scan for new images
    existing_count = cache.get_image_count()
    print(f"Existing cached images: {existing_count}")
    
    if existing_count == 0:
        print("No cached data found. Starting initial scan in background...")
        asyncio.create_task(run_scan())
    
    # Initialize scheduler for daily scans at 10 PM KST (22:00)
    init_scheduler(run_scan)
    print("Scheduler initialized for daily scans at 22:00 KST")
    
    # Initialize download watcher (triggers scan when S3 download completes)
    start_watcher(on_download_complete=lambda: asyncio.create_task(run_scan()))
    print("Download watcher initialized - will scan when S3 downloads complete")
    
    # Pre-compute coverage analysis in background
    asyncio.create_task(precompute_coverage())
    
    yield
    
    # Cleanup
    stop_watcher()
    stop_scheduler()
    print("Shutting down...")


app = FastAPI(
    title="NYC Vehicle Surveillance API",
    description="Backend API for vehicle tracking and monitoring system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for responses
class DeviceInfo(BaseModel):
    device_id: str
    total_images: int
    total_days: int
    first_seen: str
    last_seen: str


class TripInfo(BaseModel):
    date: str
    image_count: int
    start_time: str
    end_time: str
    unique_links: int


class ScanStatus(BaseModel):
    is_scanning: bool
    current: int
    total: int
    status: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    user: Optional[str] = None
    expires_at: Optional[str] = None
    message: Optional[str] = None


class VerifyRequest(BaseModel):
    token: str


# Background scan task
async def run_scan(run_detection: bool = True):
    """Run metadata scan in background, optionally followed by detection."""
    global is_scanning, scan_progress, cache
    
    if is_scanning:
        return
    
    is_scanning = True
    scan_progress = {"current": 0, "total": 0, "status": "scanning"}
    
    def progress_callback(current, total):
        global scan_progress
        scan_progress = {"current": current, "total": total, "status": "scanning"}
    
    try:
        result = await scan_and_cache_images(DATA_ROOT, cache, progress_callback)
        scan_progress["status"] = "completed"
        
        # Create notifications for new trips
        if result and result.get('new_trips'):
            for trip in result['new_trips']:
                cache.add_notification(
                    type='new_trip',
                    message=f"New trip: {trip['date']} ({trip['count']} images)",
                    device_id=trip['device_id'],
                    date=trip['date'],
                    count=trip['count']
                )
        
        # Run detection if enabled and YOLO is available
        if run_detection and YOLO_AVAILABLE and run_detection_on_images:
            await run_detection_scan()
            
    except Exception as e:
        scan_progress["status"] = f"error: {str(e)}"
    finally:
        is_scanning = False


async def run_detection_scan():
    """Run detection on unprocessed images."""
    global is_detecting, detection_progress, cache
    
    if is_detecting or not YOLO_AVAILABLE:
        return
    
    is_detecting = True
    detection_progress = {"current": 0, "total": 0, "status": "detecting"}
    
    def progress_callback(current, total):
        global detection_progress
        detection_progress = {"current": current, "total": total, "status": "detecting"}
    
    try:
        # Get unprocessed images
        undetected = cache.get_undetected_images(limit=5000)
        total_images = len(undetected)
        
        if total_images == 0:
            detection_progress["status"] = "completed"
            return
        
        detection_progress["total"] = total_images
        
        # Run detection
        total_detections = run_detection_on_images(
            undetected, 
            cache, 
            batch_size=8,
            progress_callback=progress_callback
        )
        
        detection_progress["status"] = "completed"
        
        # Create notification for detections
        if total_detections > 0:
            cache.add_notification(
                type='detection_complete',
                message=f"Detection complete: {total_detections} signs found in {total_images} images",
                count=total_detections
            )
            
    except Exception as e:
        detection_progress["status"] = f"error: {str(e)}"
    finally:
        is_detecting = False


# API Endpoints

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "cache_size": cache.get_image_count() if cache else 0}


# ==================== Authentication Endpoints ====================

def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)


def clean_expired_tokens():
    """Remove expired tokens from active_tokens."""
    now = datetime.utcnow()
    expired = [token for token, data in active_tokens.items() 
               if datetime.fromisoformat(data['expires_at']) < now]
    for token in expired:
        del active_tokens[token]


@app.post("/api/auth/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """Authenticate user and return session token."""
    # Clean expired tokens periodically
    clean_expired_tokens()
    
    # Verify credentials
    if credentials.username not in AUTH_USERS:
        return LoginResponse(success=False, message="Invalid username or password")
    
    if AUTH_USERS[credentials.username] != credentials.password:
        return LoginResponse(success=False, message="Invalid username or password")
    
    # Generate token
    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(hours=AUTH_TOKEN_EXPIRY_HOURS)
    
    # Store token
    active_tokens[token] = {
        "user": credentials.username,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }
    
    return LoginResponse(
        success=True,
        token=token,
        user=credentials.username,
        expires_at=expires_at.isoformat()
    )


@app.post("/api/auth/verify")
async def verify_token(request: VerifyRequest):
    """Verify if a token is valid."""
    clean_expired_tokens()
    
    if request.token not in active_tokens:
        return {"valid": False, "message": "Invalid or expired token"}
    
    token_data = active_tokens[request.token]
    expires_at = datetime.fromisoformat(token_data['expires_at'])
    
    if datetime.utcnow() > expires_at:
        del active_tokens[request.token]
        return {"valid": False, "message": "Token expired"}
    
    return {
        "valid": True,
        "user": token_data['user'],
        "expires_at": token_data['expires_at']
    }


@app.post("/api/auth/logout")
async def logout(request: VerifyRequest):
    """Invalidate a token."""
    if request.token in active_tokens:
        del active_tokens[request.token]
    return {"success": True}


@app.get("/api/scan/status", response_model=ScanStatus)
async def get_scan_status():
    """Get current scan status."""
    return ScanStatus(
        is_scanning=is_scanning,
        current=scan_progress["current"],
        total=scan_progress["total"],
        status=scan_progress["status"]
    )


@app.post("/api/scan/start")
async def start_scan(background_tasks: BackgroundTasks):
    """Start a new metadata scan."""
    if is_scanning:
        return {"message": "Scan already in progress"}
    
    background_tasks.add_task(run_scan)
    return {"message": "Scan started"}


@app.get("/api/devices", response_model=list[DeviceInfo])
async def get_devices():
    """Get list of all devices with their statistics."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    devices = cache.get_devices()
    return [DeviceInfo(**d) for d in devices]


@app.get("/api/trips/{device_id}", response_model=list[TripInfo])
async def get_trips(device_id: str):
    """Get list of trips for a specific device."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    trips = cache.get_trips(device_id)
    if not trips:
        raise HTTPException(status_code=404, detail=f"No trips found for device {device_id}")
    
    return [TripInfo(**t) for t in trips]


@app.get("/api/trip/{device_id}/{date}")
async def get_trip_details(device_id: str, date: str):
    """Get detailed metadata for a specific trip."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    trip_data = cache.get_trip_details(device_id, date)
    if not trip_data:
        raise HTTPException(status_code=404, detail=f"No data found for device {device_id} on {date}")
    
    return {
        "data": trip_data,
        "stats": calculate_trip_stats(trip_data)
    }


@app.get("/api/trip/{device_id}/{date}/geojson")
async def get_trip_geojson(device_id: str, date: str):
    """Get GeoJSON representation of a trip route."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    trip_data = cache.get_trip_details(device_id, date)
    if not trip_data:
        raise HTTPException(status_code=404, detail=f"No data found for device {device_id} on {date}")
    
    return build_geojson_route(trip_data)


@app.get("/api/trip/{device_id}/{date}/3d")
async def get_trip_3d_data(device_id: str, date: str):
    """Get 3D path data for deck.gl visualization."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    trip_data = cache.get_trip_details(device_id, date)
    if not trip_data:
        raise HTTPException(status_code=404, detail=f"No data found for device {device_id} on {date}")
    
    return {
        "paths": build_3d_path_data(trip_data),
        "stats": calculate_trip_stats(trip_data)
    }


@app.get("/api/links")
async def get_links():
    """Get road link network data."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    links = cache.get_links()
    return build_link_network_geojson(links, cache)


@app.get("/api/image/{camera_type}/{device_id}/{date}/{sequence}/{filename:path}")
async def get_image(
    camera_type: str,
    device_id: str,
    date: str,
    sequence: str,
    filename: str
):
    """Serve an image file."""
    # Construct the file path
    image_path = os.path.join(
        DATA_ROOT,
        camera_type,
        device_id,
        date,
        sequence,
        "origin",
        filename
    )
    
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(
        image_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@app.get("/api/image-by-path")
async def get_image_by_path(path: str = Query(..., description="Full file path")):
    """Serve an image by its full path (for convenience)."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Security check: ensure path is within DATA_ROOT
    if not os.path.abspath(path).startswith(os.path.abspath(DATA_ROOT)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@app.get("/api/thumbnail/{device_id}/{date}/{sequence}/{filename:path}")
async def get_thumbnail(
    device_id: str,
    date: str,
    sequence: str,
    filename: str
):
    """Serve a thumbnail image (smaller, faster loading)."""
    # Thumbnail path: thumbnails/{device_id}/{YYYYMMDD}/{seq}/thumbnail/{file}.jpg
    # Convert date format if needed (YYYY-MM-DD -> YYYYMMDD)
    date_clean = date.replace("-", "")
    
    thumb_path = os.path.join(
        DATA_ROOT,
        "thumbnails",
        device_id,
        date_clean,
        sequence,
        "thumbnail",
        filename
    )
    
    if os.path.exists(thumb_path):
        return FileResponse(
            thumb_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=604800"}  # 1 week cache for thumbnails
        )
    
    # Fallback: try to serve original image if thumbnail doesn't exist
    # Try with camera_type 101 (front camera)
    original_path = os.path.join(
        DATA_ROOT,
        "101",
        device_id,
        date_clean,
        sequence,
        "origin",
        filename
    )
    
    if os.path.exists(original_path):
        return FileResponse(
            original_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    
    raise HTTPException(status_code=404, detail="Thumbnail not found")


@app.get("/api/stats")
async def get_stats():
    """Get overall system statistics."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    devices = cache.get_devices()
    detection_stats = cache.get_detection_stats()
    
    total_images = sum(d['total_images'] for d in devices)
    total_devices = len(devices)
    
    return {
        "total_images": total_images,
        "total_devices": total_devices,
        "devices": devices,
        "data_root": DATA_ROOT,
        "cache_status": "ready" if not is_scanning else "scanning",
        "detection_status": "detecting" if is_detecting else "ready",
        "detection_stats": detection_stats
    }


# ==================== Notification Endpoints ====================

@app.get("/api/notifications")
async def get_notifications(unread_only: bool = False, limit: int = 50):
    """Get notification list."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    notifications = cache.get_notifications(unread_only=unread_only, limit=limit)
    unread_count = cache.get_unread_count()
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@app.post("/api/notifications/mark-read")
async def mark_notifications_read(notification_ids: list[int] = None):
    """Mark notifications as read."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    cache.mark_notifications_read(notification_ids)
    return {"success": True}


# ==================== Detection Endpoints ====================

@app.get("/api/detection/status")
async def get_detection_status():
    """Get current detection status."""
    return {
        "is_detecting": is_detecting,
        "current": detection_progress["current"],
        "total": detection_progress["total"],
        "status": detection_progress["status"],
        "yolo_available": YOLO_AVAILABLE
    }


@app.post("/api/detection/start")
async def start_detection(background_tasks: BackgroundTasks):
    """Start detection on unprocessed images."""
    if not YOLO_AVAILABLE:
        raise HTTPException(status_code=503, detail="YOLO model not available")
    
    if is_detecting:
        return {"message": "Detection already in progress"}
    
    background_tasks.add_task(run_detection_scan)
    return {"message": "Detection started"}


@app.get("/api/detections/{device_id}/{date}")
async def get_trip_detections(device_id: str, date: str):
    """Get all detections for a specific trip."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    detections = cache.get_detections_for_trip(device_id, date)
    
    return {
        "device_id": device_id,
        "date": date,
        "total": len(detections),
        "detections": detections
    }


@app.get("/api/detections/stats")
async def get_detection_stats():
    """Get overall detection statistics."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    return cache.get_detection_stats()


@app.get("/api/detection-image/{detection_id}")
async def get_detection_image(detection_id: int):
    """Get image with bounding box for a specific detection."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    # Get detection info
    conn = __import__('sqlite3').connect(cache.db_path)
    conn.row_factory = __import__('sqlite3').Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT d.*, i.file_path
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE d.id = ?
    ''', (detection_id,))
    
    result = cursor.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=404, detail="Detection not found")
    
    # Return the detection info (client can draw bounding box)
    return {
        "id": result['id'],
        "image_path": result['file_path'],
        "class_name": result['class_name'],
        "confidence": result['confidence'],
        "bbox": {
            "x1": result['bbox_x1'],
            "y1": result['bbox_y1'],
            "x2": result['bbox_x2'],
            "y2": result['bbox_y2']
        }
    }


# ==================== Scheduler Endpoints ====================

@app.get("/api/scheduler/status")
async def get_scheduler_status():
    """Get scheduler status."""
    scheduler = get_scheduler()
    if scheduler:
        return scheduler.get_status()
    return {"is_running": False}


@app.get("/api/watcher/status")
async def get_watcher_status():
    """Get download watcher status."""
    watcher = get_watcher()
    if watcher:
        return watcher.get_status()
    return {"is_running": False, "message": "Watcher not initialized"}


@app.post("/api/scan/trigger")
async def trigger_scan(background_tasks: BackgroundTasks):
    """Trigger a manual scan."""
    if is_scanning:
        return {"message": "Scan already in progress"}
    
    background_tasks.add_task(run_scan)
    return {"message": "Scan triggered"}


# ==================== Multi-Trip Overlay Endpoints ====================

class TripSelection(BaseModel):
    device_id: str
    date: str


class CombinedRoutesRequest(BaseModel):
    trips: list[TripSelection]


@app.post("/api/combined-routes")
async def get_combined_routes(request: CombinedRoutesRequest):
    """Get combined GeoJSON for multiple trips."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    if not request.trips:
        return {"type": "FeatureCollection", "features": []}
    
    all_features = []
    colors = [
        "#00fff7",  # cyan
        "#ff00ff",  # magenta
        "#ffff00",  # yellow
        "#00ff00",  # green
        "#ff6600",  # orange
        "#ff0066",  # pink
        "#6600ff",  # purple
        "#00ffcc",  # teal
    ]
    
    for i, trip in enumerate(request.trips):
        trip_data = cache.get_trip_details(trip.device_id, trip.date)
        if trip_data:
            geojson = build_geojson_route(trip_data)
            color = colors[i % len(colors)]
            
            # Add trip metadata and color to each feature
            for feature in geojson.get('features', []):
                feature['properties']['trip_device'] = trip.device_id
                feature['properties']['trip_date'] = trip.date
                feature['properties']['trip_color'] = color
                feature['properties']['trip_index'] = i
                all_features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": all_features,
        "trip_count": len(request.trips)
    }


@app.post("/api/combined-detections")
async def get_combined_detections(request: CombinedRoutesRequest):
    """Get combined detection GeoJSON for multiple trips."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    if not request.trips:
        return {"type": "FeatureCollection", "features": [], "total": 0}
    
    all_features = []
    colors = [
        "#ff00ff",  # magenta
        "#00fff7",  # cyan
        "#ffff00",  # yellow
        "#00ff00",  # green
        "#ff6600",  # orange
        "#ff0066",  # pink
        "#6600ff",  # purple
        "#00ffcc",  # teal
    ]
    
    for i, trip in enumerate(request.trips):
        detections = cache.get_detections_for_trip(trip.device_id, trip.date)
        color = colors[i % len(colors)]
        
        for det in detections:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [det['longitude'], det['latitude']]
                },
                "properties": {
                    "id": det['id'],
                    "class_name": det['class_name'],
                    "confidence": det['confidence'],
                    "file_path": det['file_path'],
                    "timestamp": det['timestamp'],
                    "link_id": det['link_id'],
                    "trip_device": trip.device_id,
                    "trip_date": trip.date,
                    "trip_color": color,
                    "trip_index": i,
                }
            }
            all_features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": all_features,
        "total": len(all_features),
        "trip_count": len(request.trips)
    }


# ==================== Coverage Analysis Endpoints ====================

def get_nyc_signs():
    """Get NYC signs from cache or load from KML file."""
    global _nyc_signs_cache
    
    if _nyc_signs_cache is None:
        if os.path.exists(NYC_KML_PATH):
            _nyc_signs_cache = parse_nyc_speed_signs(NYC_KML_PATH)
            print(f"[Coverage] Loaded {len(_nyc_signs_cache)} NYC signs from KML")
        else:
            _nyc_signs_cache = []
            print(f"[Coverage] KML file not found: {NYC_KML_PATH}")
    
    return _nyc_signs_cache


@app.get("/api/coverage/nyc-signs")
async def get_nyc_signs_geojson():
    """Get all NYC official speed limit signs as GeoJSON."""
    signs = get_nyc_signs()
    
    if not signs:
        raise HTTPException(status_code=404, detail="NYC signs data not available")
    
    geojson = signs_to_geojson(signs)
    stats = get_sign_stats(signs)
    
    return {
        "geojson": geojson,
        "stats": stats
    }


@app.get("/api/coverage/our-detections")
async def get_all_detections_geojson(cluster: bool = True, cluster_radius: float = 30.0):
    """Get all our YOLO detections as GeoJSON, optionally clustered."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    # Get all detections with coordinates
    conn = __import__('sqlite3').connect(cache.db_path)
    conn.row_factory = __import__('sqlite3').Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT d.id, d.class_name, d.confidence, 
               i.latitude, i.longitude, i.file_path, i.timestamp
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL
    ''')
    
    detections = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Optionally cluster detections
    if cluster and len(detections) > 0:
        detections = cluster_detections(detections, cluster_radius)
    
    # Convert to GeoJSON
    features = []
    for det in detections:
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [det['longitude'], det['latitude']]
            },
            'properties': {
                'class_name': det.get('class_name', ''),
                'confidence': det.get('confidence', 0),
                'detection_count': det.get('detection_count', 1)
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features,
        "total": len(features),
        "clustered": cluster
    }


@app.get("/api/coverage/analysis")
async def get_coverage_analysis(
    radius: float = Query(50.0, description="Match radius in meters"),
    cluster_radius: float = Query(30.0, description="Clustering radius for our detections"),
    algorithm: str = Query('greedy_nearest', description="Matching algorithm: greedy_nearest, hungarian, mutual_nearest")
):
    """
    Analyze coverage between NYC official database and our detections.
    
    Matching Algorithms:
    - greedy_nearest: Fast greedy matching, each NYC sign finds closest unused detection
    - hungarian: Globally optimal 1:1 matching using Hungarian algorithm
    - mutual_nearest: Conservative matching, only when both sides agree on nearest
    
    Uses KD-Tree for O(n log m) performance and caches results.
    Returns matched, undetected, and new findings.
    """
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    # Validate algorithm
    if algorithm not in MATCHING_ALGORITHMS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid algorithm: {algorithm}. Must be one of {MATCHING_ALGORITHMS}"
        )
    
    # Check cache first (round to integers for cache key)
    radius_int = int(radius)
    cluster_int = int(cluster_radius)
    
    cached = coverage_cache.get(radius_int, cluster_int, algorithm)
    if cached:
        # Add cache hit info
        cached_response = dict(cached)
        cached_response["from_cache"] = True
        return cached_response
    
    # Get NYC signs
    nyc_signs = get_nyc_signs()
    if not nyc_signs:
        raise HTTPException(status_code=404, detail="NYC signs data not available")
    
    # Get our detections
    import sqlite3
    conn = sqlite3.connect(cache.db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT d.id, d.class_name, d.confidence,
               d.bbox_x1, d.bbox_y1, d.bbox_x2, d.bbox_y2,
               i.latitude, i.longitude, i.file_path, i.timestamp
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL
    ''')
    
    our_detections = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    # Cluster our detections to reduce duplicates
    clustered_detections = cluster_detections(our_detections, cluster_radius)
    
    # Run coverage analysis with selected algorithm
    result = analyze_coverage(nyc_signs, clustered_detections, radius, algorithm=algorithm)
    
    # Convert to response format
    geojson = result_to_geojson(result)
    stats = get_coverage_stats(result)
    
    response = {
        "geojson": geojson,
        "stats": stats,
        "parameters": {
            "match_radius_meters": radius,
            "cluster_radius_meters": cluster_radius,
            "algorithm": algorithm,
            "raw_detection_count": len(our_detections),
            "clustered_detection_count": len(clustered_detections)
        },
        "from_cache": False
    }
    
    # Cache the result
    coverage_cache.set(radius_int, cluster_int, algorithm, response)
    
    return response


@app.get("/api/coverage/analysis-stream")
async def get_coverage_analysis_stream(
    radius: float = Query(50.0, description="Match radius in meters"),
    cluster_radius: float = Query(30.0, description="Clustering radius for our detections"),
    algorithm: str = Query('greedy_nearest', description="Matching algorithm")
):
    """
    Stream coverage analysis progress using Server-Sent Events (SSE).
    
    Sends progress updates:
    - step: Current step name
    - progress: Progress percentage (0-100)
    - message: Description of current operation
    - result: Final result (when complete)
    """
    import asyncio
    
    async def generate():
        try:
            # Step 1: Loading NYC signs (10%)
            yield f"data: {json.dumps({'step': 'loading_nyc', 'progress': 5, 'message': 'Loading NYC database...'})}\n\n"
            await asyncio.sleep(0.1)
            
            nyc_signs = get_nyc_signs()
            if not nyc_signs:
                yield f"data: {json.dumps({'error': 'NYC signs data not available'})}\n\n"
                return
            
            yield f"data: {json.dumps({'step': 'loading_nyc', 'progress': 15, 'message': f'Loaded {len(nyc_signs):,} NYC signs'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 2: Loading detections (25%)
            yield f"data: {json.dumps({'step': 'loading_detections', 'progress': 20, 'message': 'Loading our detections...'})}\n\n"
            await asyncio.sleep(0.1)
            
            if not cache:
                yield f"data: {json.dumps({'error': 'Cache not initialized'})}\n\n"
                return
            
            import sqlite3
            conn = sqlite3.connect(cache.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT d.id, d.class_name, d.confidence,
                       d.bbox_x1, d.bbox_y1, d.bbox_x2, d.bbox_y2,
                       i.latitude, i.longitude, i.file_path, i.timestamp
                FROM detections d
                JOIN images i ON d.image_id = i.id
                WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL
            ''')
            
            our_detections = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            yield f"data: {json.dumps({'step': 'loading_detections', 'progress': 30, 'message': f'Loaded {len(our_detections):,} detections'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 3: Clustering (45%)
            yield f"data: {json.dumps({'step': 'clustering', 'progress': 35, 'message': 'Clustering detections...'})}\n\n"
            await asyncio.sleep(0.1)
            
            clustered_detections = cluster_detections(our_detections, cluster_radius)
            
            yield f"data: {json.dumps({'step': 'clustering', 'progress': 50, 'message': f'Clustered to {len(clustered_detections):,} unique points'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 4: Building KD-Tree (60%)
            yield f"data: {json.dumps({'step': 'kdtree', 'progress': 55, 'message': 'Building spatial index (KD-Tree)...'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 5: Matching (80%)
            algo_names = {
                'greedy_nearest': 'Greedy Nearest',
                'hungarian': 'Hungarian (Optimal)',
                'mutual_nearest': 'Mutual Nearest'
            }
            algo_display = algo_names.get(algorithm, algorithm)
            
            yield f"data: {json.dumps({'step': 'matching', 'progress': 60, 'message': f'Running {algo_display} matching...'})}\n\n"
            await asyncio.sleep(0.1)
            
            result = analyze_coverage(nyc_signs, clustered_detections, radius, algorithm=algorithm)
            
            yield f"data: {json.dumps({'step': 'matching', 'progress': 85, 'message': f'Found {result.match_count:,} matches'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 6: Generating GeoJSON (95%)
            yield f"data: {json.dumps({'step': 'geojson', 'progress': 90, 'message': 'Generating map data...'})}\n\n"
            await asyncio.sleep(0.1)
            
            geojson = result_to_geojson(result)
            stats = get_coverage_stats(result)
            
            # Step 7: Complete (100%)
            final_response = {
                "geojson": geojson,
                "stats": stats,
                "parameters": {
                    "match_radius_meters": radius,
                    "cluster_radius_meters": cluster_radius,
                    "algorithm": algorithm,
                    "raw_detection_count": len(our_detections),
                    "clustered_detection_count": len(clustered_detections)
                }
            }
            
            yield f"data: {json.dumps({'step': 'complete', 'progress': 100, 'message': 'Analysis complete!', 'result': final_response})}\n\n"
            
            # Cache the result
            radius_int = int(radius)
            cluster_int = int(cluster_radius)
            coverage_cache.set(radius_int, cluster_int, algorithm, final_response)
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@app.get("/api/coverage/stats")
async def get_coverage_stats_only(
    radius: float = Query(50.0, description="Match radius in meters"),
    cluster_radius: float = Query(30.0, description="Clustering radius")
):
    """Get only the coverage statistics (lighter response)."""
    if not cache:
        raise HTTPException(status_code=503, detail="Cache not initialized")
    
    nyc_signs = get_nyc_signs()
    if not nyc_signs:
        raise HTTPException(status_code=404, detail="NYC signs data not available")
    
    # Get our detections
    conn = __import__('sqlite3').connect(cache.db_path)
    conn.row_factory = __import__('sqlite3').Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT d.id, d.class_name, d.confidence,
               i.latitude, i.longitude
        FROM detections d
        JOIN images i ON d.image_id = i.id
        WHERE i.latitude IS NOT NULL AND i.longitude IS NOT NULL
    ''')
    
    our_detections = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    clustered = cluster_detections(our_detections, cluster_radius)
    result = analyze_coverage(nyc_signs, clustered, radius)
    
    return get_coverage_stats(result)


# ============================================================
# Boot Sequence SSE Endpoint
# ============================================================

@app.get("/api/boot-sequence")
async def boot_sequence_stream():
    """
    Stream boot sequence progress using Server-Sent Events (SSE).
    
    Performs actual initialization tasks and prefetches data:
    1. Database health check
    2. Load trip list
    3. Load recent trip details
    4. Prefetch coverage analysis
    5. Load NYC signs reference data
    6. System ready
    """
    import asyncio
    import sqlite3
    
    async def generate():
        prefetched_data = {}
        
        try:
            # Step 1: Database Connection (0-15%)
            yield f"data: {json.dumps({'step': 'db_connection', 'progress': 5, 'message': 'ESTABLISHING DATABASE CONNECTION'})}\n\n"
            await asyncio.sleep(0.1)
            
            if cache:
                stats = cache.get_stats() if hasattr(cache, 'get_stats') else {'size': 0}
                cache_size = stats.get('size', 0) if isinstance(stats, dict) else 0
                health_data = {
                    'status': 'healthy',
                    'cache_size': cache_size
                }
            else:
                health_data = {'status': 'initializing', 'cache_size': 0}
            
            prefetched_data['health'] = health_data
            cache_msg = f"DATABASE CONNECTED ({health_data['cache_size']:,} cached)"
            yield f"data: {json.dumps({'step': 'db_connection', 'progress': 15, 'message': cache_msg, 'data': health_data})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 2: Load Trips (16-35%)
            yield f"data: {json.dumps({'step': 'trips', 'progress': 20, 'message': 'LOADING SURVEILLANCE NETWORK'})}\n\n"
            await asyncio.sleep(0.1)
            
            trips = []
            if cache:
                # Get all device IDs and their trips
                conn = sqlite3.connect(cache.db_path)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT DISTINCT device_id FROM images ORDER BY device_id
                ''')
                device_ids = [row['device_id'] for row in cursor.fetchall()]
                
                for device_id in device_ids:
                    device_trips = cache.get_trips(device_id)
                    if device_trips:
                        for trip in device_trips:
                            trips.append({
                                'device_id': device_id,
                                **trip
                            })
                conn.close()
            
            prefetched_data['trips'] = trips
            yield f"data: {json.dumps({'step': 'trips', 'progress': 35, 'message': f'LOADED {len(trips)} TRIPS', 'data': trips})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 3: Load Recent Trip Details (36-55%)
            yield f"data: {json.dumps({'step': 'recent_trip', 'progress': 40, 'message': 'SYNCING VEHICLE TELEMETRY'})}\n\n"
            await asyncio.sleep(0.1)
            
            recent_trip = None
            if trips and cache:
                # Get most recent trip
                sorted_trips = sorted(trips, key=lambda t: t.get('date', ''), reverse=True)
                if sorted_trips:
                    latest = sorted_trips[0]
                    trip_images = cache.get_trip_details(latest['device_id'], latest['date'])
                    if trip_images:
                        recent_trip = {
                            'device_id': latest['device_id'],
                            'date': latest['date'],
                            'images': trip_images
                        }
            
            prefetched_data['recent_trip'] = recent_trip
            frame_count = len(recent_trip['images']) if recent_trip else 0
            msg = f'SYNCED {frame_count} FRAMES'
            yield f"data: {json.dumps({'step': 'recent_trip', 'progress': 55, 'message': msg, 'data': recent_trip})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 4: Coverage Analysis (56-75%)
            yield f"data: {json.dumps({'step': 'coverage', 'progress': 60, 'message': 'INITIALIZING COVERAGE ANALYSIS'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Try to get from cache (already precomputed)
            coverage_data = coverage_cache.get(50, 30, 'greedy_nearest') if coverage_cache else None
            if coverage_data:
                stats = coverage_data.get('stats', {})
                total_signs = stats.get('total_nyc', 0)
                matched = stats.get('matched', 0)
                coverage_pct = stats.get('coverage_percentage', 0)
                msg = f'ANALYZED {total_signs:,} SIGNS ({coverage_pct:.1f}% COVERAGE)'
            else:
                msg = 'COVERAGE DATA PENDING'
            
            prefetched_data['coverage'] = coverage_data
            yield f"data: {json.dumps({'step': 'coverage', 'progress': 75, 'message': msg})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 5: NYC Signs Reference (76-90%)
            yield f"data: {json.dumps({'step': 'nyc_signs', 'progress': 80, 'message': 'ACTIVATING CAMERA FEEDS'})}\n\n"
            await asyncio.sleep(0.1)
            
            nyc_signs = get_nyc_signs()
            signs_count = len(nyc_signs) if nyc_signs else 0
            
            yield f"data: {json.dumps({'step': 'nyc_signs', 'progress': 90, 'message': f'{signs_count:,} REFERENCE POINTS LOADED'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Step 6: Complete (100%)
            yield f"data: {json.dumps({'step': 'complete', 'progress': 100, 'message': 'SYSTEM READY', 'final': True, 'prefetched': prefetched_data})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'step': 'error', 'progress': 0})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

