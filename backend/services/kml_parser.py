"""
KML Parser Service
Parses NYC Speed Limit Sign KML files to extract sign locations.
"""
import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from pathlib import Path


def parse_nyc_speed_signs(kml_path: str) -> List[Dict[str, Any]]:
    """
    Parse NYC Speed Limit Signs KML file.
    
    KML Structure:
    <Placemark id="49">
        <name>B-01250865</name>
        <description>SR-2191: CITY SPEED LIMIT 25 PHOTO ENFORCED...</description>
        <Point id="48">
            <coordinates>-73.917766,40.693874,0.0</coordinates>
        </Point>
    </Placemark>
    
    Args:
        kml_path: Path to the KML file
        
    Returns:
        List of sign dictionaries with keys:
        - id: Sign ID (e.g., "B-01250865")
        - sign_code: Sign regulation code (e.g., "SR-2191")
        - description: Full description text
        - sign_type: Parsed sign type (e.g., "25mph", "school_zone", etc.)
        - speed_limit: Extracted speed limit value if available
        - longitude: Longitude coordinate
        - latitude: Latitude coordinate
    """
    if not Path(kml_path).exists():
        raise FileNotFoundError(f"KML file not found: {kml_path}")
    
    # Parse the KML file
    tree = ET.parse(kml_path)
    root = tree.getroot()
    
    # Handle KML namespace
    namespaces = {
        'kml': 'http://www.opengis.net/kml/2.2',
        'gx': 'http://www.google.com/kml/ext/2.2'
    }
    
    signs = []
    
    # Find all Placemark elements
    for placemark in root.findall('.//kml:Placemark', namespaces):
        sign = _parse_placemark(placemark, namespaces)
        if sign:
            signs.append(sign)
    
    # If no signs found with namespace, try without namespace
    if not signs:
        for placemark in root.findall('.//Placemark'):
            sign = _parse_placemark(placemark, None)
            if sign:
                signs.append(sign)
    
    return signs


def _parse_placemark(placemark: ET.Element, namespaces: Optional[Dict]) -> Optional[Dict[str, Any]]:
    """Parse a single Placemark element."""
    try:
        # Get name (sign ID)
        if namespaces:
            name_elem = placemark.find('kml:name', namespaces)
            desc_elem = placemark.find('kml:description', namespaces)
            coord_elem = placemark.find('.//kml:coordinates', namespaces)
        else:
            name_elem = placemark.find('name')
            desc_elem = placemark.find('description')
            coord_elem = placemark.find('.//coordinates')
        
        if name_elem is None or coord_elem is None:
            return None
        
        sign_id = name_elem.text.strip() if name_elem.text else ""
        description = desc_elem.text.strip() if desc_elem is not None and desc_elem.text else ""
        
        # Parse coordinates (lon,lat,alt)
        coords_text = coord_elem.text.strip() if coord_elem.text else ""
        coords = coords_text.split(',')
        
        if len(coords) < 2:
            return None
        
        longitude = float(coords[0])
        latitude = float(coords[1])
        
        # Parse sign code and type from description
        sign_code = _extract_sign_code(description)
        sign_type = _classify_sign_type(description)
        speed_limit = _extract_speed_limit(description)
        
        return {
            'id': sign_id,
            'sign_code': sign_code,
            'description': description,
            'sign_type': sign_type,
            'speed_limit': speed_limit,
            'longitude': longitude,
            'latitude': latitude
        }
        
    except (ValueError, AttributeError) as e:
        return None


def _extract_sign_code(description: str) -> str:
    """Extract sign regulation code (e.g., SR-2191) from description."""
    match = re.match(r'^(SR-\d+|SW-\d+|SI-\d+[A-Z]?):', description)
    return match.group(1) if match else ""


def _extract_speed_limit(description: str) -> Optional[int]:
    """Extract speed limit value from description."""
    # Match patterns like "SPEED LIMIT 25", "SPEED LIMIT 20", etc.
    match = re.search(r'SPEED LIMIT\s*(\d+)', description, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _classify_sign_type(description: str) -> str:
    """Classify the sign type based on description."""
    desc_upper = description.upper()
    
    if 'SCHOOL' in desc_upper:
        if 'END SCHOOL' in desc_upper:
            return 'school_zone_end'
        return 'school_zone'
    elif 'NEIGHBORHOOD SLOW ZONE' in desc_upper:
        return 'slow_zone'
    elif 'PHOTO ENFORCED' in desc_upper:
        return 'photo_enforced'
    elif 'SPEED LIMIT' in desc_upper:
        # Try to get the speed value
        match = re.search(r'SPEED LIMIT\s*(\d+)', desc_upper)
        if match:
            return f"speed_{match.group(1)}"
        return 'speed_limit'
    else:
        return 'other'


def get_sign_type_label(sign_type: str) -> str:
    """Get human-readable label for sign type."""
    labels = {
        'school_zone': 'School Zone',
        'school_zone_end': 'End School Zone',
        'slow_zone': 'Slow Zone',
        'photo_enforced': 'Photo Enforced',
        'speed_10': 'Speed Limit 10',
        'speed_15': 'Speed Limit 15',
        'speed_20': 'Speed Limit 20',
        'speed_25': 'Speed Limit 25',
        'speed_30': 'Speed Limit 30',
        'speed_35': 'Speed Limit 35',
        'speed_limit': 'Speed Limit',
        'other': 'Other'
    }
    return labels.get(sign_type, sign_type)


def signs_to_geojson(signs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert sign list to GeoJSON FeatureCollection."""
    features = []
    
    for sign in signs:
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [sign['longitude'], sign['latitude']]
            },
            'properties': {
                'id': sign['id'],
                'sign_code': sign['sign_code'],
                'description': sign['description'],
                'sign_type': sign['sign_type'],
                'speed_limit': sign['speed_limit']
            }
        }
        features.append(feature)
    
    return {
        'type': 'FeatureCollection',
        'features': features
    }


def get_sign_stats(signs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Get statistics about the signs."""
    stats = {
        'total': len(signs),
        'by_type': {},
        'by_speed': {}
    }
    
    for sign in signs:
        # Count by type
        sign_type = sign['sign_type']
        stats['by_type'][sign_type] = stats['by_type'].get(sign_type, 0) + 1
        
        # Count by speed limit
        speed = sign['speed_limit']
        if speed:
            speed_key = f"{speed}mph"
            stats['by_speed'][speed_key] = stats['by_speed'].get(speed_key, 0) + 1
    
    return stats


# Module test
if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python kml_parser.py <kml_file>")
        sys.exit(1)
    
    kml_file = sys.argv[1]
    signs = parse_nyc_speed_signs(kml_file)
    
    print(f"Total signs: {len(signs)}")
    
    stats = get_sign_stats(signs)
    print("\nBy type:")
    for sign_type, count in sorted(stats['by_type'].items(), key=lambda x: -x[1]):
        print(f"  {sign_type}: {count}")
    
    print("\nBy speed limit:")
    for speed, count in sorted(stats['by_speed'].items(), key=lambda x: -x[1]):
        print(f"  {speed}: {count}")
    
    print("\nSample signs:")
    for sign in signs[:3]:
        print(f"  {sign['id']}: {sign['description'][:50]}... @ ({sign['latitude']:.6f}, {sign['longitude']:.6f})")

