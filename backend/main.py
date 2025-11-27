"""
NYC Vehicle Surveillance System - FastAPI Backend
Provides REST API for vehicle tracking data and image serving.
"""
import os
import asyncio
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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

# Configuration
DATA_ROOT = os.environ.get('DATA_ROOT', '/mnt/sata_2025/NYC/Test_data_2025_11_24')
DB_PATH = os.environ.get('DB_PATH', '/home/daree/02-Work-dh/nyc-vehicle-tracker/backend/data/metadata_cache.db')

# Ensure data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# Global cache instance
cache: Optional[MetadataCache] = None
is_scanning = False
is_detecting = False
scan_progress = {"current": 0, "total": 0, "status": "idle"}
detection_progress = {"current": 0, "total": 0, "status": "idle"}


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
    
    yield
    
    # Cleanup
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

