// Local UI preview of the real race setup. Opening this page creates no account or game room.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArcadeIntro,CreateArcadeRoom} from '../src/ArcadeGames';
import {arcadeGame} from '../server/arcade/catalog.mjs';
import '../src/styles.css';
import '../src/bright.css';
import '../src/community.css';
import '../src/library.css';
import '../src/game-library.css';
import '../src/discovery.css';
function Preview(){const [room,setRoom]=useState(false);return <main style={{maxWidth:1440,margin:'auto',padding:'32px 20px'}}><a href="/tests/race-preview.html">← Driving preview</a>{room?<><button onClick={()=>setRoom(false)}>Back to race setup</button><CreateArcadeRoom game={arcadeGame('pocket-racers') as any} initialEntry="0" created={()=>{}}/></>:<ArcadeIntro game={arcadeGame('pocket-racers') as any} user={null} join={()=>{}} online={()=>setRoom(true)} created={()=>{}}/>}</main>;}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
