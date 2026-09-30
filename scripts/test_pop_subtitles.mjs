import { getTranscriptForVideo } from '../transcript-service.mjs';

const candidates = [
  { title: 'Sabrina Carpenter - Espresso', id: 'eVli-tstM5E', dur: '3:19', artist: 'Sabrina Carpenter' },
  { title: 'Sabrina Carpenter - Please Please Please', id: 'cF1Na4AIecM', dur: '3:30', artist: 'Sabrina Carpenter' },
  { title: 'Dua Lipa - Levitating', id: 'TUVcZfQe-Kw', dur: '3:23', artist: 'Dua Lipa' },
  { title: 'Ed Sheeran - Perfect', id: '2Vv-BfVoq4g', dur: '4:23', artist: 'Ed Sheeran' },
  { title: 'Ed Sheeran - Thinking Out Loud', id: 'lp-EO5I60KA', dur: '4:41', artist: 'Ed Sheeran' },
  { title: 'Benson Boone - Beautiful Things', id: 'Oa_RSwwpPaA', dur: '3:00', artist: 'Benson Boone' },
  { title: 'Coldplay - Fix You', id: 'k4V3Mo61fJM', dur: '4:55', artist: 'Coldplay' },
  { title: 'Coldplay - Yellow', id: 'yKNxeF4KMsY', dur: '4:29', artist: 'Coldplay' },
  { title: 'Coldplay - The Scientist', id: 'RB-RcX5DS5A', dur: '4:26', artist: 'Coldplay' },
  { title: 'Lady Gaga, Bradley Cooper - Shallow', id: 'bo_efYhAK2A', dur: '3:37', artist: 'Lady Gaga' },
  { title: 'Lady Gaga - Always Remember Us This Way', id: '5vheNbQlsyU', dur: '3:30', artist: 'Lady Gaga' },
  { title: 'Sam Smith - Stay With Me', id: 'pB-5XG-DbAA', dur: '3:00', artist: 'Sam Smith' },
  { title: 'Sam Smith - I\'m Not The Only One', id: 'nCkpzqqog4k', dur: '3:59', artist: 'Sam Smith' },
  { title: 'Lewis Capaldi - Someone You Loved', id: 'zABLecsR5UE', dur: '3:02', artist: 'Lewis Capaldi' },
  { title: 'Lewis Capaldi - Before You Go', id: 'Jtauh8GKgDY', dur: '3:35', artist: 'Lewis Capaldi' },
  { title: 'Conan Gray - Heather', id: '24u3NoPvgSA', dur: '3:18', artist: 'Conan Gray' },
  { title: 'Conan Gray - Memories', id: 'Vp4Y294q6q8', dur: '4:08', artist: 'Conan Gray' },
  { title: 'Olivia Rodrigo - drivers license', id: 'ZmDBbnmKpqQ', dur: '4:07', artist: 'Olivia Rodrigo' },
  { title: 'Olivia Rodrigo - deja vu', id: 'cii6ruuycQA', dur: '3:51', artist: 'Olivia Rodrigo' },
  { title: 'Olivia Rodrigo - vampire', id: 'rCNc0p4WdAI', dur: '4:05', artist: 'Olivia Rodrigo' },
  { title: 'Olivia Rodrigo - traitor', id: 'CRrf3h9vhp8', dur: '3:58', artist: 'Olivia Rodrigo' },
  { title: 'Billie Eilish, Khalid - lovely', id: 'V1Pl8CzNzCw', dur: '3:20', artist: 'Billie Eilish' },
  { title: 'Billie Eilish - everything i wanted', id: 'egMWlD3fGQ8', dur: '4:05', artist: 'Billie Eilish' },
  { title: 'Billie Eilish - idontwannabeyouanymore', id: '-tn2S3kJlyU', dur: '3:24', artist: 'Billie Eilish' },
  { title: 'Taylor Swift - Cruel Summer (Official Audio)', id: 'ic8j13piAhQ', dur: '2:58', artist: 'Taylor Swift' },
  { title: 'Taylor Swift - Anti-Hero', id: 'b1kbLwvqugk', dur: '5:09', artist: 'Taylor Swift' },
  { title: 'Taylor Swift - willow', id: 'RsEZmictANA', dur: '4:13', artist: 'Taylor Swift' },
  { title: 'Adele - When We Were Young (Live at The Church)', id: 'DDWKuo3gXMQ', dur: '5:43', artist: 'Adele' },
  { title: 'Adele - Make You Feel My Love', id: '0put0_a--Ng', dur: '3:32', artist: 'Adele' },
  { title: 'Bruno Mars - When I Was Your Man', id: 'ekzHIouo8Q4', dur: '3:55', artist: 'Bruno Mars' },
];

async function main() {
  const verified = [];
  for (const c of candidates) {
    try {
      const res = await getTranscriptForVideo(c.id);
      if (res && res.ok !== false && res.lines && res.lines.length >= 10) {
        console.log(`[PASS] ${c.title} (${c.dur}) - ${res.lines.length} lines`);
        verified.push(c);
      } else {
        console.log(`[FAIL] ${c.title} - ${res?.error || 'no lines'}`);
      }
    } catch (e) {
      console.log(`[ERR] ${c.title} - ${e.message}`);
    }
  }
  console.log(`\nVerified ${verified.length} / ${candidates.length} tracks with subtitles!`);
}

main();
