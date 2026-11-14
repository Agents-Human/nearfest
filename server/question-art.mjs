import {withChoiceArt} from './choice-art.mjs';

// Reviewed SVG selections from the user-owned StudyJunior production library.
// Exact MCP IDs, source hashes and presentation changes are recorded in
// assets/source/studyjunior/provenance.json. Both solo and online quiz rounds
// use this mapping. Asset names are opaque, and illustrations add context
// without exposing the correct choice. Credentials remain outside this module.
export const questionArt = new Map([
  [
    "Which group do frogs belong to?",
    {
      "src": "/art/studyjunior/01a160b0-e0aa-7267-bb01-06c618cdd680.svg",
      "alt": "A green frog.",
      "width": 640,
      "height": 537
    }
  ],
  [
    "What does a caterpillar become after metamorphosis?",
    {
      "src": "/art/studyjunior/01a160c6-7ce6-73f1-b155-b021f79d9f47.svg",
      "alt": "A green caterpillar.",
      "width": 640,
      "height": 340
    }
  ],
  [
    "Which gas do plants absorb during photosynthesis?",
    {
      "src": "/art/studyjunior/01a17644-c042-721e-b306-768c6822e490.svg",
      "alt": "A leafy green plant.",
      "width": 640,
      "height": 713
    }
  ],
  [
    "How many players does a football team normally have on the pitch?",
    {
      "src": "/art/studyjunior/01a1760a-20cb-7043-a5c5-52866b341353.svg",
      "alt": "A black and white football.",
      "width": 640,
      "height": 640
    }
  ],
  [
    "What is a score of zero called in tennis?",
    {
      "src": "/art/studyjunior/01a173fb-1346-72a8-bbaa-736925c7a75c.svg",
      "alt": "A green tennis ball.",
      "width": 640,
      "height": 634
    }
  ],
  [
    "In basketball, how many points is a free throw worth?",
    {
      "src": "/art/studyjunior/01a1760a-2bfc-7114-a456-4ff83b9767d8.svg",
      "alt": "An orange basketball.",
      "width": 640,
      "height": 640
    }
  ],
  [
    "What is the Sun?",
    {
      "src": "/art/studyjunior/01a17197-56b3-72cb-9d01-d5392827900d.svg",
      "alt": "A stylised illustration of the Sun.",
      "width": 640,
      "height": 644
    }
  ],
  [
    "What keeps the Moon in orbit around Earth?",
    {
      "src": "/art/studyjunior/01a17194-1505-7380-b0ab-324c0cadc045.svg",
      "alt": "A stylised crescent Moon.",
      "width": 640,
      "height": 662
    }
  ],
  [
    "In which year did humans first land on the Moon?",
    {
      "src": "/art/studyjunior/01a17194-1505-7380-b0ab-324c0cadc045.svg",
      "alt": "A stylised crescent Moon.",
      "width": 640,
      "height": 662
    }
  ]
]);

export function withQuestionArt(question, artwork = questionArt) {
  const art = artwork.get(question.prompt);
  if (!art) return withChoiceArt(question);
  const {src, alt, width, height} = art;
  if (typeof src !== 'string' || !/^\/art\/studyjunior\/[a-z0-9-]+\.svg$/.test(src)
    || typeof alt !== 'string' || !Number.isInteger(width) || width < 1
    || !Number.isInteger(height) || height < 1) throw Error('Invalid quiz illustration.');
  return withChoiceArt({...question, illustration: {src, alt, width, height}});
}
