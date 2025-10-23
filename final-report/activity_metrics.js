import { Octokit } from "octokit";
import dayjs from "dayjs";
import fs from "fs";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// === CONFIG ===
const owner = "anuraghazra";
const repo = "github-readme-stats";

// --------------------------------------------------------
// 1. Average commits per contributor per month
// --------------------------------------------------------
async function getAverageCommitsPerContributorByMonth() {
    console.log(`Fetching commits for ${owner}/${repo} ...`);
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo,
        per_page: 100,
    });
    console.log(`Fetched ${commits.length} commits.`);

    const monthMap = {}; // { "YYYY-MM": { contributors: Set(), count: number } }

    for (const c of commits) {
        const author = c.author?.login;
        const date = c.commit.author?.date;
        if (!author || !date) continue;
        const month = dayjs(date).format("YYYY-MM");
        if (!monthMap[month]) monthMap[month] = { contributors: new Set(), count: 0 };
        monthMap[month].contributors.add(author);
        monthMap[month].count++;
    }

    const results = Object.entries(monthMap)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([month, data]) => ({
            month,
            totalCommits: data.count,
            uniqueContributors: data.contributors.size,
            avgCommitsPerContributor: (data.count / data.contributors.size).toFixed(2),
        }));

    console.table(results);

    const header = "month,total_commits,unique_contributors,avg_commits_per_contributor\n";
    const csvData =
        header +
        results
            .map(
                (r) =>
                    `${r.month},${r.totalCommits},${r.uniqueContributors},${r.avgCommitsPerContributor}`
            )
            .join("\n");

    const outputPath = "./average_commits_per_contributor.csv";
    fs.writeFileSync(outputPath, csvData);
    console.log(`CSV file saved to ${outputPath}`);
}

// --------------------------------------------------------
// 2. Time since last commit
// --------------------------------------------------------
async function getTimeSinceLastCommit() {
    const { data: commits } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 1,
    });
    const lastCommitDate = dayjs(commits[0].commit.author.date);
    const daysSince = dayjs().diff(lastCommitDate, "day");
    console.log(
        `Time since last commit: ${daysSince} days (${lastCommitDate.format("YYYY-MM-DD")})`
    );
    return daysSince;
}

// --------------------------------------------------------
// 3. Pull Request activity
// --------------------------------------------------------
async function getPRActivity() {
    console.log("Fetching Pull Requests...");
    const prs = await octokit.paginate(octokit.rest.pulls.list, {
        owner,
        repo,
        state: "all",
        per_page: 100,
    });
    const counts = { open: 0, closed: 0, merged: 0 };
    for (const pr of prs) {
        if (pr.merged_at) counts.merged++;
        else if (pr.state === "closed") counts.closed++;
        else counts.open++;
    }
    console.log("PR activity summary:", counts);
    return counts;
}

// --------------------------------------------------------
// 4. Issue activity
// --------------------------------------------------------
async function getIssueActivity() {
    console.log("Fetching Issues...");
    const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner,
        repo,
        state: "all",
        per_page: 100,
    });
    const counts = { open: 0, closed: 0 };
    for (const i of issues) {
        if (i.pull_request) continue; // skip PRs
        counts[i.state]++;
    }
    console.log("Issue activity summary:", counts);
    return counts;
}

// --------------------------------------------------------
// 5. Newcomer Retention (% of first-time contributors who return)
// --------------------------------------------------------
async function getNewcomerRetention() {
    console.log("Calculating newcomer retention...");

    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo,
        per_page: 100,
    });

    // Map contributors to their commit dates
    const contributorCommits = {};
    for (const c of commits) {
        const author = c.author?.login;
        const date = c.commit.author?.date;
        if (!author || !date) continue;
        if (!contributorCommits[author]) contributorCommits[author] = [];
        contributorCommits[author].push(dayjs(date));
    }

    let newcomers = 0;
    let retained = 0;

    for (const [author, dates] of Object.entries(contributorCommits)) {
        dates.sort((a, b) => a - b);
        if (dates.length > 1) {
            newcomers++;
            retained++;
        } else {
            newcomers++;
        }
    }

    const retentionPercent = ((retained / newcomers) * 100).toFixed(2);
    console.log(`Newcomer retention: ${retentionPercent}% (${retained} out of ${newcomers})`);
    return retentionPercent;
}

// --------------------------------------------------------
// MAIN EXECUTION
// --------------------------------------------------------
(async () => {
    try {
        console.log("=== Running Project Activity Metrics ===");
        await getAverageCommitsPerContributorByMonth();
        await getTimeSinceLastCommit();
        await getPRActivity();
        await getIssueActivity();
        await getNewcomerRetention();
        console.log("All metrics collected successfully.");
    } catch (err) {
        console.error("Error fetching data:", err);
    }
})();