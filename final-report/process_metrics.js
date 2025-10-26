import { Octokit } from "octokit";
import fs from "fs";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = "anuraghazra";
const repo = "github-readme-stats";

// === Fetch data (repo-wide, cached) ===
async function fetchRepoData() {
    console.log("Fetching repository data...");

    // Fetch all base entities
    const [prs, issues, prReviewComments, issueComments] = await Promise.all([
        octokit.paginate(octokit.rest.pulls.list, { owner, repo, state: "all" }),
        octokit.paginate(octokit.rest.issues.listForRepo, { owner, repo, state: "all" }),
        octokit.paginate(octokit.rest.pulls.listReviewCommentsForRepo, { owner, repo, per_page: 100 }),
        octokit.paginate(octokit.rest.issues.listCommentsForRepo, { owner, repo, per_page: 100 })
    ]);

    console.log(`Fetched ${prs.length} PRs, ${issues.length} issues, ${prReviewComments.length} PR review comments, ${issueComments.length} issue comments.`);

    // Group review comments by pull number
    const reviewCommentsByPR = {};
    for (const r of prReviewComments) {
        const num = r.pull_request_url?.split("/").pop();
        if (!num) continue;
        if (!reviewCommentsByPR[num]) reviewCommentsByPR[num] = [];
        reviewCommentsByPR[num].push(r);
    }

    // Group issue comments by issue number
    const commentsByIssue = {};
    for (const c of issueComments) {
        const num = c.issue_url.split("/").pop();
        if (!commentsByIssue[num]) commentsByIssue[num] = [];
        commentsByIssue[num].push(c);
    }

    // Build PR details
    const detailedPRs = prs.map(pr => ({
        number: pr.number,
        author: pr.user?.login,
        created_at: new Date(pr.created_at),
        closed_at: pr.closed_at ? new Date(pr.closed_at) : null,
        merged_at: pr.merged_at ? new Date(pr.merged_at) : null,
        reviews: (reviewCommentsByPR[pr.number] || []).map(r => ({
            user: r.user?.login,
            submitted_at: new Date(r.created_at)
        })),
        comments: (commentsByIssue[pr.number] || []).map(c => ({
            user: c.user?.login,
            created_at: new Date(c.created_at)
        }))
    }));

    // Build Issue details (excluding PRs)
    const detailedIssues = issues
        .filter(issue => !issue.pull_request)
        .map(issue => ({
            number: issue.number,
            created_at: new Date(issue.created_at),
            closed_at: issue.closed_at ? new Date(issue.closed_at) : null,
            closed_by: issue.closed_by?.login || null,
            comments: (commentsByIssue[issue.number] || []).map(c => ({
                user: c.user?.login,
                created_at: new Date(c.created_at)
            }))
        }));

    return { detailedPRs, detailedIssues };
}

// === 1. Pull Request Review Latency ===
function computePRReviewLatency(prs) {
    let totalToFirstReview = 0, totalToClose = 0, countReviewed = 0, countClosed = 0;

    for (const pr of prs) {
        const created = pr.created_at;

        // Time to first review/comment
        const firstInteraction = [...pr.reviews, ...pr.comments]
            .map(r => r.submitted_at || r.created_at)
            .sort((a, b) => a - b)[0];
        if (firstInteraction) {
            totalToFirstReview += (firstInteraction - created) / (1000 * 60 * 60 * 24);
            countReviewed++;
        }

        if (pr.closed_at) {
            totalToClose += (pr.closed_at - created) / (1000 * 60 * 60 * 24);
            countClosed++;
        }
    }

    const avgReviewLatency = countReviewed ? totalToFirstReview / countReviewed : 0;
    const avgCloseLatency = countClosed ? totalToClose / countClosed : 0;

    console.log(`Average PR review latency: ${avgReviewLatency.toFixed(2)} days`);
    console.log(`Average PR close latency: ${avgCloseLatency.toFixed(2)} days`);

    fs.writeFileSync("pr_review_latency.csv",
        `Metric,Value(days)\nAverageTimeToFirstReview,${avgReviewLatency.toFixed(2)}\nAverageTimeToClose,${avgCloseLatency.toFixed(2)}`
    );
}

// === 2. Issue Response Time ===
function computeIssueResponseTime(issues) {
    let totalToFirstResponse = 0, totalToClose = 0, countResponded = 0, countClosed = 0;

    for (const issue of issues) {
        const created = issue.created_at;
        if (issue.comments.length > 0) {
            const firstComment = issue.comments.map(c => c.created_at).sort((a, b) => a - b)[0];
            totalToFirstResponse += (firstComment - created) / (1000 * 60 * 60 * 24);
            countResponded++;
        }
        if (issue.closed_at) {
            totalToClose += (issue.closed_at - created) / (1000 * 60 * 60 * 24);
            countClosed++;
        }
    }

    const avgResponse = countResponded ? totalToFirstResponse / countResponded : 0;
    const avgClose = countClosed ? totalToClose / countClosed : 0;

    console.log(`Average issue response time: ${avgResponse.toFixed(2)} days`);
    console.log(`Average issue close time: ${avgClose.toFixed(2)} days`);

    fs.writeFileSync("issue_response_time.csv",
        `Metric,Value(days)\nAverageTimeToFirstResponse,${avgResponse.toFixed(2)}\nAverageTimeToClose,${avgClose.toFixed(2)}`
    );
}

// === 3. New Contributors Closing Issues ===
function computeNewContributorsClosingIssues(issues) {
    issues.sort((a, b) => a.created_at - b.created_at);
    const seenContributors = new Set();
    const newcomerClosures = new Map();

    for (const issue of issues) {
        if (!issue.closed_by) continue;
        const closer = issue.closed_by;
        if (!seenContributors.has(closer)) {
            newcomerClosures.set(closer, (newcomerClosures.get(closer) || 0) + 1);
        }
        seenContributors.add(closer);
    }

    const totalNewcomers = newcomerClosures.size;
    const totalIssuesClosedByNewcomers = [...newcomerClosures.values()].reduce((a, b) => a + b, 0);

    console.log(`New contributors who closed at least one issue: ${totalNewcomers}`);
    console.log(`Total issues closed by newcomers: ${totalIssuesClosedByNewcomers}`);

    fs.writeFileSync("new_contributors_closing_issues.csv",
        "Contributor,ClosedIssues\n" + [...newcomerClosures.entries()].map(([u, c]) => `${u},${c}`).join("\n")
    );
}

// === Main Execution ===
(async () => {
    try {
        const { detailedPRs, detailedIssues } = await fetchRepoData();

        console.log("\n=== Calculating process-oriented metrics ===");
        computePRReviewLatency(detailedPRs);
        computeIssueResponseTime(detailedIssues);
        computeNewContributorsClosingIssues(detailedIssues);

        console.log("\nAll metrics computed and CSV files generated!");
    } catch (err) {
        console.error("Error:", err);
    }
})();