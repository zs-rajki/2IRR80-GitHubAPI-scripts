import pandas as pd
import matplotlib.pyplot as plt

# === CONFIG ===
csv_path = "final-report/average_commits_per_contributor.csv"  # path to your CSV file
output_path = "final-report/activity_trends.png"               # output image file

# === Load data ===
df = pd.read_csv(csv_path)
df["month"] = pd.to_datetime(df["month"], format="%Y-%m")
df = df.sort_values("month")

# === Create figure with two subplots ===
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8), sharex=True)

# -----------------------------------------------------------
# Subplot 1: Commits and contributors (two y-axes)
# -----------------------------------------------------------
ax1a = ax1.twinx()

# Left y-axis: total commits (solid line)
lns1 = ax1.plot(df["month"], df["total_commits"], color="tab:blue",
                linestyle="--", linewidth=2, label="Total Commits")

# Right y-axis: unique contributors (dashed line)
lns2 = ax1a.plot(df["month"], df["unique_contributors"], color="tab:orange",
                 linestyle="-", linewidth=2, label="Unique Contributors")

# Labels and formatting
ax1.set_ylabel("Total Commits", color="tab:blue")
ax1a.set_ylabel("Unique Contributors", color="tab:orange")
ax1.set_title("Total Commits and Unique Contributors Over Time")
ax1.tick_params(axis="x", rotation=45)

# Combine legends from both y-axes
lines = lns1 + lns2
labels = [l.get_label() for l in lines]
ax1.legend(lines, labels, loc="upper left")

# -----------------------------------------------------------
# Subplot 2: Average commits per contributor (solid red line)
# -----------------------------------------------------------
ax2.plot(df["month"], df["avg_commits_per_contributor"], color="tab:red",
         linestyle="-", linewidth=2, label="Average Commits per Contributor")
ax2.set_ylabel("Average Commits per Contributor")
ax2.set_xlabel("Month")
ax2.set_title("Average Commits per Contributor Over Time")
ax2.legend(loc="upper left")
ax2.tick_params(axis="x", rotation=45)

# -----------------------------------------------------------
# Final layout and export
# -----------------------------------------------------------
plt.tight_layout()
plt.savefig(output_path, dpi=300)
plt.show()

print(f"Plot saved to {output_path}")