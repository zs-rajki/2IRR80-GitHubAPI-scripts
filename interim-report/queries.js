import fs from 'fs';
import { Octokit } from 'octokit';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = 'storybookjs';
const repo = 'storybook';
const since = '2024-01-01T00:00:00Z';
const until = '2024-12-31T23:59:59Z';

async function main() {
    console.log(`Fetching data for ${owner}/${repo} from ${since} to ${until}...`);

    // --- COMMITS ---
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo,
        since,
        until,
        per_page: 100
    });

    console.log(`Total commits in 2024: ${commits.length}`);

    const commitTimestamps = commits.map(c => c.commit.committer.date);
    fs.writeFileSync('commits_2024.csv', commitTimestamps.join('\n'));
    console.log('Commits timestamps saved to commits_2024.csv');

    // --- PULL REQUESTS ---
    const prs = await octokit.paginate(octokit.rest.pulls.list, {
        owner,
        repo,
        state: 'all',      // include open and closed PRs
        per_page: 100
    });

    // Filter PRs by created_at
    const prsCreated = prs.filter(pr => pr.created_at >= since && pr.created_at <= until);

    console.log(`PRs created in 2024: ${prsCreated.length}`);

    fs.writeFileSync('prs_2024.csv', prsCreated.map(pr => pr.created_at).join('\n'));
    console.log('PRs timestamps saved to prs_2024.csv');

    // --- ISSUES ---
    const issues = await octokit.paginate(octokit.rest.issues.listForRepo, {
        owner,
        repo,
        state: 'all',
        per_page: 100
    });

    // Exclude PRs (issues list may include PRs)
    const pureIssues = issues.filter(issue => !issue.pull_request);

    const issuesCreated = pureIssues.filter(issue => issue.created_at >= since && issue.created_at <= until);

    console.log(`Issues created in 2024: ${issuesCreated.length}`);

    fs.writeFileSync('issues_2024.csv', issuesCreated.map(issue => issue.created_at).join('\n'));
    console.log('Issues timestamps saved to issues_2024.csv');

    // --- TOP CONTRIBUTORS (2024) ---
    console.log("Calculating top contributors...")
    const contributors = {};

    // Count commits per committer
    for (const c of commits) {
        const login = c.author ? c.author.login : c.commit.committer.name; // fallback to name if no GitHub login
        if (!contributors[login]) contributors[login] = { commits: 0, prs: 0, issues: 0 };
        contributors[login].commits += 1;
    }

    // Count PRs per user
    for (const pr of prsCreated) {
        const login = pr.user ? pr.user.login : pr.user?.name || 'unknown';
        if (!contributors[login]) contributors[login] = { commits: 0, prs: 0, issues: 0 };
        contributors[login].prs += 1;
    }

    // Count issues per user
    for (const issue of issuesCreated) {
        const login = issue.user ? issue.user.login : issue.user?.name || 'unknown';
        if (!contributors[login]) contributors[login] = { commits: 0, prs: 0, issues: 0 };
        contributors[login].issues += 1;
    }

    // Top-10 contributors by total activity
    const topContributors = Object.entries(contributors)
        .map(([login, counts]) => ({ login, ...counts, total: counts.commits + counts.prs + counts.issues }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    console.log('Top 10 contributors:');
    console.table(topContributors);

    // Save top-10 to CSV
    const csvLines = ['login,commits,prs,issues,total'];
    for (const c of topContributors) {
        csvLines.push(`${c.login},${c.commits},${c.prs},${c.issues},${c.total}`);
    }
    fs.writeFileSync('top10_contributors_2024.csv', csvLines.join('\n'));
    console.log('Top-10 contributors saved to top10_contributors_2024.csv');
}

main().catch(err => console.error(err));