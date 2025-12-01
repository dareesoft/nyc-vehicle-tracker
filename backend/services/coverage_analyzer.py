"""
Coverage Analyzer Service
Analyzes coverage between NYC official speed sign database and our YOLO detections.

Supported Matching Algorithms:
- greedy_nearest: NYC-centric greedy matching (fast, non-optimal)
- hungarian: Global optimal bipartite matching using Hungarian algorithm
- mutual_nearest: Conservative matching - only when both agree on nearest

Optimized with:
- KD-Tree (scipy.spatial.cKDTree) for O(n log m) spatial queries
- File path deduplication to prevent same image matching multiple signs
"""
import math
import numpy as np
from typing import List, Dict, Any, Tuple, Optional, Literal
from dataclasses import dataclass
from functools import lru_cache
import time

try:
    from scipy.spatial import cKDTree
    from scipy.optimize import linear_sum_assignment
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    print("Warning: scipy not available, using naive algorithm")

# Color constants
COLORS = {
    'matched': '#3b82f6',    # Blue
    'undetected': '#ef4444', # Red
    'new_finding': '#eab308' # Yellow
}

# Supported algorithms
MATCHING_ALGORITHMS = ['greedy_nearest', 'hungarian', 'mutual_nearest']
AlgorithmType = Literal['greedy_nearest', 'hungarian', 'mutual_nearest']


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
    processing_time_ms: float = 0
    algorithm: str = 'greedy_nearest'


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


def coords_to_cartesian(coords: np.ndarray) -> np.ndarray:
    """
    Convert lat/lon coordinates to 3D Cartesian coordinates for KD-Tree.
    
    Args:
        coords: numpy array of shape (n, 2) with [lat, lon] rows
        
    Returns:
        numpy array of shape (n, 3) with [x, y, z] rows on unit sphere
    """
    lat_rad = np.radians(coords[:, 0])
    lon_rad = np.radians(coords[:, 1])
    
    x = np.cos(lat_rad) * np.cos(lon_rad)
    y = np.cos(lat_rad) * np.sin(lon_rad)
    z = np.sin(lat_rad)
    
    return np.column_stack([x, y, z])


def meters_to_chord_length(meters: float, earth_radius: float = 6371000) -> float:
    """
    Convert distance in meters to chord length on unit sphere.
    
    For small distances, chord ≈ arc, so we use: chord = 2 * sin(arc / (2 * R))
    """
    arc_radians = meters / earth_radius
    return 2 * np.sin(arc_radians / 2)


def _build_detection_dict(detection: Dict[str, Any]) -> Dict[str, Any]:
    """Build matched_detection dictionary with all fields."""
    return {
        'latitude': detection['latitude'],
        'longitude': detection['longitude'],
        'class_name': detection.get('class_name', ''),
        'confidence': detection.get('confidence', 0),
        'file_path': detection.get('file_path', ''),
        'bbox_x1': detection.get('bbox_x1'),
        'bbox_y1': detection.get('bbox_y1'),
        'bbox_x2': detection.get('bbox_x2'),
        'bbox_y2': detection.get('bbox_y2')
    }


def _compute_distance_matrix(
    nyc_signs: List[Dict[str, Any]],
    detections: List[Dict[str, Any]]
) -> np.ndarray:
    """
    Compute distance matrix between all NYC signs and detections.
    
    Returns:
        numpy array of shape (len(nyc_signs), len(detections)) with distances in meters
    """
    n_nyc = len(nyc_signs)
    n_det = len(detections)
    
    distances = np.zeros((n_nyc, n_det))
    
    for i, nyc in enumerate(nyc_signs):
        for j, det in enumerate(detections):
            distances[i, j] = haversine_distance(
                nyc['latitude'], nyc['longitude'],
                det['latitude'], det['longitude']
            )
    
    return distances


def match_greedy_nearest(
    nyc_signs: List[Dict[str, Any]],
    detections: List[Dict[str, Any]],
    radius_meters: float,
    nyc_tree: 'cKDTree',
    det_tree: 'cKDTree',
    chord_radius: float
) -> Tuple[List[Dict], List[Dict], set]:
    """
    Greedy Nearest matching algorithm.
    
    For each NYC sign, find the closest UNUSED detection within radius.
    Ensures 1:1 matching - each detection can only match one NYC sign.
    Also prevents same file_path from being used multiple times.
    
    Returns:
        (matched_signs, undetected_signs, matched_detection_indices)
    """
    # Find all potential matches using KD-Tree
    matches_per_nyc = nyc_tree.query_ball_tree(det_tree, chord_radius)
    
    matched = []
    undetected = []
    matched_detection_indices = set()
    used_file_paths = set()  # Prevent same file matching multiple signs
    
    # Sort NYC signs by number of potential matches (fewer matches first)
    # This helps ensure signs with limited options get matched first
    nyc_with_indices = [(i, len(matches_per_nyc[i])) for i in range(len(nyc_signs))]
    nyc_with_indices.sort(key=lambda x: x[1])
    
    for i, _ in nyc_with_indices:
        nyc_sign = nyc_signs[i]
        detection_indices = matches_per_nyc[i]
        
        if not detection_indices:
            undetected.append({
                **nyc_sign,
                'match_status': 'undetected'
            })
            continue
        
        # Find closest UNUSED detection
        best_idx = None
        best_distance = float('inf')
        
        for det_idx in detection_indices:
            # Skip if already used
            if det_idx in matched_detection_indices:
                continue
            
            # Skip if file_path already used
            file_path = detections[det_idx].get('file_path', '')
            if file_path and file_path in used_file_paths:
                continue
            
            dist = haversine_distance(
                nyc_sign['latitude'], nyc_sign['longitude'],
                detections[det_idx]['latitude'], detections[det_idx]['longitude']
            )
            
            if dist < best_distance:
                best_distance = dist
                best_idx = det_idx
        
        if best_idx is not None:
            matched_sign = {
                **nyc_sign,
                'match_status': 'matched',
                'match_distance': best_distance,
                'matched_detection': _build_detection_dict(detections[best_idx])
            }
            matched.append(matched_sign)
            matched_detection_indices.add(best_idx)
            
            # Track used file_path
            file_path = detections[best_idx].get('file_path', '')
            if file_path:
                used_file_paths.add(file_path)
        else:
            undetected.append({
                **nyc_sign,
                'match_status': 'undetected'
            })
    
    return matched, undetected, matched_detection_indices


def match_hungarian(
    nyc_signs: List[Dict[str, Any]],
    detections: List[Dict[str, Any]],
    radius_meters: float
) -> Tuple[List[Dict], List[Dict], set]:
    """
    Hungarian Algorithm for globally optimal bipartite matching.
    
    Uses scipy.optimize.linear_sum_assignment to find the assignment
    that minimizes total distance while ensuring 1:1 matching.
    
    Returns:
        (matched_signs, undetected_signs, matched_detection_indices)
    """
    if not HAS_SCIPY:
        raise RuntimeError("Hungarian algorithm requires scipy")
    
    n_nyc = len(nyc_signs)
    n_det = len(detections)
    
    # Compute distance matrix
    distance_matrix = _compute_distance_matrix(nyc_signs, detections)
    
    # Set distances beyond radius to a very large value (effectively infinite)
    # This prevents matches beyond the radius threshold
    INF = 1e9
    cost_matrix = np.where(distance_matrix <= radius_meters, distance_matrix, INF)
    
    # Build file_path constraint matrix
    # Detections with same file_path should only allow one match
    file_paths = [d.get('file_path', '') for d in detections]
    file_path_groups = {}
    for idx, fp in enumerate(file_paths):
        if fp:
            if fp not in file_path_groups:
                file_path_groups[fp] = []
            file_path_groups[fp].append(idx)
    
    # For file_path constraint, we'll handle it post-assignment
    # Run Hungarian algorithm
    row_ind, col_ind = linear_sum_assignment(cost_matrix)
    
    matched = []
    undetected = []
    matched_detection_indices = set()
    used_file_paths = set()
    
    # Create assignment pairs sorted by cost (closest first)
    assignments = []
    for nyc_idx, det_idx in zip(row_ind, col_ind):
        cost = cost_matrix[nyc_idx, det_idx]
        if cost < INF:  # Valid match within radius
            assignments.append((nyc_idx, det_idx, cost))
    
    # Sort by distance to prioritize closer matches for file_path conflicts
    assignments.sort(key=lambda x: x[2])
    
    matched_nyc_indices = set()
    
    for nyc_idx, det_idx, distance in assignments:
        file_path = detections[det_idx].get('file_path', '')
        
        # Skip if file_path already used
        if file_path and file_path in used_file_paths:
            continue
        
        # Skip if NYC sign already matched (shouldn't happen with Hungarian, but safety check)
        if nyc_idx in matched_nyc_indices:
            continue
        
        matched_sign = {
            **nyc_signs[nyc_idx],
            'match_status': 'matched',
            'match_distance': distance,
            'matched_detection': _build_detection_dict(detections[det_idx])
        }
        matched.append(matched_sign)
        matched_detection_indices.add(det_idx)
        matched_nyc_indices.add(nyc_idx)
        
        if file_path:
            used_file_paths.add(file_path)
    
    # Find undetected NYC signs
    for i, nyc_sign in enumerate(nyc_signs):
        if i not in matched_nyc_indices:
            undetected.append({
                **nyc_sign,
                'match_status': 'undetected'
            })
    
    return matched, undetected, matched_detection_indices


def match_mutual_nearest(
    nyc_signs: List[Dict[str, Any]],
    detections: List[Dict[str, Any]],
    radius_meters: float,
    nyc_tree: 'cKDTree',
    det_tree: 'cKDTree',
    det_cartesian: np.ndarray,
    nyc_cartesian: np.ndarray
) -> Tuple[List[Dict], List[Dict], set]:
    """
    Mutual Nearest Neighbor matching algorithm.
    
    A match is only made when:
    1. Detection D is the nearest to NYC sign N (among all detections within radius)
    2. NYC sign N is the nearest to Detection D (among all NYC signs within radius)
    
    This is the most conservative algorithm - only matches when both sides agree.
    
    Returns:
        (matched_signs, undetected_signs, matched_detection_indices)
    """
    chord_radius = meters_to_chord_length(radius_meters)
    
    # For each NYC sign, find nearest detection
    nyc_to_nearest_det = {}
    for i, nyc_sign in enumerate(nyc_signs):
        dist, nearest_det_idx = det_tree.query(nyc_cartesian[i])
        actual_dist = haversine_distance(
            nyc_sign['latitude'], nyc_sign['longitude'],
            detections[nearest_det_idx]['latitude'], detections[nearest_det_idx]['longitude']
        )
        if actual_dist <= radius_meters:
            nyc_to_nearest_det[i] = (nearest_det_idx, actual_dist)
    
    # For each detection, find nearest NYC sign
    det_to_nearest_nyc = {}
    for j, det in enumerate(detections):
        dist, nearest_nyc_idx = nyc_tree.query(det_cartesian[j])
        actual_dist = haversine_distance(
            det['latitude'], det['longitude'],
            nyc_signs[nearest_nyc_idx]['latitude'], nyc_signs[nearest_nyc_idx]['longitude']
        )
        if actual_dist <= radius_meters:
            det_to_nearest_nyc[j] = (nearest_nyc_idx, actual_dist)
    
    # Find mutual matches
    matched = []
    undetected = []
    matched_detection_indices = set()
    matched_nyc_indices = set()
    used_file_paths = set()
    
    # Collect mutual pairs with distances
    mutual_pairs = []
    for nyc_idx, (det_idx, dist) in nyc_to_nearest_det.items():
        if det_idx in det_to_nearest_nyc:
            nearest_nyc_for_det, _ = det_to_nearest_nyc[det_idx]
            if nearest_nyc_for_det == nyc_idx:
                # Mutual nearest neighbor!
                mutual_pairs.append((nyc_idx, det_idx, dist))
    
    # Sort by distance to handle file_path conflicts
    mutual_pairs.sort(key=lambda x: x[2])
    
    for nyc_idx, det_idx, distance in mutual_pairs:
        file_path = detections[det_idx].get('file_path', '')
        
        # Skip if file_path already used
        if file_path and file_path in used_file_paths:
            continue
        
        # Skip if either side already matched
        if nyc_idx in matched_nyc_indices or det_idx in matched_detection_indices:
            continue
        
        matched_sign = {
            **nyc_signs[nyc_idx],
            'match_status': 'matched',
            'match_distance': distance,
            'matched_detection': _build_detection_dict(detections[det_idx])
        }
        matched.append(matched_sign)
        matched_detection_indices.add(det_idx)
        matched_nyc_indices.add(nyc_idx)
        
        if file_path:
            used_file_paths.add(file_path)
    
    # Find undetected NYC signs
    for i, nyc_sign in enumerate(nyc_signs):
        if i not in matched_nyc_indices:
            undetected.append({
                **nyc_sign,
                'match_status': 'undetected'
            })
    
    return matched, undetected, matched_detection_indices


def analyze_coverage(
    nyc_signs: List[Dict[str, Any]],
    our_detections: List[Dict[str, Any]],
    radius_meters: float = 50.0,
    algorithm: AlgorithmType = 'greedy_nearest'
) -> MatchResult:
    """
    Analyze coverage between NYC signs and our detections.
    
    Args:
        nyc_signs: List of NYC sign dictionaries with 'latitude', 'longitude'
        our_detections: List of our detection dictionaries
        radius_meters: Maximum distance for a match (default 50m)
        algorithm: Matching algorithm to use:
            - 'greedy_nearest': Fast greedy matching (default)
            - 'hungarian': Globally optimal matching
            - 'mutual_nearest': Conservative mutual nearest neighbor
    
    Returns:
        MatchResult with matched, undetected, and new_findings lists
    """
    start_time = time.time()
    
    if algorithm not in MATCHING_ALGORITHMS:
        raise ValueError(f"Unknown algorithm: {algorithm}. Must be one of {MATCHING_ALGORITHMS}")
    
    if not nyc_signs or not our_detections:
        return MatchResult(
            matched=[], undetected=list(nyc_signs), new_findings=[],
            total_nyc=len(nyc_signs), total_detections=len(our_detections),
            match_count=0, undetected_count=len(nyc_signs),
            new_findings_count=0, coverage_percent=0,
            processing_time_ms=0, algorithm=algorithm
        )
    
    # Convert to numpy arrays
    nyc_coords = np.array([[s['latitude'], s['longitude']] for s in nyc_signs])
    det_coords = np.array([[d['latitude'], d['longitude']] for d in our_detections])
    
    # Convert to 3D Cartesian for KD-Tree
    nyc_cartesian = coords_to_cartesian(nyc_coords)
    det_cartesian = coords_to_cartesian(det_coords)
    
    # Build KD-Trees
    nyc_tree = cKDTree(nyc_cartesian) if HAS_SCIPY else None
    det_tree = cKDTree(det_cartesian) if HAS_SCIPY else None
    
    chord_radius = meters_to_chord_length(radius_meters)
    
    # Run selected matching algorithm
    if algorithm == 'greedy_nearest':
        if not HAS_SCIPY:
            return analyze_coverage_naive(nyc_signs, our_detections, radius_meters)
        matched, undetected, matched_det_indices = match_greedy_nearest(
            nyc_signs, our_detections, radius_meters,
            nyc_tree, det_tree, chord_radius
        )
    elif algorithm == 'hungarian':
        matched, undetected, matched_det_indices = match_hungarian(
            nyc_signs, our_detections, radius_meters
        )
    elif algorithm == 'mutual_nearest':
        if not HAS_SCIPY:
            return analyze_coverage_naive(nyc_signs, our_detections, radius_meters)
        matched, undetected, matched_det_indices = match_mutual_nearest(
            nyc_signs, our_detections, radius_meters,
            nyc_tree, det_tree, det_cartesian, nyc_cartesian
        )
    
    # Find new findings: detections not matched and not within radius of any NYC sign
    new_findings = []
    if HAS_SCIPY:
        matches_per_det = det_tree.query_ball_tree(nyc_tree, chord_radius)
        
        for i, nyc_indices in enumerate(matches_per_det):
            if i not in matched_det_indices and not nyc_indices:
                detection = our_detections[i]
                
                # Find nearest NYC sign distance (for reference)
                dist, nearest_idx = nyc_tree.query(det_cartesian[i])
                nearest_meters = haversine_distance(
                    detection['latitude'], detection['longitude'],
                    nyc_signs[nearest_idx]['latitude'], nyc_signs[nearest_idx]['longitude']
                )
                
                new_finding = {
                    'latitude': detection['latitude'],
                    'longitude': detection['longitude'],
                    'class_name': detection.get('class_name', ''),
                    'confidence': detection.get('confidence', 0),
                    'file_path': detection.get('file_path', ''),
                    'bbox_x1': detection.get('bbox_x1'),
                    'bbox_y1': detection.get('bbox_y1'),
                    'bbox_x2': detection.get('bbox_x2'),
                    'bbox_y2': detection.get('bbox_y2'),
                    'match_status': 'new_finding',
                    'nearest_nyc_distance': nearest_meters
                }
                new_findings.append(new_finding)
    else:
        # Naive approach for new findings
        for idx, detection in enumerate(our_detections):
            if idx not in matched_det_indices:
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
                        'bbox_x1': detection.get('bbox_x1'),
                        'bbox_y1': detection.get('bbox_y1'),
                        'bbox_x2': detection.get('bbox_x2'),
                        'bbox_y2': detection.get('bbox_y2'),
                        'match_status': 'new_finding',
                        'nearest_nyc_distance': min_distance if min_distance != float('inf') else None
                    }
                    new_findings.append(new_finding)
    
    processing_time_ms = (time.time() - start_time) * 1000
    
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
        coverage_percent=coverage_percent,
        processing_time_ms=processing_time_ms,
        algorithm=algorithm
    )


def analyze_coverage_naive(
    nyc_signs: List[Dict[str, Any]],
    our_detections: List[Dict[str, Any]],
    radius_meters: float = 50.0
) -> MatchResult:
    """
    Original naive O(n*m) algorithm as fallback.
    Includes file_path deduplication.
    """
    start_time = time.time()
    
    matched = []
    undetected = []
    new_findings = []
    
    matched_detection_indices = set()
    used_file_paths = set()
    
    # Sort NYC signs by number of nearby detections (approximated by iterating)
    for nyc_sign in nyc_signs:
        nyc_lat = nyc_sign['latitude']
        nyc_lon = nyc_sign['longitude']
        
        closest_detection = None
        closest_distance = float('inf')
        closest_idx = -1
        
        for idx, detection in enumerate(our_detections):
            # Skip if already used
            if idx in matched_detection_indices:
                continue
            
            # Skip if file_path already used
            file_path = detection.get('file_path', '')
            if file_path and file_path in used_file_paths:
                continue
            
            det_lat = detection['latitude']
            det_lon = detection['longitude']
            
            distance = haversine_distance(nyc_lat, nyc_lon, det_lat, det_lon)
            
            if distance <= radius_meters and distance < closest_distance:
                closest_distance = distance
                closest_detection = detection
                closest_idx = idx
        
        if closest_detection:
            matched_sign = {
                **nyc_sign,
                'match_status': 'matched',
                'match_distance': closest_distance,
                'matched_detection': _build_detection_dict(closest_detection)
            }
            matched.append(matched_sign)
            matched_detection_indices.add(closest_idx)
            
            file_path = closest_detection.get('file_path', '')
            if file_path:
                used_file_paths.add(file_path)
        else:
            undetected_sign = {
                **nyc_sign,
                'match_status': 'undetected'
            }
            undetected.append(undetected_sign)
    
    for idx, detection in enumerate(our_detections):
        if idx not in matched_detection_indices:
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
                    'bbox_x1': detection.get('bbox_x1'),
                    'bbox_y1': detection.get('bbox_y1'),
                    'bbox_x2': detection.get('bbox_x2'),
                    'bbox_y2': detection.get('bbox_y2'),
                    'match_status': 'new_finding',
                    'nearest_nyc_distance': min_distance if min_distance != float('inf') else None
                }
                new_findings.append(new_finding)
    
    processing_time_ms = (time.time() - start_time) * 1000
    
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
        coverage_percent=coverage_percent,
        processing_time_ms=processing_time_ms,
        algorithm='greedy_nearest'
    )


def cluster_detections_kdtree(
    detections: List[Dict[str, Any]],
    cluster_radius: float = 30.0
) -> List[Dict[str, Any]]:
    """
    Cluster nearby detections using KD-Tree for better performance.
    """
    if not detections:
        return []
    
    if not HAS_SCIPY:
        return cluster_detections_naive(detections, cluster_radius)
    
    # Convert to numpy
    coords = np.array([[d['latitude'], d['longitude']] for d in detections])
    cartesian = coords_to_cartesian(coords)
    
    # Build KD-Tree
    tree = cKDTree(cartesian)
    chord_radius = meters_to_chord_length(cluster_radius)
    
    # Find all pairs within radius
    pairs = tree.query_pairs(chord_radius)
    
    # Union-Find for clustering
    n = len(detections)
    parent = list(range(n))
    
    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]
    
    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py
    
    for i, j in pairs:
        union(i, j)
    
    # Group by cluster
    clusters_dict = {}
    for i in range(n):
        root = find(i)
        if root not in clusters_dict:
            clusters_dict[root] = []
        clusters_dict[root].append(i)
    
    # Create cluster centroids
    clusters = []
    for indices in clusters_dict.values():
        cluster_points = [detections[i] for i in indices]
        
        avg_lat = sum(p['latitude'] for p in cluster_points) / len(cluster_points)
        avg_lon = sum(p['longitude'] for p in cluster_points) / len(cluster_points)
        
        best = max(cluster_points, key=lambda x: x.get('confidence', 0))
        
        cluster = {
            'latitude': avg_lat,
            'longitude': avg_lon,
            'class_name': best.get('class_name', ''),
            'confidence': best.get('confidence', 0),
            'detection_count': len(cluster_points),
            'file_path': best.get('file_path', ''),
            'bbox_x1': best.get('bbox_x1'),
            'bbox_y1': best.get('bbox_y1'),
            'bbox_x2': best.get('bbox_x2'),
            'bbox_y2': best.get('bbox_y2')
        }
        clusters.append(cluster)
    
    return clusters


def cluster_detections_naive(
    detections: List[Dict[str, Any]],
    cluster_radius: float = 30.0
) -> List[Dict[str, Any]]:
    """
    Original naive clustering algorithm as fallback.
    """
    if not detections:
        return []
    
    clusters = []
    used = [False] * len(detections)
    
    for i, det in enumerate(detections):
        if used[i]:
            continue
        
        cluster_points = [det]
        used[i] = True
        
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
        
        avg_lat = sum(p['latitude'] for p in cluster_points) / len(cluster_points)
        avg_lon = sum(p['longitude'] for p in cluster_points) / len(cluster_points)
        
        best = max(cluster_points, key=lambda x: x.get('confidence', 0))
        
        cluster = {
            'latitude': avg_lat,
            'longitude': avg_lon,
            'class_name': best.get('class_name', ''),
            'confidence': best.get('confidence', 0),
            'detection_count': len(cluster_points),
            'file_path': best.get('file_path', ''),
            'bbox_x1': best.get('bbox_x1'),
            'bbox_y1': best.get('bbox_y1'),
            'bbox_x2': best.get('bbox_x2'),
            'bbox_y2': best.get('bbox_y2')
        }
        clusters.append(cluster)
    
    return clusters


def cluster_detections(
    detections: List[Dict[str, Any]],
    cluster_radius: float = 30.0
) -> List[Dict[str, Any]]:
    """
    Cluster nearby detections - uses KD-Tree if available.
    """
    if HAS_SCIPY:
        return cluster_detections_kdtree(detections, cluster_radius)
    else:
        return cluster_detections_naive(detections, cluster_radius)


def result_to_geojson(result: MatchResult) -> Dict[str, Any]:
    """Convert MatchResult to GeoJSON FeatureCollection with all points."""
    features = []
    
    # Add matched signs (blue)
    for sign in result.matched:
        matched_det = sign.get('matched_detection', {})
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
                'class_name': matched_det.get('class_name', ''),
                'confidence': matched_det.get('confidence', 0),
                'file_path': matched_det.get('file_path', ''),
                'detection_lat': matched_det.get('latitude'),
                'detection_lon': matched_det.get('longitude'),
                'bbox_x1': matched_det.get('bbox_x1'),
                'bbox_y1': matched_det.get('bbox_y1'),
                'bbox_x2': matched_det.get('bbox_x2'),
                'bbox_y2': matched_det.get('bbox_y2'),
                'color': COLORS['matched']
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
                'color': COLORS['undetected']
            }
        }
        features.append(feature)
    
    # Add new findings (yellow)
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
                'file_path': det.get('file_path', ''),
                'bbox_x1': det.get('bbox_x1'),
                'bbox_y1': det.get('bbox_y1'),
                'bbox_x2': det.get('bbox_x2'),
                'bbox_y2': det.get('bbox_y2'),
                'color': COLORS['new_finding']
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
        'processing_time_ms': round(result.processing_time_ms, 1),
        'algorithm': result.algorithm,
        'summary': {
            'nyc_coverage': f"{result.match_count}/{result.total_nyc} ({result.coverage_percent:.1f}%)",
            'potential_new': f"{result.new_findings_count} signs not in NYC DB"
        }
    }
