/** Rules and tips; device controls are defined separately in game-controls.ts. */
export const arcadeHints: Record<string, readonly string[]> = {
  'platform-relay': [
    'Land on monsters from above to squash them. Squashing a monster or collecting 8 coins charges an air jump; press jump again while airborne to use it. Keep moving ahead of the storm.',
    'Choose how many lives to start with in game setup. In a multiplayer room, everyone starts with the host’s chosen life count. The round ends when someone runs out; everyone still standing wins. Solo includes one practice rival.',
  ],
  'tappy-plane': [
    'Each flap lifts your plane; between flaps, it falls. Fly through gaps in the rocks, clear gates and collect stars without crashing.',
    'Solo is your own flight. With friends, everyone flies the same course and the last plane flying wins. Small, steady taps make it easier to line up the next gap.',
  ],
  'town-council': [
    'Walk up to a resident or work site to interact. Choose a job, talk to a neighbour, or use nearby supplies.',
    'Earn funds, improve town care and prepare the festival over seven days. Talk to residents and keep promises to build trust. Return to Council green to vote and rest; the day ends when everyone rests or the timer runs out.',
  ],
  'castaway-crew': [
    'Approach a survivor or work site to interact. Share tasks and supplies with your crew to prepare for rescue.',
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
    'Select wire tiles to rotate them and connect the power source to every lamp. The AND gate needs both inputs powered, and the switch must be on.',
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
  'pocket-soccer': [
    'Run onto the ball to dribble or steal it, then kick towards the other goal. Aim high or low while kicking to choose a corner.',
    'First to five goals wins. A tied match goes to golden goal: the next goal decides it.',
  ],
  'cat-defense': [
    'Survive five waves of mouse zombies together. Move between lanes, keep firing, and use a shockwave when the crowd gets too close.',
    'Gold coins upgrade your blaster. Watch the shockwave cooldown so it is ready when you need room to escape.',
  ],
  'marble-run': [
    'Race along the floating skyway and reach the finish before your rivals. Collect coins, hop across gaps, and use a second jump in mid-air.',
    'Glowing arrow pads give a speed boost. Spring rings launch you towards high coins; watch for sweeping pistons when you land.',
  ],
  'tank-arena': [
    'First to five knockouts wins. Your turret aims at visible rivals, and shells can bounce off walls. You respawn after a knockout.',
    'Break crates for cannon upgrades, shields and repairs. Red barrels explode, so use cover and keep an escape route.',
  ],
  'pocket-racers': [
    'Hold the accelerator to drive; releasing it slows you down. The road keeps going, and whoever is furthest ahead when the room’s timer expires wins.',
    'Hold Drift while turning, then release for a boost. Collect fuel cans before using Nitro, and keep accelerating while boosting. Pulse shots recharge as you race.',
    'Marked ramps give airtime and a landing boost. Watch your grip in the rain and avoid heavy impacts. Solo races include computer drivers.',
  ],
  'stick-rivals': [
    'Win two rounds to take the duel. Chain attacks, mix in kicks, and watch the distance between you and your rival.',
    'Guard just before a hit to parry. Moving while guarding gives you a dash. Jump again in the air to flip; a kick in mid-air becomes a dropkick. Throw works close up, while Blast attacks from a distance.',
  ],
  'paddle-duel': [
    'Keep the ball from passing your paddle and send it beyond your rival. First to seven points wins.',
    'Hitting near the edge of your paddle changes the rebound angle. Aim for space your rival cannot cover in time.',
  ],
  'air-hockey': [
    'Strike the puck into the other goal while protecting your own. First to five goals wins.',
    'Move into the puck to build momentum and use the sides of the table to change its angle.',
  ],
  'snake-arena': [
    'Collect food to grow your trail and outlast the other snakes. Avoid walls, your own body, and other snakes’ trails.',
    'Look ahead before turning. A clear route back into open space is worth more than a risky shortcut to food.',
  ],
  'bomb-maze': [
    'Place foam bombs and get clear before they burst. Bombs have a two-second fuse and a blast that reaches three tiles.',
    'Survive three rounds. Make sure you have an escape route before placing a bomb, and watch neighbouring corridors for chain blasts.',
  ],
  'mini-golf': [
    'Play through six garden courses. Aim on the green, adjust the power, and take your shot when the ball has stopped and it is your turn. Fewest strokes wins.',
    'Use the rails for bank shots and line up carefully before the castle passage. A little less power can give you a better next shot.',
  ],
  'marble-knockout': [
    'Stay on the shrinking platform and outlast the other marbles. Your marble carries momentum, so leave room to slow down.',
    'Protect your position near the middle. A push near the edge can send either marble over it.',
  ],
  'kitchen-rush': [
    'Work together to serve six orders before the clock runs out. Walk close to a station, then use Interact with nearby station.',
    'Lettuce needs chopping for salad. Tomatoes need chopping and cooking for soup. Share the jobs so ingredients keep moving.',
  ],
  'paint-tag': [
    'Move to aim and tag your rivals with paint. Score the most tags before the round ends.',
    'Keep moving and use the walls for cover. Change direction between shots to make yourself harder to hit.',
  ],
  'orbit-rescue': [
    'Bring all three stranded probes home. In multiplayer, your crew shares the ship controls, so coordinate your steering, thrust and docking.',
    'Slow down as you approach a probe. Docking needs you to be close and travelling below 45 speed.',
  ],
  'bridge-builders': [
    'Hold to grow the bridge, then release to drop it. Its tip must land on the next tower. A landing on the gold centre earns a bonus.',
    'Everyone faces the same gap. Keep crossing until someone falls. Multiplayer allows 30 seconds for the opening attempt and 15 seconds on later gaps; solo practice has no timer.',
  ],
};
