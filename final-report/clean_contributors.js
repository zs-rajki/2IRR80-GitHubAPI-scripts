import { Octokit } from "octokit";
import stringSimilarity from "string-similarity";
import fs from "fs";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = "anuraghazra";
const repo = "github-readme-stats";

const botNamePatterns = [/bot/i, /action/i, /build/i, /dependabot/i, /auto/i, /workflow/i, /github/i, /copilot/i];
const botCommitPatterns = [/bump/i, /update dependency/i, /auto-?generated/i, /merge pull request/i, /update readme/i, /chore/i, /build:/i];

export async function getCleanContributors() {
    console.log(`Fetching contributors for ${owner}/${repo}...`);
    const contributors = await octokit.paginate(octokit.rest.repos.listContributors, {
        owner, repo, per_page: 100
    });
    console.log(`Found ${contributors.length} contributors.\n`);

    console.log("Fetching all PRs...");
    const allPRs = await octokit.paginate(octokit.rest.pulls.list, { owner, repo, state: "all", per_page: 100 });

    console.log("Fetching all issues...");
    const allIssues = await octokit.paginate(octokit.rest.issues.listForRepo, { owner, repo, state: "all", per_page: 100 });

    const results = [];

    for (const [index, user] of contributors.entries()) {
        const username = user.login || "";
        console.log(`Processing contributor ${index + 1}/${contributors.length}: ${username}`);

        let score = 0;
        if (botNamePatterns.some(p => p.test(username))) score += 4;

        // Fetch commits (still per contributor)
        console.log(`  Fetching commits for ${username}...`);
        const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
            owner, repo, author: username, per_page: 100
        });

        let templatedCount = 0;
        let templatedRatio = 0;
        let activeDaysSet = new Set();

        if (commits.length > 0) {
            templatedCount = commits.filter(c => botCommitPatterns.some(p => p.test(c.commit.message))).length;
            templatedRatio = templatedCount / commits.length;
            if (templatedRatio > 0.7) score += 2;

            if (commits.length >= 5) {
                const times = commits.map(c => new Date(c.commit.author.date)).sort((a, b) => a - b);
                const diffs = times.slice(1).map((t, i) => times[i + 1] - times[i]);
                const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
                const variance = diffs.reduce((a, b) => a + (b - avg) ** 2, 0) / diffs.length;
                const stdDev = Math.sqrt(variance);
                if (stdDev < 1000 * 60 * 60) score += 1;
            }

            activeDaysSet = new Set(commits.map(c => new Date(c.commit.author.date).toDateString()));
        }

        const likelyBot = score >= 3;

        const names = commits.map(c => c.commit.author.name || "");
        const emails = commits.map(c => c.commit.author.email || "");
        const messages = commits.map(c => c.commit.message).join(" ");
        const avgHour = commits.length
            ? commits.map(c => new Date(c.commit.author.date).getHours()).reduce((a, b) => a + b, 0) / commits.length
            : null;

        // Use cached allPRs and allIssues to count per user
        const totalPRs = allPRs.filter(pr => pr.user.login === username).length;
        const totalIssues = allIssues.filter(issue => issue.user.login === username && !issue.pull_request).length;

        results.push({
            username,
            totalCommits: commits.length,
            totalPRs,
            totalIssues,
            activeDays: activeDaysSet.size,
            firstContribution: commits.length ? commits[commits.length - 1].commit.author.date : null,
            lastContribution: commits.length ? commits[0].commit.author.date : null,
            templatedRatio: commits.length ? templatedRatio.toFixed(2) : 0,
            score,
            likelyBot,
            nameSamples: [...new Set(names)],
            emailSamples: [...new Set(emails)],
            messageProfile: messages,
            avgHour
        });

        console.log(`  Finished processing ${username}.\n`);
    }

    console.log("Detecting duplicates among human contributors...");
    const bots = results.filter(r => r.likelyBot);
    const humans = results.filter(r => !r.likelyBot);
    const duplicates = [];

    for (let i = 0; i < humans.length; i++) {
        for (let j = i + 1; j < humans.length; j++) {
            const a = humans[i], b = humans[j];
            // Only compute similarity if both sides have data
            const nameSim = (a.nameSamples.length && b.nameSamples.length)
                ? stringSimilarity.compareTwoStrings(a.nameSamples.join(" "), b.nameSamples.join(" "))
                : 0;

            const emailSim = (a.emailSamples.length && b.emailSamples.length)
                ? stringSimilarity.compareTwoStrings(a.emailSamples.join(" "), b.emailSamples.join(" "))
                : 0;

            const msgSim = (a.messageProfile && b.messageProfile)
                ? stringSimilarity.compareTwoStrings(a.messageProfile, b.messageProfile)
                : 0;
            const hourDiff = Math.abs((a.avgHour || 0) - (b.avgHour || 0));
            if ((nameSim > 0.8 || emailSim > 0.8) || (msgSim > 0.75 && hourDiff < 2)) {
                duplicates.push({
                    userA: a.username,
                    userB: b.username,
                    nameSim: nameSim.toFixed(2),
                    emailSim: emailSim.toFixed(2),
                    msgSim: msgSim.toFixed(2),
                    hourDiff: hourDiff.toFixed(2)
                });
            }
        }
    }
    console.log("Duplicate detection completed.\n");

    console.log("\n===== BOT SUMMARY =====");
    console.log(`Total contributors: ${results.length}`);
    console.log(`Likely bots: ${bots.length}`);
    console.log(`Likely humans: ${humans.length}\n`);

    console.log("===== CONTRIBUTORS WITH SCORE > 0 =====");
    console.table(results.filter(r => r.score > 0).map(r => ({
        username: r.username,
        totalCommits: r.totalCommits,
        totalPRs: r.totalPRs,
        totalIssues: r.totalIssues,
        activeDays: r.activeDays,
        score: r.score,
        likelyBot: r.likelyBot
    })));

    console.log("\n===== POSSIBLE DUPLICATE ACCOUNTS =====");
    if (duplicates.length === 0) console.log("No likely duplicate accounts found.");
    else console.table(duplicates);

    fs.writeFileSync("clean_contributors_output.json", JSON.stringify({ results, bots, humans, duplicates }, null, 2));
    console.log("All data saved to clean_contributors_output.json");

    return humans;
}