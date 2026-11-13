import { useMemo, useState } from "react";
import { Search, ScrollText, ExternalLink, GitCommit, CalendarDays, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";

type UpdateEntry = { sha: string; message: string; date: string | null; url: string };

const updates: UpdateEntry[] = [
  {
    "sha": "f7d6e5f646631e9bdf001942724e90d786f1e3cf",
    "message": "Avoid granting points for empty arcade scores",
    "date": "2026-11-13T21:43:51Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/f7d6e5f646631e9bdf001942724e90d786f1e3cf"
  },
  {
    "sha": "2e56677276ed264d06bc32a4011d1f0cb892e63b",
    "message": "Add Hub Points to token exchange UI",
    "date": "2026-11-13T21:43:36Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/2e56677276ed264d06bc32a4011d1f0cb892e63b"
  },
  {
    "sha": "260f99bd705310b03edaa85b59dcf898a1fd2a7a",
    "message": "Add secure Hub Points earning and token exchange APIs",
    "date": "2026-11-13T21:43:16Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/260f99bd705310b03edaa85b59dcf898a1fd2a7a"
  },
  {
    "sha": "d1943cbb0cacd84411106fc4a62260aa7f1ce378",
    "message": "Add persistent Hub Points wallet fields",
    "date": "2026-11-13T21:43:07Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d1943cbb0cacd84411106fc4a62260aa7f1ce378"
  },
  {
    "sha": "4791a239c0600b20d4da22fd04b3fb0e1a33fcae",
    "message": "Add actionable group invite lookup diagnostics",
    "date": "2026-11-13T21:38:29Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/4791a239c0600b20d4da22fd04b3fb0e1a33fcae"
  },
  {
    "sha": "ac3347156ca04e34e95483a7b38b669795e540e8",
    "message": "Correct group invite code normalization",
    "date": "2026-11-13T21:38:26Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/ac3347156ca04e34e95483a7b38b669795e540e8"
  },
  {
    "sha": "24a9ca1ac9dba5fa48d00fc0de448a59f1f394cf",
    "message": "Harden group invite code lookup",
    "date": "2026-11-13T21:36:10Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/24a9ca1ac9dba5fa48d00fc0de448a59f1f394cf"
  },
  {
    "sha": "703d597b0e087da1cbd1b3e99cdf1e1638c2961c",
    "message": "Make group invite lookup case-insensitive",
    "date": "2026-11-13T21:31:03Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/703d597b0e087da1cbd1b3e99cdf1e1638c2961c"
  },
  {
    "sha": "b3014ab855d43a98476038141605ed1ad0bc1c2f",
    "message": "Return signed-in users to their pending group invite",
    "date": "2026-11-13T21:28:28Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b3014ab855d43a98476038141605ed1ad0bc1c2f"
  },
  {
    "sha": "6908c1baec7bae6664880281aae3f31453885c68",
    "message": "Make group invitation pages accept and join groups",
    "date": "2026-11-13T21:28:26Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/6908c1baec7bae6664880281aae3f31453885c68"
  },
  {
    "sha": "04133006b476b9e6ad869219b4fcef718cc0e12e",
    "message": "Validate group chat invite codes",
    "date": "2026-11-13T21:28:24Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/04133006b476b9e6ad869219b4fcef718cc0e12e"
  },
  {
    "sha": "2e1e4fa28f02afb04498e30459a495b10ed5fc7e",
    "message": "Fix blank page scrolling from hidden global chat",
    "date": "2026-11-13T20:36:48Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/2e1e4fa28f02afb04498e30459a495b10ed5fc7e"
  },
  {
    "sha": "66c9b801129a8855d0bed7a76fb63d9491ea43e7",
    "message": "Improve hangout creation API error diagnostics",
    "date": "2026-11-13T19:09:27Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/66c9b801129a8855d0bed7a76fb63d9491ea43e7"
  },
  {
    "sha": "ce032c8bbc210563a18039c09e6f2043663d543c",
    "message": "Fix Hub source formatting and duplicate icon import",
    "date": "2026-11-13T19:00:06Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/ce032c8bbc210563a18039c09e6f2043663d543c"
  },
  {
    "sha": "5289faa3ee47efe80e62c593df71e2fb2a728277",
    "message": "Add hangouts shortcut to community hub",
    "date": "2026-11-13T18:59:51Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5289faa3ee47efe80e62c593df71e2fb2a728277"
  },
  {
    "sha": "a81fe4a072fcbb8fc029e6d19170d891f4ed2dea",
    "message": "Clean up unused hangout page state and imports",
    "date": "2026-11-13T18:59:49Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a81fe4a072fcbb8fc029e6d19170d891f4ed2dea"
  },
  {
    "sha": "5bd917745d58b6d2d62a1bd2e74cbe769ba5f765",
    "message": "Correct hangout effect line breaks",
    "date": "2026-11-13T18:59:40Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5bd917745d58b6d2d62a1bd2e74cbe769ba5f765"
  },
  {
    "sha": "499c93139bf6f2ce44716ae27df01e5e134f15c8",
    "message": "Clean up hangout membership when leaving page",
    "date": "2026-11-13T18:59:19Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/499c93139bf6f2ce44716ae27df01e5e134f15c8"
  },
  {
    "sha": "a9c722e830d2da5ee468c387e763787335d19cb1",
    "message": "Add hangouts navigation",
    "date": "2026-11-13T18:59:08Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a9c722e830d2da5ee468c387e763787335d19cb1"
  },
  {
    "sha": "c63aad812feaede37c571c8a885fbb52932d05a1",
    "message": "Register hangout rooms page",
    "date": "2026-11-13T18:59:05Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c63aad812feaede37c571c8a885fbb52932d05a1"
  },
  {
    "sha": "5a76a31067089ac108049a3397ebc4fa1c506e8e",
    "message": "Add authenticated multiplayer hangout APIs",
    "date": "2026-11-13T18:58:57Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5a76a31067089ac108049a3397ebc4fa1c506e8e"
  },
  {
    "sha": "87e8e113529ecd11e51653ad913ca3b952748c7a",
    "message": "Add responsive multiplayer 2D hangout rooms",
    "date": "2026-11-13T18:58:43Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/87e8e113529ecd11e51653ad913ca3b952748c7a"
  },
  {
    "sha": "1b36a0675f8db033b7b7852af564341f5f52b4e1",
    "message": "Implement daily hub check-in streak",
    "date": "2026-11-13T18:57:06Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/1b36a0675f8db033b7b7852af564341f5f52b4e1"
  },
  {
    "sha": "3892e4782ebc8b3c62aa9709d7c1416ef43f4bc6",
    "message": "Add daily hub check-in and improve memory game",
    "date": "2026-11-13T18:56:58Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/3892e4782ebc8b3c62aa9709d7c1416ef43f4bc6"
  },
  {
    "sha": "459b58e3da7096616f742fb607056c0c996db0b0",
    "message": "Add community hub navigation",
    "date": "2026-11-13T18:56:39Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/459b58e3da7096616f742fb607056c0c996db0b0"
  },
  {
    "sha": "138a8601fd1e57e4108d994239b70807371de114",
    "message": "Register community hub route",
    "date": "2026-11-13T18:56:36Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/138a8601fd1e57e4108d994239b70807371de114"
  },
  {
    "sha": "bd930713454ff9f2b0e0f9ffae8489d375632119",
    "message": "Add community and arcade hub",
    "date": "2026-11-13T18:56:22Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/bd930713454ff9f2b0e0f9ffae8489d375632119"
  },
  {
    "sha": "fd22950b694d64f54592d22467a7ed21d9f2a259",
    "message": "Switch chat GIF search to keyless GifCities",
    "date": "2026-11-13T18:47:31Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/fd22950b694d64f54592d22467a7ed21d9f2a259"
  },
  {
    "sha": "33663181a4b9ac9aa37e3be53053dee49867f43b",
    "message": "Normalize usernames to underscores",
    "date": "2026-11-13T18:47:16Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/33663181a4b9ac9aa37e3be53053dee49867f43b"
  },
  {
    "sha": "a6276e9ec9d4aeeeb9429e36a031e73f29d6bde0",
    "message": "Pay emote creators with 30 percent owner tax",
    "date": "2026-11-13T18:47:10Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a6276e9ec9d4aeeeb9429e36a031e73f29d6bde0"
  },
  {
    "sha": "71fca9cba3f2ec6e1319736e83b743e382bf57bc",
    "message": "Reduce chat message delivery polling latency",
    "date": "2026-11-13T18:47:02Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/71fca9cba3f2ec6e1319736e83b743e382bf57bc"
  },
  {
    "sha": "4f17201e326ca95c8e25fb76c3cdf314e0f60ae4",
    "message": "Correct shop upload data URL validation",
    "date": "2026-11-13T17:43:42Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/4f17201e326ca95c8e25fb76c3cdf314e0f60ae4"
  },
  {
    "sha": "f79fa35bbae1059b8b8d69e80f5c1446c648423b",
    "message": "Make decoration and emote publishing robust",
    "date": "2026-11-13T17:43:32Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/f79fa35bbae1059b8b8d69e80f5c1446c648423b"
  },
  {
    "sha": "b7664d757219a4cd60ca148391b08a7b0f181882",
    "message": "Mount global chat host",
    "date": "2026-11-13T17:41:15Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b7664d757219a4cd60ca148391b08a7b0f181882"
  },
  {
    "sha": "d7aea200449a7b1be1075f565fd36f88f06707c3",
    "message": "Fix shop decoration publishing validation",
    "date": "2026-11-13T17:36:40Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d7aea200449a7b1be1075f565fd36f88f06707c3"
  },
  {
    "sha": "ab6569f419567bc84d4b54ee16469fb06f4143cb",
    "message": "Fix duplicate Chat import in global call host",
    "date": "2026-11-13T17:32:46Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/ab6569f419567bc84d4b54ee16469fb06f4143cb"
  },
  {
    "sha": "c2f2f9b2d065b93201bd0c7d349da5c851a97215",
    "message": "Reserve chat route for persistent global chat host",
    "date": "2026-11-13T17:30:51Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c2f2f9b2d065b93201bd0c7d349da5c851a97215"
  },
  {
    "sha": "1a6d5f52c43468fd8e751a74a3761b682734ee29",
    "message": "Mount chat call listener globally",
    "date": "2026-11-13T17:30:46Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/1a6d5f52c43468fd8e751a74a3761b682734ee29"
  },
  {
    "sha": "3a9bf47e2154fa1ec022a3b5a03990df8cc42c3f",
    "message": "Keep call overlays visible across app routes",
    "date": "2026-11-13T17:30:44Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/3a9bf47e2154fa1ec022a3b5a03990df8cc42c3f"
  },
  {
    "sha": "94de54acb2293b789a896d2a01c2164d437e1a51",
    "message": "Change Block Blast board to 8x8",
    "date": "2026-11-13T17:27:27Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/94de54acb2293b789a896d2a01c2164d437e1a51"
  },
  {
    "sha": "c06aa753c47e7a111b11c49d293b4d92ad00ff9e",
    "message": "Add 2x decoration scale handle",
    "date": "2026-11-13T17:25:13Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c06aa753c47e7a111b11c49d293b4d92ad00ff9e"
  },
  {
    "sha": "09cde023ed06128b37873d6bec01e8949b1e581f",
    "message": "Polish decoration selection box handles",
    "date": "2026-11-13T17:24:57Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/09cde023ed06128b37873d6bec01e8949b1e581f"
  },
  {
    "sha": "99f9b1ec7e927d13146bb7a70485b46b1bed8a4f",
    "message": "Make Block Blast 5x5 and mobile responsive",
    "date": "2026-11-13T17:24:50Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/99f9b1ec7e927d13146bb7a70485b46b1bed8a4f"
  },
  {
    "sha": "855cd65fc023d15586095ccc5a7213b44e3c2e68",
    "message": "Render static transformed profile decorations",
    "date": "2026-11-13T17:24:43Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/855cd65fc023d15586095ccc5a7213b44e3c2e68"
  },
  {
    "sha": "61eb25e2a96c7740b4a096568a9c638e54c95d47",
    "message": "Add draggable decoration selection box editor",
    "date": "2026-11-13T17:24:03Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/61eb25e2a96c7740b4a096568a9c638e54c95d47"
  },
  {
    "sha": "d47d83a05504465c61176ac6b6b768bc761d7c98",
    "message": "Immediately sync equipped cosmetics across profile views",
    "date": "2026-11-13T17:17:50Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d47d83a05504465c61176ac6b6b768bc761d7c98"
  },
  {
    "sha": "66ec4b1fcc763c24bd7fc1aab69936d5cfd5c710",
    "message": "Apply saved decoration positioning and transform settings",
    "date": "2026-11-13T17:17:40Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/66ec4b1fcc763c24bd7fc1aab69936d5cfd5c710"
  },
  {
    "sha": "d007148ecc88523e2ccb21cc10d2674b87ceae72",
    "message": "Fix cosmetic refresh and add decoration positioning controls",
    "date": "2026-11-13T17:17:37Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d007148ecc88523e2ccb21cc10d2674b87ceae72"
  },
  {
    "sha": "5bb37f70470d8b12974643e8dc5160685f6d5ae5",
    "message": "Validate owned cosmetics when equipping or unequipping",
    "date": "2026-11-13T17:15:25Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5bb37f70470d8b12974643e8dc5160685f6d5ae5"
  },
  {
    "sha": "7e04cbcf530eb90af60d48c5f982769413808c8f",
    "message": "Add unequip controls for profile cosmetics",
    "date": "2026-11-13T17:15:23Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/7e04cbcf530eb90af60d48c5f982769413808c8f"
  },
  {
    "sha": "8cecebae64edff23a11190b0687c0e844c395e24",
    "message": "Fix remote audio playback in voice calls",
    "date": "2026-11-13T17:05:52Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/8cecebae64edff23a11190b0687c0e844c395e24"
  },
  {
    "sha": "4d3b139fdc179b29a3d716ad3ac655deabc3b429",
    "message": "Prevent replaying old chat emotes on channel load",
    "date": "2026-11-13T16:56:07Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/4d3b139fdc179b29a3d716ad3ac655deabc3b429"
  },
  {
    "sha": "f403d3553b19ea94b3417895b0dd0a3a9bcaa31f",
    "message": "Autoplay chat emotes for everyone",
    "date": "2026-11-13T16:53:12Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/f403d3553b19ea94b3417895b0dd0a3a9bcaa31f"
  },
  {
    "sha": "93e41e6893d0ee30297dd0beaae5594b8969bc28",
    "message": "Anchor chat emote picker to message composer",
    "date": "2026-11-13T16:51:45Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/93e41e6893d0ee30297dd0beaae5594b8969bc28"
  },
  {
    "sha": "ab827e80d604d07e66abbc137a6c15c938d35b6c",
    "message": "Validate emote ownership when sending chat emotes",
    "date": "2026-11-13T16:51:30Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/ab827e80d604d07e66abbc137a6c15c938d35b6c"
  },
  {
    "sha": "913267389b47d49db1ef1b1cd5cfb78c18ce9a85",
    "message": "Add owned emotes to chat composer and messages",
    "date": "2026-11-13T16:51:27Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/913267389b47d49db1ef1b1cd5cfb78c18ce9a85"
  },
  {
    "sha": "c361c165adc55fb0beae5e361ea87f4372b3825c",
    "message": "Move GIF and MP3 emote creator to Moderation",
    "date": "2026-11-13T16:45:14Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c361c165adc55fb0beae5e361ea87f4372b3825c"
  },
  {
    "sha": "18f802d162917cec5523425d7fe8c585eb12d83e",
    "message": "Keep profile decoration creator in Shop",
    "date": "2026-11-13T16:45:12Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/18f802d162917cec5523425d7fe8c585eb12d83e"
  },
  {
    "sha": "58c08f12f425aae1bc516e4a8a1ad82a8f4a3017",
    "message": "Add Shop to sidebar navigation",
    "date": "2026-11-13T16:45:10Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/58c08f12f425aae1bc516e4a8a1ad82a8f4a3017"
  },
  {
    "sha": "77637fc92b993315e69b50181c0bbd53cf10a09c",
    "message": "Add GIF and MP3 emote creator preview",
    "date": "2026-11-13T16:40:43Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/77637fc92b993315e69b50181c0bbd53cf10a09c"
  },
  {
    "sha": "55cd02f5c763c163354bae8353186f96c917852a",
    "message": "Polish MP3 validation feedback",
    "date": "2026-11-13T16:40:34Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/55cd02f5c763c163354bae8353186f96c917852a"
  },
  {
    "sha": "991a8ae4abe5c48a7d082d5294e53b7f0d20c1e9",
    "message": "Use the exact MP3 duration for emote playback",
    "date": "2026-11-13T16:40:16Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/991a8ae4abe5c48a7d082d5294e53b7f0d20c1e9"
  },
  {
    "sha": "5e48f1a0e4803c1288f1a5b1f91fc7dad68eb473",
    "message": "Include sender name with Block Blast emotes",
    "date": "2026-11-13T16:40:04Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5e48f1a0e4803c1288f1a5b1f91fc7dad68eb473"
  },
  {
    "sha": "4244d8552d1f2f14705b7d874657d5023855e35d",
    "message": "Add smooth audio-timed emote bubbles to Block Blast voice",
    "date": "2026-11-13T16:39:54Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/4244d8552d1f2f14705b7d874657d5023855e35d"
  },
  {
    "sha": "890ff3ded0524552fa785779903dba8a30d5e6a3",
    "message": "Use rotation-only decoration keyframes and audio-ended profile emotes",
    "date": "2026-11-13T16:39:03Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/890ff3ded0524552fa785779903dba8a30d5e6a3"
  },
  {
    "sha": "14bf668d69dbd8551db19cd08acf9154bba6b7c5",
    "message": "Allow animated GIF profile decorations",
    "date": "2026-11-13T16:38:47Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/14bf668d69dbd8551db19cd08acf9154bba6b7c5"
  },
  {
    "sha": "e15a2e39f0c663ba1c59089f2fb4d3ec9209a421",
    "message": "Support GIF decorations and improve shop previews",
    "date": "2026-11-13T16:38:44Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/e15a2e39f0c663ba1c59089f2fb4d3ec9209a421"
  },
  {
    "sha": "84546f3241e1b4ecec7d7133bad10c90794916eb",
    "message": "Fix ProfileModal JSX closing tag",
    "date": "2026-11-13T16:35:24Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/84546f3241e1b4ecec7d7133bad10c90794916eb"
  },
  {
    "sha": "5928524ece59513031ac7a9d9c10096e4edefa6a",
    "message": "Add per-person group call tabs and improve call invites",
    "date": "2026-11-13T16:33:18Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5928524ece59513031ac7a9d9c10096e4edefa6a"
  },
  {
    "sha": "6e83b87dccbb50896efae7bf8266a32e4ce956f4",
    "message": "Prevent overlapping one-to-one and group calls",
    "date": "2026-11-13T16:31:37Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/6e83b87dccbb50896efae7bf8266a32e4ce956f4"
  },
  {
    "sha": "a2c0028addd0419f0c51db7fe6b3487ef72354e5",
    "message": "Limit group call invites to current group members",
    "date": "2026-11-13T16:31:28Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a2c0028addd0419f0c51db7fe6b3487ef72354e5"
  },
  {
    "sha": "e3d24130ce4653f663306a500f38c4c4eded5f50",
    "message": "Expose authorized group call member list",
    "date": "2026-11-13T16:31:25Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/e3d24130ce4653f663306a500f38c4c4eded5f50"
  },
  {
    "sha": "d700f01b05eabf5e4011130c0b3242d26a8a935f",
    "message": "Attach local video in group call participant grid",
    "date": "2026-11-13T16:31:13Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d700f01b05eabf5e4011130c0b3242d26a8a935f"
  },
  {
    "sha": "f5a0c2f7d7caa06bdd132d6adcd5e9cc456239d0",
    "message": "Fix group call invite group lookup",
    "date": "2026-11-13T16:31:11Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/f5a0c2f7d7caa06bdd132d6adcd5e9cc456239d0"
  },
  {
    "sha": "01d842f4b83dbbe4529fd2f5a122746a6627e69b",
    "message": "Add group call UI, invites, and WebRTC mesh",
    "date": "2026-11-13T16:31:00Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/01d842f4b83dbbe4529fd2f5a122746a6627e69b"
  },
  {
    "sha": "4541d96b5a8bb6d34a0007f34fb50b748f1bcfd4",
    "message": "Add authenticated group voice and video call rooms",
    "date": "2026-11-13T16:30:57Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/4541d96b5a8bb6d34a0007f34fb50b748f1bcfd4"
  },
  {
    "sha": "bdd64b0ff23f63610ea8b955c737ab1b3a235a99",
    "message": "Remove orphaned duplicate route block causing server syntax error",
    "date": "2026-11-13T16:28:25Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/bdd64b0ff23f63610ea8b955c737ab1b3a235a99"
  },
  {
    "sha": "55f178216c3ca72fa837c97a614ae5a4e474fce5",
    "message": "Fix routes.ts syntax error from orphaned duplicate routes",
    "date": "2026-11-13T16:28:13Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/55f178216c3ca72fa837c97a614ae5a4e474fce5"
  },
  {
    "sha": "b34db68c030f678fba81bcf3b67c77973c6835d6",
    "message": "Show uploaded decoration animated over a profile avatar preview",
    "date": "2026-11-13T16:24:13Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b34db68c030f678fba81bcf3b67c77973c6835d6"
  },
  {
    "sha": "8dd42b251a9e20c12ec19538c154c031058f03a6",
    "message": "Preserve compatibility with existing name-style shop items",
    "date": "2026-11-13T16:23:48Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/8dd42b251a9e20c12ec19538c154c031058f03a6"
  },
  {
    "sha": "308a0a5dbb11a40e054fd45867701e682c5e64a0",
    "message": "Add owned animated emote bubbles to profile view",
    "date": "2026-11-13T16:23:16Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/308a0a5dbb11a40e054fd45867701e682c5e64a0"
  },
  {
    "sha": "c943f686e8f3ed7fcc64e121c3e59ac89a7a9093",
    "message": "Import Sparkles icon for the voice-call emote picker",
    "date": "2026-11-13T16:22:47Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c943f686e8f3ed7fcc64e121c3e59ac89a7a9093"
  },
  {
    "sha": "b3b5748faee1700883c78e608293150e50120e87",
    "message": "Repair DihCoins combo reward endpoint",
    "date": "2026-11-13T16:22:35Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b3b5748faee1700883c78e608293150e50120e87"
  },
  {
    "sha": "618fe3ffc11acbbcf9cb0540da7b11499f0a9d08",
    "message": "Refresh DihCoins balance after Block Blast combo rewards",
    "date": "2026-11-13T16:22:12Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/618fe3ffc11acbbcf9cb0540da7b11499f0a9d08"
  },
  {
    "sha": "5d0186284a6d757475a31001b5528c1d9d0a6127",
    "message": "Fix camera activation during an existing audio call",
    "date": "2026-11-13T16:21:57Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5d0186284a6d757475a31001b5528c1d9d0a6127"
  },
  {
    "sha": "ed97e3d8ba3e1fc9a2619411999d51c71deaf370",
    "message": "Add GIF and MP3 emotes to Block Blast voice chat",
    "date": "2026-11-13T16:21:40Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/ed97e3d8ba3e1fc9a2619411999d51c71deaf370"
  },
  {
    "sha": "cfd749b00f1788efc290d9cc061e2c2fc1b8fe86",
    "message": "Add owned emote broadcasts to Block Blast voice room",
    "date": "2026-11-13T16:21:06Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/cfd749b00f1788efc290d9cc061e2c2fc1b8fe86"
  },
  {
    "sha": "707925d6fb99971014c89869de92c3eb7cdf49f6",
    "message": "Add owned animated GIF and MP3 emotes to live voice calls",
    "date": "2026-11-13T16:20:50Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/707925d6fb99971014c89869de92c3eb7cdf49f6"
  },
  {
    "sha": "4fe352a3011546d9dc5438bf9939c5e75b63e8ee",
    "message": "Add authenticated owned-emote signaling to active voice calls",
    "date": "2026-11-13T16:20:27Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/4fe352a3011546d9dc5438bf9939c5e75b63e8ee"
  },
  {
    "sha": "cbe7487e7335cd7b004b6055cb30bc7888d92896",
    "message": "Fix live audio visualizer to meter the local mic with amplified frequency bars",
    "date": "2026-11-13T16:20:05Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/cbe7487e7335cd7b004b6055cb30bc7888d92896"
  },
  {
    "sha": "673af20d7e88cac3f5c183243a9f7c84cba187fa",
    "message": "Render equipped animated PNG decorations on profile avatars",
    "date": "2026-11-13T16:19:29Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/673af20d7e88cac3f5c183243a9f7c84cba187fa"
  },
  {
    "sha": "d6a89364dae0d5997ae88d379e6a8ef76c1867ce",
    "message": "Reward Block Blast combo streaks with 10 DihCoins",
    "date": "2026-11-13T16:19:07Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d6a89364dae0d5997ae88d379e6a8ef76c1867ce"
  },
  {
    "sha": "f925ed1dddf84b00636b74d2a550f0ad931798d2",
    "message": "Add admin DihCoins grant control to moderation panel",
    "date": "2026-11-13T16:19:01Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/f925ed1dddf84b00636b74d2a550f0ad931798d2"
  },
  {
    "sha": "f7d3f3529fe0461da0c66bbcf9150dbbb732df11",
    "message": "Build DihCoins creator marketplace for profile decorations and GIF emotes",
    "date": "2026-11-13T16:18:46Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/f7d3f3529fe0461da0c66bbcf9150dbbb732df11"
  },
  {
    "sha": "6f7080c4a55a87ef16dac63fb142839a1e63475e",
    "message": "Add DihCoins grants, Block Blast combo rewards and creator shop publishing",
    "date": "2026-11-13T16:17:58Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/6f7080c4a55a87ef16dac63fb142839a1e63475e"
  },
  {
    "sha": "d421f92ab38bcbdae6ab05bc705603ab6e9e3a9b",
    "message": "Fix Block Blast drag alignment and full-piece placement preview",
    "date": "2026-11-13T16:00:41Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d421f92ab38bcbdae6ab05bc705603ab6e9e3a9b"
  },
  {
    "sha": "c3cb5d17cb5adb6d17a7140d06f731db1618261e",
    "message": "Remove duplicate username font helper",
    "date": "2026-11-13T15:54:19Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c3cb5d17cb5adb6d17a7140d06f731db1618261e"
  },
  {
    "sha": "eab86439f1e30fd174495f9b889c3bc2d659de4f",
    "message": "Import username styles from helper module",
    "date": "2026-11-13T15:54:09Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/eab86439f1e30fd174495f9b889c3bc2d659de4f"
  },
  {
    "sha": "3f2a9c63044dd273f6a78731e78738a013d19fe9",
    "message": "Fix Fast Refresh exports in ProfileModal",
    "date": "2026-11-13T15:54:07Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/3f2a9c63044dd273f6a78731e78738a013d19fe9"
  },
  {
    "sha": "a92c8bb43b246960385b384da88d1e5ca723d5f8",
    "message": "Move profile text helpers out of React component module",
    "date": "2026-11-13T15:54:05Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a92c8bb43b246960385b384da88d1e5ca723d5f8"
  },
  {
    "sha": "0625cd44572914fa134dd304654c68575297ab2c",
    "message": "Update client page components and login logic",
    "date": "2026-11-12T07:09:15.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/0625cd44572914fa134dd304654c68575297ab2c"
  },
  {
    "sha": "8c9927b6efaf8ec1a3be43f669e1d4bc9b28dcc4",
    "message": "Update server routes and dependencies",
    "date": "2026-11-11T13:56:03.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/8c9927b6efaf8ec1a3be43f669e1d4bc9b28dcc4"
  },
  {
    "sha": "5f3c1447c29f6df60d71e0651d2569ce953ba878",
    "message": "Implement profile modal and update memory documentation",
    "date": "2026-10-10T18:13:21.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5f3c1447c29f6df60d71e0651d2569ce953ba878"
  },
  {
    "sha": "2297d4a865b666a2d67dccd1b2a9ff890197b398",
    "message": "Implement profile tag editing features and update server storage schemas",
    "date": "2026-10-08T10:03:58.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/2297d4a865b666a2d67dccd1b2a9ff890197b398"
  },
  {
    "sha": "89a6441310d691237a84967845bc6c9d573a6b98",
    "message": "Update account cleanup documentation",
    "date": "2026-10-08T09:51:03.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/89a6441310d691237a84967845bc6c9d573a6b98"
  },
  {
    "sha": "52359bec6bf3206511c69aee5e6e9e8333a13532",
    "message": "Implement account cleanup functionality and update login logic",
    "date": "2026-10-08T08:37:42.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/52359bec6bf3206511c69aee5e6e9e8333a13532"
  },
  {
    "sha": "0bc068620e980db168a38bfe543f7f7789033e28",
    "message": "Update login page validation logic",
    "date": "2026-10-08T08:30:30.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/0bc068620e980db168a38bfe543f7f7789033e28"
  },
  {
    "sha": "768fbf7961a43f258bc1717808e2314c208f29f7",
    "message": "Update profile modal and document image storage logic",
    "date": "2026-10-08T08:19:15.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/768fbf7961a43f258bc1717808e2314c208f29f7"
  },
  {
    "sha": "59b98ae650e3c7580821fd5c6ac9532fbec6c02a",
    "message": "Implement chat profile modal and update chat page functionality",
    "date": "2026-08-15T10:58:09.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/59b98ae650e3c7580821fd5c6ac9532fbec6c02a"
  },
  {
    "sha": "dbb69f3057e2f1905732b1870cc3cdcfa6115758",
    "message": "Refactor and update styling across UI components",
    "date": "2026-07-30T14:59:58.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/dbb69f3057e2f1905732b1870cc3cdcfa6115758"
  },
  {
    "sha": "b6937983429cc002f0227166568ddef11c3587a1",
    "message": "Improve chat performance and fix profile save errors",
    "date": "2026-05-14T12:45:31.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b6937983429cc002f0227166568ddef11c3587a1"
  },
  {
    "sha": "e97c9b7d8a7bfa4f36762dd8e505c78509049ab0",
    "message": "Improve chat message responsiveness and fix profile picture saving",
    "date": "2026-05-14T12:36:44.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/e97c9b7d8a7bfa4f36762dd8e505c78509049ab0"
  },
  {
    "sha": "1967b98da2187664c584be914af7f3815eb13ad1",
    "message": "Make calling and voice messages work reliably",
    "date": "2026-04-22T10:41:40.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/1967b98da2187664c584be914af7f3815eb13ad1"
  },
  {
    "sha": "1767182c3793e74139b1723e3d6dbaa0946d4612",
    "message": "Update chat to support message replies and voice call relay",
    "date": "2026-03-12T08:55:26.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/1767182c3793e74139b1723e3d6dbaa0946d4612"
  },
  {
    "sha": "e7e7ffd042d3b99122509dee318d3833760dea43",
    "message": "Improve proxy functionality and fix various calling and chat features",
    "date": "2026-03-11T18:40:51.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/e7e7ffd042d3b99122509dee318d3833760dea43"
  },
  {
    "sha": "13e21d94042a3fb4791098641d9113b61fa14183",
    "message": "Enhance chat with media, calling, and soundboard functionalities",
    "date": "2026-03-11T13:55:26.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/13e21d94042a3fb4791098641d9113b61fa14183"
  },
  {
    "sha": "da490c1ffbe24d79071c41107721beb56ded9fe9",
    "message": "Improve chat functionality by ensuring messages load correctly and scrolling works",
    "date": "2026-03-10T11:59:58.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/da490c1ffbe24d79071c41107721beb56ded9fe9"
  },
  {
    "sha": "66c0dc9a3db054ea0012e44cd43d4683d8bba705",
    "message": "Add ability for users to delete messages and view all users",
    "date": "2026-02-15T16:36:50.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/66c0dc9a3db054ea0012e44cd43d4683d8bba705"
  },
  {
    "sha": "17d66a2cf0631627f0cf56282e83d3b38147aa79",
    "message": "Update chat interface and user authentication logic",
    "date": "2026-02-15T16:35:21.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/17d66a2cf0631627f0cf56282e83d3b38147aa79"
  },
  {
    "sha": "76c8d8fcbf48249d6cb43e48a2570aae45ee7344",
    "message": "Update authentication and chat to properly fetch and display data",
    "date": "2026-02-15T16:34:52.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/76c8d8fcbf48249d6cb43e48a2570aae45ee7344"
  },
  {
    "sha": "2cff9bf762675c131c29126d9491937c49c169e0",
    "message": "Improve chat functionality and user directory display",
    "date": "2026-02-13T20:18:38.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/2cff9bf762675c131c29126d9491937c49c169e0"
  },
  {
    "sha": "aeb2f8dac7226f92647aaa0488e73bfcdc5cab3c",
    "message": "Add a shop section to the admin panel and allow users to see everyone in the chat",
    "date": "2026-02-13T20:17:24.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/aeb2f8dac7226f92647aaa0488e73bfcdc5cab3c"
  },
  {
    "sha": "8102ceb245a51d343af8ab9532c968066b9a2922",
    "message": "Add shop functionality for users to buy and equip cosmetic items",
    "date": "2026-02-13T20:14:05.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/8102ceb245a51d343af8ab9532c968066b9a2922"
  },
  {
    "sha": "5ff03e1a2bac8d8a4e247c2360eef2ba8f7db3eb",
    "message": "Add shop system and user inventory functionality",
    "date": "2026-02-13T20:12:38.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/5ff03e1a2bac8d8a4e247c2360eef2ba8f7db3eb"
  },
  {
    "sha": "76d2847c3030768cd8cff773fcf2fa4c80800186",
    "message": "Add shop functionality and enhance user profile and group management features",
    "date": "2026-02-12T07:41:08.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/76d2847c3030768cd8cff773fcf2fa4c80800186"
  },
  {
    "sha": "cb35a6ad2cbcc5b138645db7e62f7844c6055f31",
    "message": "Add many new features and icons to the chat interface",
    "date": "2026-02-12T07:19:21.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/cb35a6ad2cbcc5b138645db7e62f7844c6055f31"
  },
  {
    "sha": "267eaeda6465803030f6b35a003da37dc1801b21",
    "message": "Improve chat functionality with persistent sessions and enhanced media handling",
    "date": "2026-02-11T07:05:28.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/267eaeda6465803030f6b35a003da37dc1801b21"
  },
  {
    "sha": "a85ffaa31f2a4840f4083a8f957903682ed5c0f9",
    "message": "Improve chat experience with media handling and scroll management",
    "date": "2026-02-11T07:03:32.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a85ffaa31f2a4840f4083a8f957903682ed5c0f9"
  },
  {
    "sha": "6fd70bc564b2d60679bfdaf7ab4f966b14d93221",
    "message": "Add ability to send files and record audio messages within the chat",
    "date": "2026-02-11T06:58:21.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/6fd70bc564b2d60679bfdaf7ab4f966b14d93221"
  },
  {
    "sha": "a48cbe75bf231a44830e4fa2f63699b4e8cb680d",
    "message": "Fix chat functionality by correcting the hook implementation",
    "date": "2026-02-10T12:23:32.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/a48cbe75bf231a44830e4fa2f63699b4e8cb680d"
  },
  {
    "sha": "2ee39f72d50a9b9574ec0e7d78722c577cffb1d1",
    "message": "Add a full-screen interface for voice calls",
    "date": "2026-02-10T09:18:16.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/2ee39f72d50a9b9574ec0e7d78722c577cffb1d1"
  },
  {
    "sha": "56ec53eb2b52b23702d956785a906bd7a62252e2",
    "message": "Add ability to reply to messages and delete messages",
    "date": "2026-02-10T09:16:55.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/56ec53eb2b52b23702d956785a906bd7a62252e2"
  },
  {
    "sha": "c509a370379e74a6f7e0b061d096ded5c2570ced",
    "message": "Add audio messaging and fix ringtone playback issues",
    "date": "2026-02-09T09:48:54.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/c509a370379e74a6f7e0b061d096ded5c2570ced"
  },
  {
    "sha": "8c7ec2af02df07e8a78869ff7df3c9bd6ed7bff8",
    "message": "Add ability for users to send pictures, videos, and audio messages",
    "date": "2026-02-04T17:25:04.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/8c7ec2af02df07e8a78869ff7df3c9bd6ed7bff8"
  },
  {
    "sha": "07b58acb2f98e3c285688a4536bcb4e74da3a534",
    "message": "Update admin panel to display usernames and improve data handling",
    "date": "2026-01-30T13:37:30.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/07b58acb2f98e3c285688a4536bcb4e74da3a534"
  },
  {
    "sha": "471c93254df5bd94b9769ba9fe9853ea3dfcced0",
    "message": "Display user information for generated keys in the admin panel",
    "date": "2026-01-30T13:36:26.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/471c93254df5bd94b9769ba9fe9853ea3dfcced0"
  },
  {
    "sha": "b3de627b7f95b5deea33c3175bde9f7605294a0e",
    "message": "Update chat interface and improve key management features",
    "date": "2026-01-30T13:36:11.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b3de627b7f95b5deea33c3175bde9f7605294a0e"
  },
  {
    "sha": "1abfc5f271e2459b8562e72b8a7d501e10470e4a",
    "message": "Update chat interface to display broadcast hub and adjust voice call button",
    "date": "2026-01-30T13:35:53.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/1abfc5f271e2459b8562e72b8a7d501e10470e4a"
  },
  {
    "sha": "0097dccba8a8a1b6fced481d5359a6c07060b9b0",
    "message": "Disable screen sharing and show usernames for admin keys",
    "date": "2026-01-30T13:34:14.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/0097dccba8a8a1b6fced481d5359a6c07060b9b0"
  },
  {
    "sha": "d6cb967232f2565f51cdee92d8acac23866efb41",
    "message": "Enhance chat and calling features, refine UI elements, and update backend logic",
    "date": "2026-01-30T13:24:34.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/d6cb967232f2565f51cdee92d8acac23866efb41"
  },
  {
    "sha": "9d42ac8422a36514120dc6994f31666e0ae770e6",
    "message": "Add user notification and ringtone settings to the application",
    "date": "2026-01-30T13:23:21.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/9d42ac8422a36514120dc6994f31666e0ae770e6"
  },
  {
    "sha": "98585ed0a67e0a3f9ef40106f2b54c8f45998ed2",
    "message": "Enhance voice calling functionality to support group calls and track participants",
    "date": "2026-01-30T13:22:29.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/98585ed0a67e0a3f9ef40106f2b54c8f45998ed2"
  },
  {
    "sha": "6714c94b6990900d218ad4dcd04320c09ad9c2aa",
    "message": "Add detailed project documentation for the cyberpunk proxy application",
    "date": "2026-01-29T14:51:02.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/6714c94b6990900d218ad4dcd04320c09ad9c2aa"
  },
  {
    "sha": "b836faeca2409584878ce4cc2decf26c526d3743",
    "message": "Improve proxy error handling and database message querying",
    "date": "2026-01-29T13:56:13.000Z",
    "url": "https://github.com/adamisfunnyz601-byte/Secure-Web-Gateway/commit/b836faeca2409584878ce4cc2decf26c526d3743"
  }
];

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export default function UpdatesPage() {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("all");
  const filtered = useMemo(() => updates.filter((item) => {
    const matchesQuery = !query || (item.message + " " + item.sha).toLowerCase().includes(query.toLowerCase());
    const date = item.date ? new Date(item.date) : null;
    const age = date ? Date.now() - date.getTime() : Infinity;
    const matchesRange = range === "all" || (range === "today" && age < 86400000) || (range === "week" && age < 7 * 86400000) || (range === "older" && age >= 7 * 86400000);
    return matchesQuery && matchesRange;
  }), [query, range]);

  const grouped = useMemo(() => {
    const groups = new Map<string, UpdateEntry[]>();
    filtered.forEach((item) => {
      const key = formatDate(item.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return [...groups.entries()];
  }, [filtered]);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" /> PROJECT CHANGELOG
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Update logs</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                A running history of Secure Web Gateway changes, improvements and fixes, collected from the project’s GitHub commits.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3">
              <div className="rounded-lg bg-primary/15 p-2 text-primary"><GitCommit className="h-5 w-5" /></div>
              <div><div className="text-2xl font-bold tabular-nums text-foreground">{updates.length}</div><div className="text-xs text-muted-foreground">recorded commits</div></div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search updates..." className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex flex-wrap gap-2">
            {([{id:"all",label:"All time"},{id:"today",label:"Last 24h"},{id:"week",label:"Last 7 days"},{id:"older",label:"Older"}] as const).map((item) => (
              <button key={item.id} onClick={() => setRange(item.id)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${range === item.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> {filtered.length} updates shown</span>
          <span>Newest first · timestamps in UTC</span>
        </div>

        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">No updates found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or time filter.</p>
          </div>
        ) : grouped.map(([date, items]) => (
          <section key={date} className="space-y-3">
            <h2 className="sticky top-0 z-10 flex items-center gap-2 bg-background/90 py-2 text-sm font-bold text-foreground backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-primary" /> {date}
              <span className="font-normal text-muted-foreground">({items.length})</span>
            </h2>
            <div className="space-y-2 border-l border-border pl-4 sm:pl-6">
              {items.map((item) => (
                <article key={item.sha} className="group relative rounded-xl border border-border/70 bg-card p-4 transition hover:border-primary/40 hover:bg-card/90">
                  <span className="absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/60 sm:-left-[29px]" />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-6 text-foreground">{item.message}</h3>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{item.sha.slice(0, 7)} <span className="mx-1">·</span> {formatTime(item.date)}</p>
                    </div>
                    <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                      View commit <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          This log is reconstructed from the GitHub commit history available to the project. Each entry links to its original commit; older history may contain additional automated or maintenance commits not included in this snapshot.
        </p>
      </div>
    </Layout>
  );
}
