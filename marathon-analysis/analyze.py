#!/usr/bin/env python3
"""
Marathon Pace Analysis Tool

Connects to the Strava API, pulls your running data, and analyzes whether
a 5:30/km marathon pace (3:52:06 finish) is achievable for you.

Usage:
    python3 analyze.py --client-id YOUR_ID --client-secret YOUR_SECRET

Or set environment variables:
    export STRAVA_CLIENT_ID=your_id
    export STRAVA_CLIENT_SECRET=your_secret
    python3 analyze.py
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from strava_client import fetch_all_activities, fetch_athlete_profile, get_access_token

TARGET_PACE_SEC_PER_KM = 330  # 5:30 per km
MARATHON_DISTANCE_KM = 42.195


def parse_args():
    parser = argparse.ArgumentParser(description="Marathon pace analysis from Strava")
    parser.add_argument("--client-id", default=os.environ.get("STRAVA_CLIENT_ID"),
                        help="Strava API Client ID")
    parser.add_argument("--client-secret", default=os.environ.get("STRAVA_CLIENT_SECRET"),
                        help="Strava API Client Secret")
    parser.add_argument("--export", default=None,
                        help="Export raw activity data to JSON file")
    parser.add_argument("--from-file", default=None,
                        help="Load previously exported JSON instead of calling API")
    return parser.parse_args()


def activities_to_dataframe(activities):
    """Convert Strava activities list to a cleaned pandas DataFrame."""
    records = []
    for act in activities:
        distance_km = act["distance"] / 1000.0
        moving_time_sec = act["moving_time"]
        elapsed_time_sec = act["elapsed_time"]

        if distance_km < 0.5:
            continue  # skip very short runs

        pace_sec_per_km = moving_time_sec / distance_km if distance_km > 0 else None
        speed_kmh = (distance_km / moving_time_sec * 3600) if moving_time_sec > 0 else None

        records.append({
            "date": pd.to_datetime(act["start_date_local"]).tz_localize(None),
            "name": act.get("name", ""),
            "distance_km": round(distance_km, 2),
            "moving_time_sec": moving_time_sec,
            "elapsed_time_sec": elapsed_time_sec,
            "pace_sec_per_km": pace_sec_per_km,
            "speed_kmh": round(speed_kmh, 2) if speed_kmh else None,
            "elevation_gain_m": act.get("total_elevation_gain", 0),
            "avg_heartrate": act.get("average_heartrate"),
            "max_heartrate": act.get("max_heartrate"),
            "suffer_score": act.get("suffer_score"),
            "avg_cadence": act.get("average_cadence"),
            "workout_type": act.get("workout_type"),
        })

    df = pd.DataFrame(records)
    if df.empty:
        return df
    df = df.sort_values("date").reset_index(drop=True)
    return df


def format_pace(seconds_per_km):
    """Format pace as M:SS."""
    if seconds_per_km is None or np.isnan(seconds_per_km):
        return "N/A"
    mins = int(seconds_per_km // 60)
    secs = int(seconds_per_km % 60)
    return f"{mins}:{secs:02d}"


def format_time(total_seconds):
    """Format total seconds as H:MM:SS."""
    hours = int(total_seconds // 3600)
    mins = int((total_seconds % 3600) // 60)
    secs = int(total_seconds % 60)
    return f"{hours}:{mins:02d}:{secs:02d}"


def analyze_overall_stats(df):
    """Print overall running statistics."""
    print("\n" + "=" * 70)
    print("  OVERALL RUNNING PROFILE")
    print("=" * 70)

    total_runs = len(df)
    total_km = df["distance_km"].sum()
    date_range = (df["date"].max() - df["date"].min()).days
    months = date_range / 30.44

    print(f"  Total runs:           {total_runs}")
    print(f"  Total distance:       {total_km:.1f} km")
    print(f"  Date range:           {df['date'].min().strftime('%Y-%m-%d')} to {df['date'].max().strftime('%Y-%m-%d')} ({date_range} days)")
    print(f"  Avg runs per week:    {total_runs / (date_range / 7):.1f}" if date_range > 0 else "")
    print(f"  Avg km per week:      {total_km / (date_range / 7):.1f}" if date_range > 0 else "")
    print(f"  Avg distance/run:     {df['distance_km'].mean():.1f} km")
    print(f"  Longest run:          {df['distance_km'].max():.1f} km")
    print(f"  Overall avg pace:     {format_pace(df['pace_sec_per_km'].mean())}/km")
    print(f"  Best pace (any run):  {format_pace(df['pace_sec_per_km'].min())}/km")

    if df["avg_heartrate"].notna().any():
        print(f"  Avg heart rate:       {df['avg_heartrate'].mean():.0f} bpm")
        print(f"  Max heart rate seen:  {df['max_heartrate'].max():.0f} bpm")


def analyze_recent_fitness(df, weeks=12):
    """Analyze recent training (last N weeks)."""
    cutoff = datetime.now() - timedelta(weeks=weeks)
    recent = df[df["date"] >= cutoff].copy()

    print(f"\n" + "=" * 70)
    print(f"  RECENT TRAINING (last {weeks} weeks)")
    print("=" * 70)

    if recent.empty:
        print(f"  No runs found in the last {weeks} weeks!")
        return recent

    total_km = recent["distance_km"].sum()
    num_weeks = max((recent["date"].max() - recent["date"].min()).days / 7, 1)

    print(f"  Runs:                 {len(recent)}")
    print(f"  Total distance:       {total_km:.1f} km")
    print(f"  Avg km/week:          {total_km / num_weeks:.1f}")
    print(f"  Avg runs/week:        {len(recent) / num_weeks:.1f}")
    print(f"  Avg distance/run:     {recent['distance_km'].mean():.1f} km")
    print(f"  Longest recent run:   {recent['distance_km'].max():.1f} km")
    print(f"  Avg pace:             {format_pace(recent['pace_sec_per_km'].mean())}/km")
    print(f"  Best pace:            {format_pace(recent['pace_sec_per_km'].min())}/km")

    if recent["avg_heartrate"].notna().any():
        print(f"  Avg heart rate:       {recent['avg_heartrate'].mean():.0f} bpm")

    return recent


def analyze_long_runs(df, min_distance_km=15):
    """Analyze long runs which are most predictive of marathon performance."""
    long_runs = df[df["distance_km"] >= min_distance_km].copy()

    print(f"\n" + "=" * 70)
    print(f"  LONG RUNS ({min_distance_km}+ km)")
    print("=" * 70)

    if long_runs.empty:
        print(f"  No runs of {min_distance_km}+ km found!")
        print(f"  Long runs are critical for marathon preparation.")
        return long_runs

    print(f"  Count:                {len(long_runs)}")
    print(f"  Avg distance:         {long_runs['distance_km'].mean():.1f} km")
    print(f"  Longest:              {long_runs['distance_km'].max():.1f} km")
    print(f"  Avg pace:             {format_pace(long_runs['pace_sec_per_km'].mean())}/km")
    print(f"  Best pace:            {format_pace(long_runs['pace_sec_per_km'].min())}/km")

    print(f"\n  Recent long runs:")
    for _, row in long_runs.tail(8).iterrows():
        print(f"    {row['date'].strftime('%Y-%m-%d')}  {row['distance_km']:6.1f} km  "
              f"{format_pace(row['pace_sec_per_km'])}/km  "
              f"{'HR: ' + str(int(row['avg_heartrate'])) if pd.notna(row['avg_heartrate']) else ''}")

    return long_runs


def analyze_pace_distribution(df):
    """Analyze pace distribution across all runs."""
    print(f"\n" + "=" * 70)
    print(f"  PACE DISTRIBUTION")
    print("=" * 70)

    # Exclude very short runs that skew pace data
    meaningful = df[df["distance_km"] >= 3].copy()
    if meaningful.empty:
        print("  Not enough data for pace analysis.")
        return

    target = TARGET_PACE_SEC_PER_KM
    faster_count = len(meaningful[meaningful["pace_sec_per_km"] <= target])
    pct = (faster_count / len(meaningful)) * 100

    print(f"  Runs at or faster than 5:30/km:  {faster_count}/{len(meaningful)} ({pct:.0f}%)")

    # Pace buckets
    buckets = [
        ("Under 4:30/km", 0, 270),
        ("4:30 - 5:00/km", 270, 300),
        ("5:00 - 5:30/km", 300, 330),
        ("5:30 - 6:00/km", 330, 360),
        ("6:00 - 6:30/km", 360, 390),
        ("6:30 - 7:00/km", 390, 420),
        ("Over 7:00/km", 420, 9999),
    ]

    print(f"\n  Pace breakdown:")
    for label, lo, hi in buckets:
        count = len(meaningful[(meaningful["pace_sec_per_km"] >= lo) & (meaningful["pace_sec_per_km"] < hi)])
        bar = "#" * int(count / len(meaningful) * 40)
        print(f"    {label:20s}  {count:4d} runs  {bar}")


def analyze_pace_trend(df, weeks=24):
    """Analyze how pace has been trending over time."""
    cutoff = datetime.now() - timedelta(weeks=weeks)
    recent = df[(df["date"] >= cutoff) & (df["distance_km"] >= 3)].copy()

    print(f"\n" + "=" * 70)
    print(f"  PACE TREND (last {weeks} weeks)")
    print("=" * 70)

    if len(recent) < 4:
        print("  Not enough recent data for trend analysis.")
        return None

    # Group by month
    recent["month"] = recent["date"].dt.to_period("M")
    monthly = recent.groupby("month").agg(
        avg_pace=("pace_sec_per_km", "mean"),
        best_pace=("pace_sec_per_km", "min"),
        total_km=("distance_km", "sum"),
        runs=("distance_km", "count"),
    ).reset_index()

    print(f"  {'Month':10s}  {'Avg Pace':>10s}  {'Best Pace':>10s}  {'Volume':>8s}  {'Runs':>5s}")
    print(f"  {'-'*10}  {'-'*10}  {'-'*10}  {'-'*8}  {'-'*5}")
    for _, row in monthly.iterrows():
        print(f"  {str(row['month']):10s}  {format_pace(row['avg_pace']):>10s}  "
              f"{format_pace(row['best_pace']):>10s}  {row['total_km']:7.1f}k  {row['runs']:5.0f}")

    # Linear trend on average pace
    recent = recent.copy()
    recent["days_from_start"] = (recent["date"] - recent["date"].min()).dt.days
    if len(recent) >= 4:
        coeffs = np.polyfit(recent["days_from_start"], recent["pace_sec_per_km"], 1)
        pace_change_per_month = coeffs[0] * 30.44
        direction = "improving" if pace_change_per_month < 0 else "slowing"
        print(f"\n  Trend: {direction} by {abs(pace_change_per_month):.1f} sec/km per month")
        return pace_change_per_month
    return None


def analyze_training_volume_trend(df, weeks=24):
    """Analyze weekly training volume trends."""
    cutoff = datetime.now() - timedelta(weeks=weeks)
    recent = df[df["date"] >= cutoff].copy()

    print(f"\n" + "=" * 70)
    print(f"  WEEKLY VOLUME TREND (last {weeks} weeks)")
    print("=" * 70)

    if recent.empty:
        print("  No recent data.")
        return

    recent["week"] = recent["date"].dt.isocalendar().week.astype(int)
    recent["year_week"] = recent["date"].dt.strftime("%Y-W%U")

    weekly = recent.groupby("year_week").agg(
        total_km=("distance_km", "sum"),
        runs=("distance_km", "count"),
        longest=("distance_km", "max"),
    ).reset_index()

    for _, row in weekly.tail(12).iterrows():
        bar = "#" * int(row["total_km"] / 2)
        print(f"  {row['year_week']}  {row['total_km']:6.1f} km  ({row['runs']:.0f} runs, longest {row['longest']:.1f}km)  {bar}")


def estimate_marathon_time(df):
    """Estimate marathon finish time using multiple methods."""
    print(f"\n" + "=" * 70)
    print(f"  MARATHON TIME PREDICTIONS")
    print("=" * 70)

    estimates = []

    # Method 1: Riegel formula from recent races / fast efforts
    fast_runs = df[(df["distance_km"] >= 5) & (df["pace_sec_per_km"] <= df["pace_sec_per_km"].quantile(0.15))].copy()
    if not fast_runs.empty:
        # Use the best effort at longest distance
        best_effort = fast_runs.loc[fast_runs["distance_km"].idxmax()]
        race_dist = best_effort["distance_km"]
        race_time = best_effort["moving_time_sec"]

        # Riegel formula: T2 = T1 * (D2/D1)^1.06
        predicted_time = race_time * (MARATHON_DISTANCE_KM / race_dist) ** 1.06
        predicted_pace = predicted_time / MARATHON_DISTANCE_KM
        estimates.append(("Riegel formula (best long fast run)", predicted_time, predicted_pace,
                          f"Based on {race_dist:.1f}km in {format_time(race_time)}"))

    # Method 2: From recent 10k-ish best effort
    recent_cutoff = datetime.now() - timedelta(weeks=16)
    recent_10k = df[(df["distance_km"] >= 8) & (df["distance_km"] <= 12) & (df["date"] >= recent_cutoff)].copy()
    if not recent_10k.empty:
        best_10k = recent_10k.loc[recent_10k["pace_sec_per_km"].idxmin()]
        race_time = best_10k["moving_time_sec"]
        race_dist = best_10k["distance_km"]
        predicted_time = race_time * (MARATHON_DISTANCE_KM / race_dist) ** 1.06
        predicted_pace = predicted_time / MARATHON_DISTANCE_KM
        estimates.append(("Riegel from recent ~10k effort", predicted_time, predicted_pace,
                          f"Based on {race_dist:.1f}km at {format_pace(best_10k['pace_sec_per_km'])}/km"))

    # Method 3: From half-marathon distance efforts
    hm_runs = df[(df["distance_km"] >= 18) & (df["distance_km"] <= 25)].copy()
    if not hm_runs.empty:
        best_hm = hm_runs.loc[hm_runs["pace_sec_per_km"].idxmin()]
        race_time = best_hm["moving_time_sec"]
        race_dist = best_hm["distance_km"]
        predicted_time = race_time * (MARATHON_DISTANCE_KM / race_dist) ** 1.06
        predicted_pace = predicted_time / MARATHON_DISTANCE_KM
        estimates.append(("Riegel from half-marathon effort", predicted_time, predicted_pace,
                          f"Based on {race_dist:.1f}km at {format_pace(best_hm['pace_sec_per_km'])}/km"))

    # Method 4: Average long run pace + fatigue factor
    long_runs = df[df["distance_km"] >= 15].copy()
    if not long_runs.empty:
        avg_long_pace = long_runs["pace_sec_per_km"].mean()
        # Add ~5-8% fatigue factor for marathon distance
        fatigue_pace = avg_long_pace * 1.07
        predicted_time = fatigue_pace * MARATHON_DISTANCE_KM
        predicted_pace = fatigue_pace
        estimates.append(("Long run pace + 7% fatigue factor", predicted_time, predicted_pace,
                          f"Avg long run pace: {format_pace(avg_long_pace)}/km"))

    # Method 5: Recent average pace adjusted
    recent = df[df["date"] >= (datetime.now() - timedelta(weeks=8))].copy()
    if not recent.empty:
        recent_avg_pace = recent["pace_sec_per_km"].mean()
        # Marathon pace is typically 15-20% slower than average training pace
        # (since training includes easy runs)
        adjusted_pace = recent_avg_pace * 1.03  # slight adjustment since avg includes easy runs
        predicted_time = adjusted_pace * MARATHON_DISTANCE_KM
        predicted_pace = adjusted_pace
        estimates.append(("Recent avg pace (slight adjustment)", predicted_time, predicted_pace,
                          f"Recent avg: {format_pace(recent_avg_pace)}/km"))

    if not estimates:
        print("  Not enough data to make predictions.")
        return None

    target_time = TARGET_PACE_SEC_PER_KM * MARATHON_DISTANCE_KM

    print(f"\n  Target: {format_pace(TARGET_PACE_SEC_PER_KM)}/km = {format_time(target_time)} marathon")
    print(f"\n  {'Method':<45s}  {'Predicted':>10s}  {'Pace':>8s}  {'vs Target':>10s}")
    print(f"  {'-'*45}  {'-'*10}  {'-'*8}  {'-'*10}")

    for method, time_sec, pace, note in estimates:
        diff = time_sec - target_time
        diff_str = f"+{format_time(abs(diff))}" if diff > 0 else f"-{format_time(abs(diff))}"
        status = "SLOWER" if diff > 0 else "FASTER"
        print(f"  {method:<45s}  {format_time(time_sec):>10s}  {format_pace(pace):>8s}  {diff_str} {status}")
        print(f"    ({note})")

    avg_predicted = np.mean([e[1] for e in estimates])
    avg_pace = avg_predicted / MARATHON_DISTANCE_KM
    return avg_predicted


def generate_verdict(df, avg_predicted_time):
    """Generate the final verdict on 5:30/km marathon achievability."""
    print(f"\n" + "=" * 70)
    print(f"  VERDICT: CAN YOU RUN A 5:30/km MARATHON?")
    print("=" * 70)

    target_time = TARGET_PACE_SEC_PER_KM * MARATHON_DISTANCE_KM
    target_str = format_time(target_time)

    issues = []
    strengths = []

    # Check 1: Weekly volume
    recent_cutoff = datetime.now() - timedelta(weeks=12)
    recent = df[df["date"] >= recent_cutoff]
    if not recent.empty:
        weeks_span = max((recent["date"].max() - recent["date"].min()).days / 7, 1)
        weekly_km = recent["distance_km"].sum() / weeks_span
        if weekly_km >= 50:
            strengths.append(f"Strong weekly volume ({weekly_km:.0f} km/week)")
        elif weekly_km >= 35:
            strengths.append(f"Decent weekly volume ({weekly_km:.0f} km/week)")
        elif weekly_km >= 20:
            issues.append(f"Moderate weekly volume ({weekly_km:.0f} km/week) - ideally 40-60+ km/week for sub-3:52")
        else:
            issues.append(f"Low weekly volume ({weekly_km:.0f} km/week) - need 40-60+ km/week for this target")

    # Check 2: Long run readiness
    long_runs = df[df["distance_km"] >= 28]
    if len(long_runs) >= 3:
        strengths.append(f"Good long run history ({len(long_runs)} runs of 28+ km)")
    elif len(long_runs) >= 1:
        issues.append(f"Limited 28+ km runs ({len(long_runs)}) - need more marathon-distance practice")
    else:
        longest = df["distance_km"].max()
        issues.append(f"No runs over 28 km (longest: {longest:.1f} km) - need long runs of 30-35 km")

    # Check 3: Pace capability
    fast_runs = df[(df["distance_km"] >= 5) & (df["pace_sec_per_km"] <= TARGET_PACE_SEC_PER_KM)]
    if len(fast_runs) >= 10:
        strengths.append(f"Regularly running at target pace ({len(fast_runs)} runs at/under 5:30/km)")
    elif len(fast_runs) >= 3:
        strengths.append(f"Can hit target pace in shorter runs ({len(fast_runs)} runs)")
    else:
        issues.append(f"Rarely running at 5:30/km pace (only {len(fast_runs)} runs of 5+ km)")

    # Check 4: Long run pace
    long_pace_runs = df[df["distance_km"] >= 15]
    if not long_pace_runs.empty:
        avg_long_pace = long_pace_runs["pace_sec_per_km"].mean()
        if avg_long_pace <= TARGET_PACE_SEC_PER_KM:
            strengths.append(f"Long run pace ({format_pace(avg_long_pace)}/km) already at/under target")
        elif avg_long_pace <= TARGET_PACE_SEC_PER_KM + 30:
            issues.append(f"Long run pace ({format_pace(avg_long_pace)}/km) close but needs improvement")
        else:
            issues.append(f"Long run pace ({format_pace(avg_long_pace)}/km) significantly above target")

    # Check 5: Consistency
    if not recent.empty:
        runs_per_week = len(recent) / weeks_span
        if runs_per_week >= 4:
            strengths.append(f"Good consistency ({runs_per_week:.1f} runs/week)")
        elif runs_per_week >= 3:
            pass  # neutral
        else:
            issues.append(f"Low run frequency ({runs_per_week:.1f}/week) - aim for 4-5 runs/week")

    # Overall verdict
    print(f"\n  Target: 5:30/km = {target_str} marathon finish")
    if avg_predicted_time:
        predicted_pace = avg_predicted_time / MARATHON_DISTANCE_KM
        print(f"  Average prediction: {format_time(avg_predicted_time)} ({format_pace(predicted_pace)}/km)")

    if strengths:
        print(f"\n  STRENGTHS:")
        for s in strengths:
            print(f"    + {s}")

    if issues:
        print(f"\n  AREAS TO IMPROVE:")
        for i in issues:
            print(f"    - {i}")

    # Final rating
    if avg_predicted_time and avg_predicted_time <= target_time:
        rating = "YES - ACHIEVABLE"
        detail = "Your current fitness data suggests you can hit this target."
    elif avg_predicted_time and avg_predicted_time <= target_time * 1.05:
        rating = "POSSIBLE - WITH FOCUSED TRAINING"
        detail = ("You're within striking distance. With a structured 12-16 week plan "
                  "focusing on tempo runs, long runs, and weekly volume, this is reachable.")
    elif avg_predicted_time and avg_predicted_time <= target_time * 1.10:
        rating = "STRETCH GOAL - NEEDS SIGNIFICANT WORK"
        detail = ("You'll need 4-6 months of dedicated training with progressive volume "
                  "increases, regular tempo/threshold work, and long runs building to 32-35 km.")
    elif avg_predicted_time and avg_predicted_time <= target_time * 1.20:
        rating = "AMBITIOUS - LONG-TERM GOAL"
        detail = ("This would require 6-12 months of consistent, structured training. "
                  "Consider intermediate race goals (10k, half-marathon) first.")
    else:
        rating = "VERY AMBITIOUS - NEEDS SUBSTANTIAL DEVELOPMENT"
        detail = ("Build your base fitness first. Focus on consistency, gradually increase "
                  "volume, and set intermediate pace targets over 12+ months.")

    print(f"\n  {'='*50}")
    print(f"  RATING: {rating}")
    print(f"  {'='*50}")
    print(f"\n  {detail}")

    # Training suggestions
    print(f"\n  RECOMMENDED TRAINING PLAN:")
    print(f"    1. Weekly volume: Build to 50-65 km/week")
    print(f"    2. Long run: Weekly 25-35 km at 5:45-6:00/km pace")
    print(f"    3. Tempo runs: 8-12 km at 5:10-5:20/km (1-2x/week)")
    print(f"    4. Intervals: 6-8 x 1km at 4:40-5:00/km with 90s recovery")
    print(f"    5. Easy runs: 60-70% of training at 6:00-6:30/km")
    print(f"    6. Rest: At least 1-2 rest days per week")


def main():
    args = parse_args()

    print("=" * 70)
    print("  MARATHON PACE ANALYSIS - Can you run 5:30/km for 42.195 km?")
    print("  Target finish time: 3:52:04")
    print("=" * 70)

    if args.from_file:
        print(f"\nLoading data from {args.from_file}...")
        with open(args.from_file) as f:
            activities = json.load(f)
    else:
        if not args.client_id or not args.client_secret:
            print("\nERROR: Strava API credentials required.")
            print("  Option 1: python3 analyze.py --client-id ID --client-secret SECRET")
            print("  Option 2: export STRAVA_CLIENT_ID=... && export STRAVA_CLIENT_SECRET=...")
            print("\n  Get your credentials at: https://www.strava.com/settings/api")
            sys.exit(1)

        print("\nConnecting to Strava...")
        access_token = get_access_token(args.client_id, args.client_secret)

        # Fetch profile
        profile = fetch_athlete_profile(access_token)
        print(f"  Athlete: {profile.get('firstname', '')} {profile.get('lastname', '')}")
        print(f"  City: {profile.get('city', 'N/A')}, {profile.get('country', 'N/A')}")

        # Fetch activities
        print("\nFetching running activities...")
        activities = fetch_all_activities(access_token, activity_type="Run")
        print(f"  Found {len(activities)} runs")

        if args.export:
            with open(args.export, "w") as f:
                json.dump(activities, f, indent=2, default=str)
            print(f"  Exported raw data to {args.export}")

    if not activities:
        print("\nNo running activities found! Make sure your Strava account has run data.")
        sys.exit(1)

    # Convert to DataFrame
    df = activities_to_dataframe(activities)
    print(f"\n  Analyzing {len(df)} runs ({df['distance_km'].sum():.0f} km total)")

    # Run all analyses
    analyze_overall_stats(df)
    recent = analyze_recent_fitness(df)
    long_runs = analyze_long_runs(df)
    analyze_pace_distribution(df)
    pace_trend = analyze_pace_trend(df)
    analyze_training_volume_trend(df)
    avg_predicted = estimate_marathon_time(df)
    generate_verdict(df, avg_predicted)

    print(f"\n{'=' * 70}")
    print(f"  Analysis complete!")
    print(f"{'=' * 70}\n")


if __name__ == "__main__":
    main()
