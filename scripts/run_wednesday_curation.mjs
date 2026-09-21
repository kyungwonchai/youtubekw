#!/usr/bin/env node
import { runWednesdayMeeting, checkAndRunWeeklyCatchup } from '../youtube-control.mjs';

async function main() {
  const force = process.argv.includes('--force');
  console.log(`[Weekly 11:00 Meeting Runner] Checking AI Curation session... ${new Date().toISOString()} (force=${force})`);
  try {
    const res = force ? await runWednesdayMeeting({ force: true }) : await checkAndRunWeeklyCatchup();
    if (res.skipped) {
      console.log(`[Weekly 11:00 Meeting Runner] Session already exists for this week. Skipped.`);
    } else {
      console.log(`[Weekly 11:00 Meeting Runner] Successfully processed session:`, res.session?.meetingTitle);
    }
  } catch (err) {
    console.error(`[Weekly 11:00 Meeting Runner] Error:`, err);
  }
}

main();
