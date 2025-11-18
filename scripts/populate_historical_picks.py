import os
import re
from datetime import datetime, timedelta
from collections import defaultdict
import requests
from urllib.parse import urlparse, parse_qs

# Database connection using environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# User mapping
USER_MAP = {
    'Neil Tilston': '00000000-0000-0000-0000-000000000002',
    'Rory Edwards': '00000000-0000-0000-0000-000000000003',
    'Fergus Neville': '00000000-0000-0000-0000-000000000001',
    'David Thomas': '00000000-0000-0000-0000-000000000004'
}

def parse_date(date_str):
    """Parse date string like '12/15/23, 8:57:33 AM' to datetime"""
    try:
        return datetime.strptime(date_str, '%m/%d/%y, %I:%M:%S %p')
    except:
        return None

def get_week_start(date):
    """Get the Monday of the week containing the given date"""
    return date - timedelta(days=date.weekday())

def extract_spotify_id(url):
    """Extract Spotify track/album ID from URL"""
    match = re.search(r'/(track|album)/([a-zA-Z0-9]+)', url)
    if match:
        return match.group(2), match.group(1)
    return None, None

def fetch_spotify_metadata(url):
    """Fetch metadata from Spotify link via Open Graph tags"""
    try:
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        html = response.text
        
        # Extract title and image from meta tags
        title_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
        image_match = re.search(r'<meta property="og:image" content="([^"]+)"', html)
        
        title = title_match.group(1) if title_match else None
        image = image_match.group(1) if image_match else None
        
        # Parse title to get artist and album/track
        if title:
            # Spotify format is usually "Song/Album · Artist" or "Artist - Song/Album"
            if ' · ' in title:
                parts = title.split(' · ')
                return parts[0].strip(), parts[1].strip() if len(parts) > 1 else '', image
            elif ' - ' in title:
                parts = title.split(' - ', 1)
                return parts[1].strip() if len(parts) > 1 else '', parts[0].strip(), image
        
        return title or '', '', image
    except Exception as e:
        print(f"Error fetching metadata for {url}: {e}")
        return '', '', None

def create_theme(week_start, curator_id):
    """Create a weekly theme"""
    week_end = week_start + timedelta(days=6)
    
    data = {
        'curator_id': curator_id,
        'week_start_date': week_start.strftime('%Y-%m-%d'),
        'week_end_date': week_end.strftime('%Y-%m-%d'),
        'is_active': False
    }
    
    response = requests.post(
        f'{SUPABASE_URL}/rest/v1/weekly_themes',
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        json=data
    )
    
    if response.status_code in [200, 201]:
        return response.json()[0]['id']
    else:
        print(f"Error creating theme: {response.status_code} - {response.text}")
        return None

def insert_pick(pick_data):
    """Insert a music pick into the database"""
    response = requests.post(
        f'{SUPABASE_URL}/rest/v1/music_picks',
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        },
        json=pick_data
    )
    
    if response.status_code not in [200, 201]:
        print(f"Error inserting pick: {response.status_code} - {response.text}")
        return False
    return True

# Parse the data
data_text = """
# Paste the table data here or read from file
"""

# For now, I'll create a structure to handle the data
# You would parse the actual markdown table

def main():
    print("Starting historical data population...")
    
    # Group picks by week
    weeks = defaultdict(list)
    
    # This would be populated by parsing the markdown table
    # Format: (date, person, type, url)
    historical_picks = []
    
    # Parse and group by week
    for date_str, person, pick_type, url in historical_picks:
        date = parse_date(date_str)
        if not date:
            continue
            
        week_start = get_week_start(date)
        weeks[week_start].append({
            'date': date,
            'person': person,
            'type': pick_type,
            'url': url
        })
    
    # Process each week
    for week_start in sorted(weeks.keys()):
        picks = weeks[week_start]
        
        # Determine curator (person who posted first album of the week)
        album_picks = [p for p in picks if p['type'] == 'album']
        curator_name = album_picks[0]['person'] if album_picks else picks[0]['person']
        curator_id = USER_MAP.get(curator_name)
        
        if not curator_id:
            print(f"Unknown curator: {curator_name}")
            continue
        
        # Create theme for the week
        theme_id = create_theme(week_start, curator_id)
        if not theme_id:
            print(f"Failed to create theme for week {week_start}")
            continue
        
        print(f"Created theme for week of {week_start.strftime('%Y-%m-%d')}")
        
        # Insert all picks for this week
        for pick in picks:
            user_id = USER_MAP.get(pick['person'])
            if not user_id:
                continue
            
            # Fetch metadata
            album_name, artist_name, artwork_url = fetch_spotify_metadata(pick['url'])
            
            pick_data = {
                'user_id': user_id,
                'weekly_theme_id': theme_id,
                'title': album_name,
                'album': album_name,
                'artist': artist_name,
                'platform': 'Spotify',
                'platform_url': pick['url'],
                'pick_type': pick['type'],
                'album_artwork_url': artwork_url
            }
            
            if insert_pick(pick_data):
                print(f"  Inserted {pick['type']} by {pick['person']}: {album_name}")
            else:
                print(f"  Failed to insert pick for {pick['person']}")
    
    print("Historical data population complete!")

if __name__ == '__main__':
    main()
