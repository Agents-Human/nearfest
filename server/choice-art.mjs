import manifest from './choice-assets.json' with {type:'json'};

// Exact prompt + answer labels prevent homonyms (e.g. Python the language)
// from receiving unrelated pictures. Only reviewed, complete option sets ship.
export function withChoiceArt(question) {
  const options = manifest.questions[question.prompt];
  if (question.type !== 'choice' || !options || !Array.isArray(question.choices)) return question;
  const art = question.choices.map(label=>{
    const asset = manifest.assets[options[label]];
    if (!asset) return null;
    // Publish only display fields. Library tags can reveal quiz facts.
    const {assetId,hash,src,fallbackSrc,width,height} = asset;
    return {assetId,hash,src,fallbackSrc,width,height,alt:label};
  });
  return art.every(Boolean) ? {...question,choiceArt:art} : question;
}
