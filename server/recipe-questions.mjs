import {randomInt} from 'node:crypto';
export function recipeQuestions(game,choice){
 const {recipe,rank,rounds}=game,max=8+rank*10;
 return Array.from({length:Math.max(rounds+5,16)},()=>{
  const a=randomInt(2,max),b=randomInt(2,rank*5+5),c=randomInt(1,9);let prompt,answer;
  switch(recipe){
   case 'addition':prompt=`${a} + ${b} + ${c} = ?`;answer=a+b+c;break;
   case 'subtract':prompt=`${a+b+c} − ${b} = ?`;answer=a+c;break;
   case 'multiply':prompt=`${a} × ${b} = ?`;answer=a*b;break;
   case 'divide':prompt=`${a*b} ÷ ${b} = ?`;answer=a;break;
   case 'percent':prompt=`What is ${b*5}% of ${a*20}?`;answer=a*b;break;
   case 'algebra':prompt=`${b}x + ${c} = ${a*b+c}. Find x.`;answer=a;break;
   case 'area':prompt=`A rectangle is ${a} cm long and ${b} cm wide. Its area in cm²?`;answer=a*b;break;
   case 'perimeter':prompt=`A rectangle measures ${a} cm by ${b} cm. Its perimeter in cm?`;answer=2*(a+b);break;
   case 'sequence':prompt=`${a}, ${a+b}, ${a+2*b}, ${a+3*b}, ?`;answer=a+4*b;break;
   case 'powers':prompt=`${b}² + ${c} = ?`;answer=b*b+c;break;
   case 'velocity':prompt=`A rover covers ${a*b} metres in ${b} seconds. Its average speed in m/s?`;answer=a;break;
   case 'density':prompt=`A sample has mass ${a*b} g and volume ${b} cm³. Its density in g/cm³?`;answer=a;break;
   case 'force':prompt=`A ${a} kg object accelerates at ${b} m/s². What net force acts on it, in newtons?`;answer=a*b;break;
   case 'energy':prompt=`A constant ${a} N force moves an object ${b} m along the force direction. Work done in joules?`;answer=a*b;break;
   case 'electricity':prompt=`A resistor carries ${b} A at ${a*b} V. Its resistance in ohms?`;answer=a;break;
   case 'waves':prompt=`A wave has frequency ${a} Hz and wavelength ${b} m. Its speed in m/s?`;answer=a*b;break;
   case 'temperature':prompt=`Convert ${a*5}°C to °F. Use °F = (°C × 9/5) + 32.`;answer=a*9+32;break;
   case 'moles':prompt=`A substance has molar mass ${a} g/mol. What mass is ${b} mol, in grams?`;answer=a*b;break;
   case 'scoreboard':prompt=`A basketball player makes ${b} three-pointers and ${c} free throws. How many points?`;answer=b*3+c;break;
   case 'budget':{const spent=Math.min(c,a*b-1);prompt=`${b} people each put ${a} NEAR into a pot. They spend ${spent} NEAR. How much remains?`;answer=a*b-spent;break;}
   default:throw Error('Unknown challenge recipe.');
  }
  // Four distinct choices; exact integer arithmetic is the scoring authority.
  const q=choice(prompt,answer,[answer+c,answer-c,answer+10+c]);
  return {...q,explanation:game.label};
 });
}
