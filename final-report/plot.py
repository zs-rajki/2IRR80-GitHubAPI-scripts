import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# === CONFIG ===
csv_path = "final-report/monthly_contributor_activity.csv"  # path to your CSV file
output_path = "final-report/activity_trends.png"             # output image file

# === Load data ===
df = pd.read_csv(csv_path)
df["month"] = pd.to_datetime(df["month"], format="%Y-%m")
df = df.sort_values("month")

# === Create figure with three subplots ===
fig, axes = plt.subplots(3, 1, figsize=(12, 10), sharex=True)

# -----------------------------------------------------------
# Subplot 1: Unique contributors per month (TOP)
# -----------------------------------------------------------
axes[0].plot(df["month"], df["unique_contributors"], color="tab:orange",
             linestyle="-", linewidth=2, label="Unique Contributors")

# Denser y-axis ticks
ymin, ymax = axes[0].get_ylim()
axes[0].set_yticks(np.arange(0, ymax + 1, max(1, (ymax // 10) or 1)))

axes[0].set_ylabel("Unique Contributors")
axes[0].set_title("Unique Contributors Per Month")
axes[0].legend(loc="upper left")

# -----------------------------------------------------------
# Subplot 2: Total commits over time (MIDDLE)
# -----------------------------------------------------------
axes[1].plot(df["month"], df["total_commits"], color="tab:blue",
             linestyle="-", linewidth=2, label="Total Commits")
axes[1].set_ylabel("Total Commits")
axes[1].set_title("Total Commits Per Month")
axes[1].legend(loc="upper left")

# -----------------------------------------------------------
# Subplot 3: Mean monthly commits per contributor (BOTTOM)
# -----------------------------------------------------------
axes[2].plot(df["month"], df["mean_commits_per_contributor"], color="tab:red",
             linestyle="-", linewidth=2, label="Mean Commits per Contributor")
axes[2].set_ylabel("Mean Commits per Contributor")
axes[2].set_xlabel("Month")
axes[2].set_title("Mean Monthly Commits per Contributor")
axes[2].legend(loc="upper left")

# -----------------------------------------------------------
# X-axis formatting: show every second month label
# -----------------------------------------------------------
every_second = df["month"].iloc[::2]  # every 2nd month
axes[2].set_xticks(every_second)
axes[2].set_xticklabels(
    every_second.dt.strftime("%Y-%m"),
    rotation=45,
    ha="right"
)

# -----------------------------------------------------------
# Final layout and export
# -----------------------------------------------------------
plt.tight_layout()
plt.savefig(output_path, dpi=300)
plt.show()

print(f"Plot saved to {output_path}")