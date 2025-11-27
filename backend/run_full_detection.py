#!/usr/bin/env python3
"""
Run full detection on all 101 camera images.
Outputs progress and can be resumed if interrupted.
"""
import os
import sys
import time
import sqlite3

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.metadata_extractor import MetadataCache
from services.sign_detector import run_detection_on_images

DB_PATH = '/home/daree/02-Work-dh/nyc-vehicle-tracker/backend/data/metadata_cache.db'
BATCH_SIZE = 500  # Process 500 images at a time for progress updates

def get_undetected_101_images(limit=None):
    """Get undetected images from 101 camera (front camera)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = '''
        SELECT id, file_path, device_id, latitude, longitude, timestamp, link_id
        FROM images
        WHERE detected = 0 AND file_path LIKE '%/101/%'
        ORDER BY timestamp ASC
    '''
    if limit:
        query += f' LIMIT {limit}'
    
    cursor.execute(query)
    results = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return results

def main():
    print("=" * 60)
    print("NYC Speed Sign Detection - Full 101 Camera Processing")
    print("=" * 60)
    
    # Initialize cache
    cache = MetadataCache(DB_PATH)
    
    # Get total count of undetected 101 images
    pending = get_undetected_101_images()
    total_pending = len(pending)
    
    if total_pending == 0:
        print("No pending 101 camera images to process.")
        return
    
    print(f"Total 101 camera images to process: {total_pending:,}")
    print(f"Estimated time: {total_pending / 14.7 / 60:.1f} minutes")
    print("-" * 60)
    
    # Process in batches
    total_detections = 0
    total_processed = 0
    start_time = time.time()
    
    while True:
        # Get next batch
        batch = get_undetected_101_images(limit=BATCH_SIZE)
        if not batch:
            break
        
        batch_start = time.time()
        
        # Progress callback
        def progress(p, t):
            if p % 100 == 0:
                elapsed = time.time() - start_time
                rate = total_processed / elapsed if elapsed > 0 else 0
                remaining = (total_pending - total_processed) / rate / 60 if rate > 0 else 0
                print(f"  Progress: {p}/{t} batch, {total_processed + p}/{total_pending} total "
                      f"({rate:.1f} img/s, ~{remaining:.0f} min remaining)")
        
        # Run detection on batch
        detections = run_detection_on_images(batch, cache, batch_size=16, progress_callback=progress)
        
        batch_time = time.time() - batch_start
        batch_rate = len(batch) / batch_time if batch_time > 0 else 0
        
        total_detections += detections
        total_processed += len(batch)
        
        print(f"Batch complete: {len(batch)} images, {detections} detections, "
              f"{batch_rate:.1f} img/s")
        print(f"Total progress: {total_processed}/{total_pending} ({100*total_processed/total_pending:.1f}%)")
        print(f"Total detections so far: {total_detections}")
        print("-" * 60)
    
    # Final summary
    elapsed = time.time() - start_time
    print("=" * 60)
    print("DETECTION COMPLETE")
    print("=" * 60)
    print(f"Total images processed: {total_processed:,}")
    print(f"Total detections found: {total_detections:,}")
    print(f"Detection rate: {100 * total_detections / total_processed:.2f}%")
    print(f"Total time: {elapsed / 60:.1f} minutes")
    print(f"Average speed: {total_processed / elapsed:.1f} img/s")
    print("=" * 60)

if __name__ == '__main__':
    main()

