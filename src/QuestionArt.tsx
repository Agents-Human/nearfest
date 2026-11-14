import {useState} from 'react';
import './question-art.css';

export type QuestionIllustration = {src:string;alt:string;width:number;height:number};

export default function QuestionArt({art}:{art?:QuestionIllustration}) {
  const [failed,setFailed] = useState('');
  if (!art || failed === art.src) return null;
  return <figure className="question-art"><img src={art.src} alt={art.alt} width={art.width} height={art.height} decoding="async" onError={()=>setFailed(art.src)}/></figure>;
}
