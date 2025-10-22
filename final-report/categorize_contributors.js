import { getCleanContributors } from "./clean_contributors.js";
import fs from "fs";

function categorizeContributors(contributors) {
    const now = new Date();
    return contributors.map(c => {
        const daysSinceFirst = c.firstContribution ? (now - new Date(c.firstContribution)) / (1000*60*60*24) : Infinity;
        const daysSinceLast = c.lastContribution ? (now - new Date(c.lastContribution)) / (1000*60*60*24) : Infinity;

        const totalActivity = (c.totalCommits || 0) + (c.totalPRs || 0) + (c.totalIssues || 0);

        let category = "Dormant";
        if (totalActivity === 0 || (daysSinceFirst < 90 && totalActivity < 10)) category = "Newcomer";
        else if (totalActivity > 50 && (c.activeDays || 0) > 30) category = "Frequent";

        return { ...c, category, daysSinceFirst, daysSinceLast };
    });
}

(async () => {
    const humans = await getCleanContributors();
    const categorized = categorizeContributors(humans);

    // Count contributors per category
    const summary = categorized.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
    }, {});

    console.log("\n===== CATEGORIZATION SUMMARY =====");
    console.table(summary);

    // Save all categorized data
    fs.writeFileSync("categorized_contributors.json", JSON.stringify(categorized, null, 2));
})();