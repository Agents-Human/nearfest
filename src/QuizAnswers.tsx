import {useState} from 'react';
import type {QuestionIllustration} from './QuestionArt';
import './quiz-answers.css';

export type ChoiceIllustration = QuestionIllustration & {assetId:string;hash:string;fallbackSrc:string};

function ChoicePicture({art}:{art:ChoiceIllustration}) {
  const [failed,setFailed] = useState<string[]>([]);
  const src = failed.includes(art.src) ? art.fallbackSrc : art.src;
  return <span className="quiz-choice-picture" aria-hidden="true">
    {failed.includes(src) ? <small>Image unavailable</small> : <img
      src={src} alt="" width={art.width} height={art.height} decoding="async"
      onError={()=>setFailed(previous=>[...previous,src])}
    />}
  </span>;
}

export default function QuizAnswers({choices,art,busy,onAnswer}:{
  choices:string[];
  art?:ChoiceIllustration[];
  busy:boolean;
  onAnswer:(index:number)=>void;
}) {
  const illustrated = art?.length === choices.length && art.every(Boolean);
  return <div className={`quiz-answers${illustrated?' quiz-answers-illustrated':''}`} role="group" aria-label="Answer choices">
    {choices.map((label,index)=><button
      type="button" key={`${index}-${label}`} disabled={busy}
      onClick={()=>onAnswer(index)} aria-label={`${String.fromCharCode(65+index)}. ${label}`}
    >
      {illustrated && <ChoicePicture key={art[index].hash} art={art[index]}/>}
      <b className="quiz-choice-letter" aria-hidden="true">{String.fromCharCode(65+index)}</b>
      <span className="quiz-choice-label">{label}</span>
      <i className="quiz-choice-arrow" aria-hidden="true">↗</i>
    </button>)}
  </div>;
}
