'use strict';
// Profile-keyed instructions contain source references/questions, not evaluator answers.
const stories=Object.freeze({
  AMSTERDAM_DATA_V1:require('./care-trust-story.json'),
  ADELAIDE_DATA_V2:require('./care-trust-adelaide-story.json'),
  ADELAIDE_DATA_V3:require('./care-trust-adelaide-story.json')
});
function storyForProfile(profileCode){const story=stories[profileCode];return story?{...story,profileCode}:null;}
function visibleStory(profileCode,refs){
  const story=storyForProfile(profileCode);if(!story)return null;
  const visible=new Set(refs),steps=story.steps.filter(s=>s.evidenceRefs.every(r=>visible.has(r)));
  return steps.length?{...story,steps}:null;
}
module.exports={storyForProfile,visibleStory};
