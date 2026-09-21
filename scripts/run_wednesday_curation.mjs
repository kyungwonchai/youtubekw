#!/usr/bin/env node
import { runWednesdayMeeting } from '../youtube-control.mjs';

async function main() {
  console.log(`[Wednesday 11:00 Meeting] Starting AI Curation session... ${new Date().toISOString()}`);
  try {
    const res = await runWednesdayMeeting({ force: true });
    console.log(`[Wednesday 11:00 Meeting] Successfully created session:`, res.session?.meetingTitle);
  } catch (err) {
    console.error(`[Wednesday 11:00 Meeting] Error:`, err);
  }
}

main();
