"""
Coverage Analyzer Service
Analyzes coverage between NYC official speed sign database and our YOLO detections.
"""
import math
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass


@dataclass
class MatchResult:
    """Result of matching analysis."""
    matched: List[Dict[str, Any]]       # NYC signs that we also detected
    undetected: List[Dict[str, Any]]    # NYC signs that we missed
    new_findings: List[Dict[str, Any]]  # Our detections not in NYC DB
    
    # Statistics
    total_nyc: int
    total_detections: int
    match_count: int
    undetected_count: int
    new_findings_count: int
    coverage_percent: float


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    
    Args:
        lat1, lon1: First point coordinates (degrees)
        lat2, lon2: Second point coordinates (degrees)
        
    Returns:
        Distance in meters
    """
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def analyze_coverage(
    nyc_signs: List[Dict[str, Any]],
    our_detections: List[Dict[str, Any]],
    radius_meters: float = 50.0
) -> MatchResult:
    """
    Analyze coverage between NYC official database and our detections.
    
    Matching logic:
    - For each NYC sign, find if any of our detections are within radius_meters
    - For each of our detections, check if it matches any NYC sign
    
    Args:
        nyc_signs: List of NYC official signs with 'latitude', 'longitude' keys
        our_detections: List of our detections with 'latitude', 'longitude' keys
        radius_meters: Match radius in meters (default 50m)
        
    Returns:
        MatchResult with matched, undetected, and new_findings lists
    """
    matched = []
    undetected = []
    new_findings = []
    
    # Track which detections have been matched
    matched_detection_indices = set()
    
    # For each NYC sign, find matching detections
    for nyc_sign in nyc_signs:
        nyc_lat = nyc_sign['latitude']
        nyc_lon = nyc_sign['longitude']
        
        # Find closest detection within radius
        closest_detection = None
        closest_distance = float('inf')
        closest_idx = -1
        
        for idx, detection in enumerate(our_detections):
            det_lat = detection['latitude']
            det_lon = detection['longitude']
            
            distance = haversine_distance(nyc_lat, nyc_lon, det_lat, det_lon)
            
            if distance <= radius_meters and distance < closest_distance:
                closest_distance = distance
                closest_detection = detection
                closest_idx = idx
        
        if closest_detection:
            # Found a match
            matched_sign = {
                **nyc_sign,
                'match_status': 'matched',
                'match_distance': closest_distance,
                'matched_detection': {
                    'latitude': closest_detection['latitude'],
                    'longitude': closest_detection['longitude'],
                    'class_name': closest_detection.get('class_name', ''),
                    'confidence': closest_detection.get('confidence', 0)
                }
            }
            matched.append(matched_sign)
            matched_detection_indices.add(closest_idx)
        else:
            # No match found - undetected
            undetected_sign = {
                **nyc_sign,
                'match_status': 'undetected'
            }
            undetected.append(undetected_sign)
    
    # Find new findings (our detections not matching any NYC sign)
    for idx, detection in enumerate(our_detections):
        if idx not in matched_detection_indices:
            # Check if this detection is far from all NYC signs
            is_new = True
            min_distance = float('inf')
            
            for nyc_sign in nyc_signs:
                distance = haversine_distance(
                    detection['latitude'], detection['longitude'],
                    nyc_sign['latitude'], nyc_sign['longitude']
                )
                min_distance = min(min_distance, distance)
                if distance <= radius_meters:
                    is_new = False
                    break
            
            if is_new:
                new_finding = {
                    'latitude': detection['latitude'],
                    'longitude': detection['longitude'],
                    'class_name': detection.get('class_name', ''),
                    'confidence': detection.get('confidence', 0),
                    'file_path': detection.get('file_path', ''),
                    'match_status': 'new_finding',
                    'nearest_nyc_distance': min_distance if min_distance != float('inf') else None
                }
                new_findings.append(new_finding)
    
    # Calculate statistics
    total_nyc = len(nyc_signs)
    coverage_percent = (len(matched) / total_nyc * 100) if total_nyc > 0 else 0
    
    return MatchResult(
        matched=matched,
        undetected=undetected,
        new_findings=new_findings,
        total_nyc=total_nyc,
        total_detections=len(our_detections),
        match_count=len(matched),
        undetected_count=len(undetected),
        new_findings_count=len(new_findings),
        coverage_percent=coverage_percent
    )


def cluster_detections(
    detections: List[Dict[str, Any]],
    cluster_radius: float = 30.0
) -> List[Dict[str, Any]]:
    """
    Cluster nearby detections to deduplicate multiple detections of the same sign.
    
    Many images might capture the same sign from different positions,
    resulting in multiple detections. This function clusters them.
    
    Args:
        detections: List of detections with 'latitude', 'longitude'
        cluster_radius: Radius in meters for clustering
        
    Returns:
        List of clustered detections (centroids)
    """
    if not detections:
        return []
    
    # Simple greedy clustering
    clusters = []
    used = [False] * len(detections)
    
    for i, det in enumerate(detections):
        if used[i]:
            continue
        
        # Start new cluster
        cluster_points = [det]
        used[i] = True
        
        # Find all nearby detections
        for j, other in enumerate(detections):
            if used[j]:
                continue
            
            distance = haversine_distance(
                det['latitude'], det['longitude'],
                other['latitude'], other['longitude']
            )
            
            if distance <= cluster_radius:
                cluster_points.append(other)
                used[j] = True
        
        # Calculate cluster centroid
        avg_lat = sum(p['latitude'] for p in cluster_points) / len(cluster_points)
        avg_lon = sum(p['longitude'] for p in cluster_points) / len(cluster_points)
        
        # Use highest confidence detection's metadata
        best = max(cluster_points, key=lambda x: x.get('confidence', 0))
        
        cluster = {
            'latitude': avg_lat,
            'longitude': avg_lon,
            'class_name': best.get('class_name', ''),
            'confidence': best.get('confidence', 0),
            'detection_count': len(cluster_points),
            'file_path': best.get('file_path', '')
        }
        clusters.append(cluster)
    
    return clusters


def result_to_geojson(result: MatchResult) -> Dict[str, Any]:
    """Convert MatchResult to GeoJSON FeatureCollection with all points."""
    features = []
    
    # Add matched signs (green)
    for sign in result.matched:
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [sign['longitude'], sign['latitude']]
            },
            'properties': {
                'id': sign.get('id', ''),
                'status': 'matched',
                'sign_type': sign.get('sign_type', ''),
                'description': sign.get('description', ''),
                'match_distance': sign.get('match_distance', 0),
                'color': '#22c55e'  # green
            }
        }
        features.append(feature)
    
    # Add undetected signs (red)
    for sign in result.undetected:
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [sign['longitude'], sign['latitude']]
            },
            'properties': {
                'id': sign.get('id', ''),
                'status': 'undetected',
                'sign_type': sign.get('sign_type', ''),
                'description': sign.get('description', ''),
                'color': '#ef4444'  # red
            }
        }
        features.append(feature)
    
    # Add new findings (yellow/amber)
    for det in result.new_findings:
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [det['longitude'], det['latitude']]
            },
            'properties': {
                'status': 'new_finding',
                'class_name': det.get('class_name', ''),
                'confidence': det.get('confidence', 0),
                'nearest_nyc_distance': det.get('nearest_nyc_distance'),
                'color': '#eab308'  # yellow
            }
        }
        features.append(feature)
    
    return {
        'type': 'FeatureCollection',
        'features': features
    }


def get_coverage_stats(result: MatchResult) -> Dict[str, Any]:
    """Get summary statistics from MatchResult."""
    return {
        'total_nyc_signs': result.total_nyc,
        'total_our_detections': result.total_detections,
        'matched': result.match_count,
        'undetected': result.undetected_count,
        'new_findings': result.new_findings_count,
        'coverage_percent': round(result.coverage_percent, 1),
        'summary': {
            'nyc_coverage': f"{result.match_count}/{result.total_nyc} ({result.coverage_percent:.1f}%)",
            'potential_new': f"{result.new_findings_count} signs not in NYC DB"
        }
    }

