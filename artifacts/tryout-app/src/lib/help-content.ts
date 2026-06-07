export interface HelpStep {
  step: number;
  text: string;
  image?: string; // URL to a screenshot
}

export interface HelpContent {
  title: string;
  description: string;
  steps: HelpStep[];
  tips?: string[];
  videoUrl?: string; // embed URL (YouTube or Loom)
}

export const HELP_REGISTRY: Record<string, HelpContent> = {
  "/": {
    title: "Dashboard",
    description: "The dashboard gives you a live overview of the tryout — attendance, scores, and coverage at a glance.",
    steps: [
      { step: 1, text: "Check the attendance card to see how many players have checked in vs. total registered." },
      { step: 2, text: "The scoring progress card shows how many players have been evaluated." },
      { step: 3, text: "Use the quick links to jump directly to Rankings, Players, or Coverage." },
    ],
    tips: [
      "Keep this tab open on a laptop during tryouts for a live status view.",
      "All numbers update in real time as iPads submit data.",
    ],
  },
  "/players": {
    title: "Players",
    description: "Your master roster. Every player registered for the tryout lives here.",
    steps: [
      { step: 1, text: "Add players manually with the New Player button, or use Import to load a CSV or Google Sheet." },
      { step: 2, text: "Filter by position or age group using the tabs. Search by name or jersey number." },
      { step: 3, text: "Click a player's name to open their profile — scores, measurements, photo, and notes." },
      { step: 4, text: "Use the lightning bolt icon to start scoring a player directly from this list." },
    ],
    tips: [
      "Jersey numbers must be unique — voice scoring on the iPad uses them to identify players.",
      "Age group filters sync with the iPad stations — only players matching the active session appear on iPads.",
      "Players with a green badge have already checked in.",
    ],
  },
  "/rankings": {
    title: "Rankings",
    description: "A live leaderboard of all players sorted by their average evaluation score across all skills.",
    steps: [
      { step: 1, text: "Players are sorted highest to lowest by average score. Updates in real time." },
      { step: 2, text: "Filter by position or age group using the dropdowns." },
      { step: 3, text: "Click the lock icon to pin a player's rank — locked players stay in place as new scores come in." },
      { step: 4, text: "Click a player's name to see a full breakdown by skill and evaluator." },
    ],
    tips: [
      "Lock your top picks early so new scores don't bump them down mid-tryout.",
      "Grey rows are players already added to a roster.",
      "The score is the average across all evaluators and all skills scored for that player.",
    ],
  },
  "/draft": {
    title: "Live Draft",
    description: "After tryouts, coaches take turns claiming players for their teams.",
    steps: [
      { step: 1, text: "Select your team from the left panel." },
      { step: 2, text: "Browse the player pool on the right — sorted by ranking by default." },
      { step: 3, text: "Tap a player to draft them. They move from the pool to your team's roster." },
      { step: 4, text: "Use the Wishlist (heart) to mark players before the draft starts." },
      { step: 5, text: "Must-Haves (star) are your top priorities — they appear first in your wishlist." },
    ],
    tips: [
      "Once drafted by any team, a player is removed from the pool for everyone else.",
      "Encourage coaches to build wishlists before the draft starts.",
      "The app doesn't enforce turn order — manage that yourself in the room.",
    ],
  },
  "/sessions": {
    title: "Session Management",
    description: "A session defines which tryout event is currently live. iPads use this to filter players by age group.",
    steps: [
      { step: 1, text: "Click New Session and fill in the event name, date, and age group." },
      { step: 2, text: "Click Activate to make it the live session on all iPads." },
      { step: 3, text: "Only one session can be active at a time." },
    ],
    tips: [
      "Set the session before players arrive so iPads show the correct event and age group.",
      "If no session is active, the check-in iPad shows a warning banner.",
      "Run separate sessions for different age groups (e.g. U14, U16) one at a time.",
    ],
  },
  "/coverage": {
    title: "Evaluation Coverage",
    description: "See which players still need to be evaluated — a real-time completeness check.",
    steps: [
      { step: 1, text: "Green checkmarks mean a player has been scored on that skill by at least one evaluator." },
      { step: 2, text: "Empty cells mean the skill hasn't been scored yet for that player." },
      { step: 3, text: "Filter by evaluator or skill using the dropdowns at the top." },
      { step: 4, text: "Click a player's name to open their profile and score them directly." },
    ],
    tips: [
      "Check this page mid-tryout to catch players who weren't evaluated.",
      "All mandatory skills should be green before rankings are finalized.",
    ],
  },
  "/coaches": {
    title: "Coaches",
    description: "Manage the people evaluating players and running the tryout.",
    steps: [
      { step: 1, text: "Click Add Coach and enter their name and role (Evaluator, Head Coach, Court Coach, etc.)." },
      { step: 2, text: "To give a coach iPad access, go to Staff & Roles and assign them a PIN and station." },
      { step: 3, text: "Coaches with the role 'Evaluator' appear in the evaluator selector on the Evaluation station." },
    ],
    tips: [
      "Only coaches with a PIN in Staff & Roles can log in on the iPad.",
      "Deleting a coach removes them from the app but not their historical evaluation scores.",
    ],
  },
  "/import": {
    title: "Import Players",
    description: "Load your player roster from Google Sheets or a CSV instead of adding players one by one.",
    steps: [
      { step: 1, text: "Google Sheets: paste the share URL (must be 'Anyone with link can view'). Click Sync." },
      { step: 2, text: "CSV: export your roster and drag it onto the upload area, or click to browse." },
      { step: 3, text: "Required column: Name. Optional: Jersey Number, Position, Age Group, Height." },
      { step: 4, text: "Existing players are matched by jersey number and updated — not duplicated. Scores are never overwritten." },
    ],
    tips: [
      "Run the import before tryout day so players are in the system when iPads start.",
      "You can re-import anytime to pick up roster changes — safe to run multiple times.",
    ],
  },
  "/staff": {
    title: "Staff & Roles",
    description: "Control who can log in on the iPads and which station they access.",
    steps: [
      { step: 1, text: "People come from the Coaches tab — add staff there first if they don't appear here." },
      { step: 2, text: "Click Assign PIN, choose their station, and set a 4-digit PIN." },
      { step: 3, text: "On the iPad they select their name and enter their PIN to unlock their station." },
      { step: 4, text: "Use the PIN toggle at the top to disable login entirely for open-access events." },
    ],
    tips: [
      "Station roles: Evaluator sees only Evaluation, Check-In sees only Check-In, etc.",
      "PINs are not visible after saving — if someone forgets, just assign a new one.",
      "Removing a PIN immediately locks that person out of the iPad.",
    ],
  },
  "/bulk-checkin": {
    title: "Bulk Check-In",
    description: "Check in multiple players at once — useful at the start of a session.",
    steps: [
      { step: 1, text: "Select players using the checkboxes or tap Select All." },
      { step: 2, text: "Click Check In Selected to mark them all as arrived at once." },
    ],
    tips: [
      "Use this when a whole team arrives together and you don't want to do them one by one.",
    ],
  },
  "/roster": {
    title: "Roster",
    description: "View and manage the final team roster after the draft is complete.",
    steps: [
      { step: 1, text: "Players drafted in the Live Draft appear here grouped by team." },
      { step: 2, text: "You can manually add or remove players from a roster here." },
      { step: 3, text: "Export the roster to CSV for sharing with coaches." },
    ],
    tips: [
      "Rostered players appear greyed out in Rankings so you don't draft them twice.",
    ],
  },
};
