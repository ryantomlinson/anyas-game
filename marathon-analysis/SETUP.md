# Marathon Pace Analysis Tool

Analyzes your Strava running data to determine if a **5:30/km marathon pace** (3:52:04 finish) is achievable.

## What It Analyzes

- Overall running profile (volume, pace, distance history)
- Recent fitness (last 12 weeks of training)
- Long run readiness (15+ km runs)
- Pace distribution and trends
- Weekly volume trends
- Marathon time predictions using multiple methods (Riegel formula, pace adjustments)
- Final verdict with strengths, gaps, and training recommendations

## Setup (5 minutes)

### 1. Create a Strava API Application

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Fill in:
   - **Application Name**: Marathon Analyzer (anything works)
   - **Category**: Other
   - **Website**: http://localhost
   - **Authorization Callback Domain**: `localhost`
3. Click **Create**
4. Note your **Client ID** and **Client Secret**

### 2. Run the Analysis

```bash
cd marathon-analysis

# Option A: Pass credentials directly
python3 analyze.py --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET

# Option B: Use environment variables
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
python3 analyze.py
```

A browser window will open asking you to authorize the app. Click **Authorize** and the analysis will begin.

### 3. Save Data for Offline Analysis

```bash
# Export your data to a JSON file
python3 analyze.py --client-id ID --client-secret SECRET --export my_runs.json

# Re-analyze later without hitting the API
python3 analyze.py --from-file my_runs.json
```

## Requirements

- Python 3.8+
- `requests` (usually pre-installed)
- `pandas`
- `numpy`

Install dependencies:
```bash
pip3 install requests pandas numpy
```

## Privacy

- Your Strava token is saved locally in `.strava_token.json` (gitignored)
- No data is sent anywhere except to/from the Strava API
- Exported JSON files stay on your machine
