/** Instructions for games without a world guide, plus mode-specific details. */
export const arcadeHints: Record<string, readonly string[]> = {
  'platform-relay': [
    'Move with A / D or ← / →. Press W or ↑ to jump, and Space or J to shoot. On a phone, use the move, jump and shoot buttons.',
    'Land on monsters from above to squash them. Squashing a monster or collecting 8 coins charges an air jump; press jump again while airborne to use it. Keep moving ahead of the storm.',
    'Choose 1–9 starting lives. The round ends when someone loses all their lives; everyone still standing wins. Solo includes one practice rival. With friends, all 2–4 players start with the same number of lives.',
  ],
  'tappy-plane': [
    'Tap the game area or press Space / ↑ to climb. Release to descend. Fly through gaps in the rocks, clear gates and collect stars without crashing.',
    'Solo is your own flight. With friends, everyone flies the same course and the last plane flying wins. Small, steady taps make it easier to line up the next gap.',
  ],
  'town-council': [
    'Move with WASD or arrow keys; hold Shift to run. Walk up to a resident or work site and press E, or use the on-screen interaction prompt.',
    'Earn funds, improve town care and prepare the festival over seven days. Talk to residents and keep promises to build trust. Return to Council green to vote and rest; the day ends when everyone rests or the timer runs out.',
  ],
  'castaway-crew': [
    'Move with WASD or arrow keys; hold Shift to run. Approach a survivor or work site and press E, or tap the interaction prompt.',
    'Gather food and wood, salvage parts, and repair the rescue radio before the storm. Keep enough food for everyone at dusk. Build trust with survivors, keep your promises, and return to camp to vote and rest.',
  ],
  'draw-guess': [
    'When it is your turn, draw the secret word on the canvas without letters or numbers. Everyone else types guesses while you draw. The word is revealed at the end of the turn.',
    'Start with the main shape, then add details. Keep the secret word out of room chat.',
  ],
  'word-hunt': [
    'Select neighbouring letters to trace a word, then choose Claim word. Letters must touch, including diagonally, and you cannot reuse a tile in the same word.',
    'Words need at least three letters. Longer words earn more points, and each word counts once per player. Use Clear to start a new path.',
  ],
  'word-relay': [
    'On your turn, submit a word that starts with the last letter of the previous word. Do not repeat a word already in the chain.',
    'Everyone starts with three lives. Watch the turn timer and plan your next word while the other players are thinking.',
  ],
  'category-sprint': [
    'Fill the five categories with answers beginning with the round’s letter, then save your answers before time runs out. You can update them until the reveal.',
    'Valid unique answers score 10; shared answers score 5. Unlisted answers can be approved by a majority of the other players during review.',
  ],
  'clue-crew': [
    'The clue giver describes the secret word without using it or any forbidden words. Teammates type guesses to find the answer before the turn ends.',
    'Use associations and examples instead of spelling out the answer. Check the forbidden list before sending your clue.',
  ],
  'bluff-club': [
    'Write a believable answer to the prompt, then choose the real answer from the revealed list. You cannot vote for your own bluff.',
    'Spotting the truth earns 2 points. Each player fooled by your bluff earns you 1 point. Your answer stays private until voting.',
  ],
  'deduction-club': [
    'Read your private role. At night, choose a station to inspect, or choose your sabotage if you are the saboteur. Discuss the evidence in room chat and vote for a suspect.',
    'Evidence names two badges, including a decoy. Compare clues across rounds instead of trusting a single sighting. Roles and night actions stay private.',
  ],
  'maths-tug': [
    'Submit the answer to your team’s maths question. Each correct answer pulls the rope one step; a wrong answer gives you a two-second cooldown.',
    'Ten net pulls wins. Take a moment to check the calculation before submitting.',
  ],
  'equation-forge': [
    'Build an expression from the six numbers using +, −, ×, ÷ and brackets. Use each number at most once and submit before the round ends.',
    'The closest result to the target wins; fewer operations breaks a tie. You can improve your expression while the timer is running.',
  ],
  'circuit-crew': [
    'Tap wire tiles to rotate them and connect the power source to every lamp. The AND gate needs both inputs powered, and the switch must be on.',
    'Keep power away from ground to avoid a short circuit. Work together through the three circuits.',
  ],
  'molecule-match': [
    'Select two atoms to add a bond. Select the same pair again for a double bond. Each atom must have its allowed number of bonds.',
    'Match the target molecule and check your structure before moving on. Remove an incorrect bond before rebuilding it.',
  ],
  'sudoku-race': [
    'Fill every row, column and 3×3 box with the digits 1–9, without repeats. Everyone starts with the same puzzle, but your entries stay private.',
    'Begin with rows, columns or boxes that have the fewest empty cells. Opponents see your progress, not your answers.',
  ],
  'codebreakers': [
    'Find the four-digit code that satisfies every clue. Each digit is from 1 to 6, and repeated digits are allowed.',
    'Use the clues together to rule out impossible positions. Check every clue before submitting a guess.',
  ],
};
