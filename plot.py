import pandas as pd
import matplotlib.pyplot as plt

# Read CSV files without headers
commits = pd.read_csv('commits_2024.csv', header=None, names=['datetime'])
prs = pd.read_csv('prs_2024.csv', header=None, names=['datetime'])
issues = pd.read_csv('issues_2024.csv', header=None, names=['datetime'])

# Convert to datetime
for df in [commits, prs, issues]:
    df['datetime'] = pd.to_datetime(df['datetime'], errors='coerce')
    df.dropna(subset=['datetime'], inplace=True)

# Count activities per week
commits_per_week = commits.set_index('datetime').resample('W').size()
prs_per_week = prs.set_index('datetime').resample('W').size()
issues_per_week = issues.set_index('datetime').resample('W').size()

# Combine into one DataFrame
activity_weekly = pd.DataFrame({
    'commits': commits_per_week,
    'prs': prs_per_week,
    'issues': issues_per_week
}).fillna(0)

# Plot
plt.figure(figsize=(15,6))
plt.plot(activity_weekly.index, activity_weekly['commits'], label='Commits', color='blue')
plt.plot(activity_weekly.index, activity_weekly['prs'], label='PRs', color='green')
plt.plot(activity_weekly.index, activity_weekly['issues'], label='Issues', color='red')
plt.title('GitHub Activity in 2024 (weekly)')
plt.xlabel('Time')
plt.ylabel('Number of Events')
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()