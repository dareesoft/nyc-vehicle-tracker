"""
Trip Builder Service
Groups images into logical trips and generates GeoJSON for visualization.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import json


@dataclass
class TripSegment:
    """Represents a segment of a trip on a single link."""
    link_id: int
    forward: bool
    points: List[Dict[str, Any]]
    start_time: str
    end_time: str


def build_geojson_route(trip_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build a GeoJSON FeatureCollection from trip data.
    Creates a LineString for the route and Points for each image location.
    """
    if not trip_data:
        return {"type": "FeatureCollection", "features": []}
    
    features = []
    
    # Build the route LineString
    coordinates = []
    for point in trip_data:
        coordinates.append([point['longitude'], point['latitude']])
    
    if len(coordinates) >= 2:
        route_feature = {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            },
            "properties": {
                "type": "route",
                "device_id": trip_data[0].get('device_id'),
                "start_time": trip_data[0].get('timestamp'),
                "end_time": trip_data[-1].get('timestamp'),
                "point_count": len(trip_data)
            }
        }
        features.append(route_feature)
    
    # Build individual point features
    for idx, point in enumerate(trip_data):
        point_feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [point['longitude'], point['latitude']]
            },
            "properties": {
                "type": "image_point",
                "index": idx,
                "file_path": point.get('file_path'),
                "timestamp": point.get('timestamp'),
                "link_id": point.get('link_id'),
                "forward": point.get('forward'),
                "camera_type": point.get('camera_type'),
                "device_id": point.get('device_id')
            }
        }
        features.append(point_feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def build_link_network_geojson(links_data: List[Dict[str, Any]], cache) -> Dict[str, Any]:
    """
    Build a GeoJSON FeatureCollection for the road link network.
    Each link becomes a LineString feature.
    """
    features = []
    
    for link in links_data:
        link_id = link['link_id']
        path = cache.get_link_path(link_id)
        
        if len(path) >= 2:
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": path
                },
                "properties": {
                    "link_id": link_id,
                    "point_count": link['point_count'],
                    "center": link['center']
                }
            }
            features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def calculate_trip_stats(trip_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate statistics for a trip."""
    if not trip_data:
        return {}
    
    # Calculate bounding box
    lats = [p['latitude'] for p in trip_data]
    lons = [p['longitude'] for p in trip_data]
    
    # Count unique links
    link_ids = set(p.get('link_id') for p in trip_data if p.get('link_id'))
    
    # Calculate time duration
    start_time = trip_data[0].get('timestamp', '')
    end_time = trip_data[-1].get('timestamp', '')
    
    return {
        "total_images": len(trip_data),
        "unique_links": len(link_ids),
        "start_time": start_time,
        "end_time": end_time,
        "bounds": {
            "north": max(lats),
            "south": min(lats),
            "east": max(lons),
            "west": min(lons)
        },
        "center": {
            "latitude": sum(lats) / len(lats),
            "longitude": sum(lons) / len(lons)
        }
    }


def segment_trip_by_links(trip_data: List[Dict[str, Any]]) -> List[TripSegment]:
    """
    Segment a trip by link_id changes.
    Useful for 3D visualization of road segments.
    """
    if not trip_data:
        return []
    
    segments = []
    current_link = None
    current_points = []
    
    for point in trip_data:
        link_id = point.get('link_id')
        
        if link_id != current_link and current_points:
            # Save current segment
            segments.append(TripSegment(
                link_id=current_link,
                forward=current_points[0].get('forward', True),
                points=current_points,
                start_time=current_points[0].get('timestamp', ''),
                end_time=current_points[-1].get('timestamp', '')
            ))
            current_points = []
        
        current_link = link_id
        current_points.append(point)
    
    # Don't forget the last segment
    if current_points and current_link:
        segments.append(TripSegment(
            link_id=current_link,
            forward=current_points[0].get('forward', True),
            points=current_points,
            start_time=current_points[0].get('timestamp', ''),
            end_time=current_points[-1].get('timestamp', '')
        ))
    
    return segments


def build_3d_path_data(trip_data: List[Dict[str, Any]], base_elevation: float = 0) -> List[Dict[str, Any]]:
    """
    Build path data suitable for deck.gl PathLayer with 3D coordinates.
    Groups consecutive points by link_id for segment coloring.
    """
    segments = segment_trip_by_links(trip_data)
    
    path_data = []
    for idx, segment in enumerate(segments):
        if not segment.points:
            continue
        
        # Build 3D path coordinates [lng, lat, elevation]
        path = []
        for point in segment.points:
            # Use link_id as a factor for elevation variation (visual effect)
            elevation = base_elevation + (segment.link_id % 100) * 0.5 if segment.link_id else base_elevation
            path.append([point['longitude'], point['latitude'], elevation])
        
        path_data.append({
            "path": path,
            "link_id": segment.link_id,
            "forward": segment.forward,
            "color": get_link_color(segment.link_id, segment.forward),
            "width": 3,
            "start_time": segment.start_time,
            "end_time": segment.end_time
        })
    
    return path_data


def get_link_color(link_id: Optional[int], forward: bool) -> List[int]:
    """
    Generate a consistent color for a link_id.
    Uses cyberpunk color palette.
    """
    if link_id is None:
        return [100, 100, 100, 200]  # Gray for unknown links
    
    # Cyberpunk colors: cyan, magenta, yellow variations
    colors = [
        [0, 255, 247, 200],    # Cyan
        [255, 0, 255, 200],    # Magenta
        [255, 255, 0, 200],    # Yellow
        [0, 255, 128, 200],    # Green-cyan
        [255, 128, 0, 200],    # Orange
        [128, 0, 255, 200],    # Purple
    ]
    
    color_idx = link_id % len(colors)
    color = colors[color_idx].copy()
    
    # Darken if going backward
    if not forward:
        color = [int(c * 0.7) for c in color[:3]] + [color[3]]
    
    return color

