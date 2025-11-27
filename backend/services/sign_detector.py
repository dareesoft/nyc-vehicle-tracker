"""
NYC Speed Sign Detector Service
Detects speed limit signs in vehicle camera images using YOLOv11x.
"""
import os
import gc
import torch
import numpy as np
from PIL import Image
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

# Try to import ultralytics (YOLO)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("Warning: ultralytics not installed. Detection features will be disabled.")


# Class names for NYC traffic signs (matching the training data)
CLASS_NAMES = [
    'white-speed-numeric',
    'white-speed-textonly', 
    'white-non-speed',
    'yellow-speed',
    'road-sign'
]

# Classes we're interested in (speed limit signs)
TARGET_CLASSES = ['white-speed-numeric', 'white-speed-textonly']
TARGET_CLASS_IDS = [0, 1]  # Indices in CLASS_NAMES


@dataclass
class Detection:
    """Represents a single detection result."""
    class_name: str
    class_id: int
    confidence: float
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'class_name': self.class_name,
            'class_id': self.class_id,
            'confidence': self.confidence,
            'bbox': list(self.bbox)
        }


class NYCSignDetector:
    """Speed limit sign detector using YOLOv11x."""
    
    def __init__(
        self,
        model_path: str = None,
        device: str = None,
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45
    ):
        """
        Initialize the sign detector.
        
        Args:
            model_path: Path to YOLOv11x model weights
            device: Device to use ('cuda' or 'cpu'). Auto-detect if None
            conf_threshold: Confidence threshold for detections
            iou_threshold: IoU threshold for NMS
        """
        if not YOLO_AVAILABLE:
            raise RuntimeError("ultralytics package not installed. Please run: pip install ultralytics")
        
        # Default model path
        if model_path is None:
            model_path = os.path.join(
                os.path.dirname(__file__), '..', 'models', 'speed_sign_detector.pt'
            )
        
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.model = None
        
        # Auto-detect device
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
                print(f"[SignDetector] Using CUDA: {torch.cuda.get_device_name(0)}")
            else:
                self.device = "cpu"
                print("[SignDetector] Using CPU")
        else:
            self.device = device
        
        # Load model
        self._load_model()
    
    def _load_model(self):
        """Load the YOLO model."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model weights not found: {self.model_path}")
        
        print(f"[SignDetector] Loading model from: {self.model_path}")
        self.model = YOLO(self.model_path)
        self.model.to(self.device)
        print("[SignDetector] Model loaded successfully")
    
    def detect(
        self, 
        image_path: str,
        conf_threshold: float = None,
        iou_threshold: float = None,
        target_classes_only: bool = True
    ) -> List[Detection]:
        """
        Run detection on a single image.
        
        Args:
            image_path: Path to the image file
            conf_threshold: Override default confidence threshold
            iou_threshold: Override default IoU threshold
            target_classes_only: If True, only return speed limit sign detections
            
        Returns:
            List of Detection objects
        """
        if not os.path.exists(image_path):
            return []
        
        conf = conf_threshold or self.conf_threshold
        iou = iou_threshold or self.iou_threshold
        
        try:
            # Load image and get original size for full resolution inference
            with Image.open(image_path) as img:
                orig_width, orig_height = img.size
                # Use larger dimension for imgsz, capped at 1280
                imgsz = min(max(orig_width, orig_height), 1280)
            
            # Run inference
            results = self.model.predict(
                source=image_path,
                conf=conf,
                iou=iou,
                imgsz=imgsz,
                device=self.device,
                verbose=False
            )
            
            detections = []
            
            if len(results) > 0:
                result = results[0]
                boxes = result.boxes
                
                for i in range(len(boxes)):
                    box = boxes[i]
                    
                    # Get coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0].cpu().numpy())
                    class_id = int(box.cls[0].cpu().numpy())
                    
                    # Filter by target classes if needed
                    if target_classes_only and class_id not in TARGET_CLASS_IDS:
                        continue
                    
                    class_name = CLASS_NAMES[class_id] if class_id < len(CLASS_NAMES) else f"class_{class_id}"
                    
                    detections.append(Detection(
                        class_name=class_name,
                        class_id=class_id,
                        confidence=confidence,
                        bbox=(float(x1), float(y1), float(x2), float(y2))
                    ))
            
            return detections
            
        except Exception as e:
            print(f"[SignDetector] Error processing {image_path}: {e}")
            return []
        finally:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
    
    def detect_batch(
        self,
        image_paths: List[str],
        conf_threshold: float = None,
        iou_threshold: float = None,
        target_classes_only: bool = True,
        batch_size: int = 8
    ) -> Dict[str, List[Detection]]:
        """
        Run detection on multiple images in batches.
        
        Args:
            image_paths: List of image file paths
            conf_threshold: Override default confidence threshold
            iou_threshold: Override default IoU threshold
            target_classes_only: If True, only return speed limit sign detections
            batch_size: Number of images to process at once
            
        Returns:
            Dictionary mapping image paths to their detections
        """
        all_detections = {}
        
        # Process in batches
        for i in range(0, len(image_paths), batch_size):
            batch_paths = image_paths[i:i + batch_size]
            
            # Filter to only existing files
            valid_paths = [p for p in batch_paths if os.path.exists(p)]
            
            if not valid_paths:
                continue
            
            try:
                conf = conf_threshold or self.conf_threshold
                iou = iou_threshold or self.iou_threshold
                
                # Run batch inference
                results = self.model.predict(
                    source=valid_paths,
                    conf=conf,
                    iou=iou,
                    imgsz=1280,
                    device=self.device,
                    verbose=False
                )
                
                # Process results
                for path, result in zip(valid_paths, results):
                    detections = []
                    boxes = result.boxes
                    
                    for j in range(len(boxes)):
                        box = boxes[j]
                        
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        
                        if target_classes_only and class_id not in TARGET_CLASS_IDS:
                            continue
                        
                        class_name = CLASS_NAMES[class_id] if class_id < len(CLASS_NAMES) else f"class_{class_id}"
                        
                        detections.append(Detection(
                            class_name=class_name,
                            class_id=class_id,
                            confidence=confidence,
                            bbox=(float(x1), float(y1), float(x2), float(y2))
                        ))
                    
                    all_detections[path] = detections
                    
            except Exception as e:
                print(f"[SignDetector] Batch error: {e}")
            finally:
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
        
        # Add empty lists for paths that weren't processed
        for path in image_paths:
            if path not in all_detections:
                all_detections[path] = []
        
        return all_detections
    
    def cleanup(self):
        """Release resources."""
        print("[SignDetector] Cleaning up...")
        if self.model is not None:
            del self.model
            self.model = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        print("[SignDetector] Cleanup complete")


# Global detector instance (lazy loaded)
_detector: Optional[NYCSignDetector] = None


def get_detector() -> NYCSignDetector:
    """Get or create the global detector instance."""
    global _detector
    if _detector is None:
        _detector = NYCSignDetector()
    return _detector


def run_detection_on_images(
    image_records: List[Dict[str, Any]],
    cache,
    batch_size: int = 8,
    progress_callback=None
) -> int:
    """
    Run detection on a list of image records and store results in database.
    
    Args:
        image_records: List of image records from database with 'id' and 'file_path'
        cache: MetadataCache instance for storing results
        batch_size: Batch size for inference
        progress_callback: Optional callback(processed, total)
        
    Returns:
        Number of detections found
    """
    if not YOLO_AVAILABLE:
        print("[SignDetector] YOLO not available, skipping detection")
        return 0
    
    detector = get_detector()
    total = len(image_records)
    processed = 0
    total_detections = 0
    
    # Process in batches
    for i in range(0, total, batch_size):
        batch = image_records[i:i + batch_size]
        
        # Get file paths
        paths = [r['file_path'] for r in batch]
        ids = [r['id'] for r in batch]
        
        # Run detection
        results = detector.detect_batch(paths)
        
        # Store results
        detections_to_insert = []
        for record_id, path in zip(ids, paths):
            detections = results.get(path, [])
            
            for det in detections:
                detections_to_insert.append({
                    'image_id': record_id,
                    'class_name': det.class_name,
                    'confidence': det.confidence,
                    'bbox': det.bbox
                })
            
            total_detections += len(detections)
        
        # Batch insert detections
        if detections_to_insert:
            cache.insert_detections_batch(detections_to_insert)
        
        # Mark images as processed
        cache.mark_images_detected_batch(ids)
        
        processed += len(batch)
        if progress_callback:
            progress_callback(processed, total)
    
    return total_detections


if __name__ == '__main__':
    # Test the detector
    import sys
    
    if len(sys.argv) > 1:
        test_image = sys.argv[1]
        detector = NYCSignDetector()
        
        print(f"Testing on: {test_image}")
        detections = detector.detect(test_image)
        
        print(f"Found {len(detections)} detections:")
        for det in detections:
            print(f"  {det.class_name}: {det.confidence:.2%} at {det.bbox}")
        
        detector.cleanup()
    else:
        print("Usage: python sign_detector.py <image_path>")

